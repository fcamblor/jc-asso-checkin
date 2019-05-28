export class WriteQueue {
    _name;
    _operations; // { serializableData, type, finalizerName? }
    _operationsPersistor; // { persist: (name, writeOperations) => Promise<void>, load: (name) => Promise<WriteOperations[]> }
    _setIntervalId;
    _processQueueInProgress;
    _finalizer; // { onSuccess?: (writingOp, T) => void, onFailure?: (writingOp, T) => void  }
    _operationExecutor; // (writingOp) => Promise<T>
    _onExceptionOccuredInCode; // optional
    _onlineChecker; // { isOnline: () => boolean }

    constructor({ name, finalizer, operationsPersistor, operationExecutor, onExceptionOccuredInCode, onlineChecker }) {
        this._name = name;
        this._operations = [];
        this._setIntervalId = null;
        this._processQueueInProgress = false;
        this._finalizer = finalizer;
        this._operationExecutor = operationExecutor;
        this._operationsPersistor = operationsPersistor;
        this._onExceptionOccuredInCode = onExceptionOccuredInCode;
        this._onlineChecker = onlineChecker || { isOnline: () => navigator.onLine };
    }

    // Overridable
    _finalizerFor(operation) {
        return this._finalizer;
    }

    queueOperation(operation) {
        this._operations.push(operation);
        return this._operationsPersistor.persist(this._name, this._operations);
    }

    start() {
        this._operationsPersistor.load(this._name).then((writingOperations) => {
            this._operations = writingOperations;
            this._setIntervalId = setInterval(
                () => this.tryProcessQueue().then((result) => {
                    if(result.status === 'skipped') {
                        console.debug("Skipped tryProcessQueue() : "+result.reason);
                    } else if(result.status === 'partially-processed') {
                        console.warn("Partially processed tryProcessQueue() : "+result.reason);
                    } else {
                        console.info("Successfully processed queue !");
                    }
                }, console.error),
                5000);
        }, () => {
            console.error("Error during WriteQueue.start() : operationsPersistor.load() failed !");
        })
    }

    stop() {
        if(this._setIntervalId) {
            clearInterval(this._setIntervalId);
            this._setIntervalId = null;
        }
    }

    tryProcessQueue() {
        return new Promise((resolve, reject) => {
            if(this._processQueueInProgress){
                resolve({ status: 'skipped', reason: "already-processing" });
                return;
            }

            if(!this._operations.length) {
                resolve({ status: 'skipped', reason: 'no-operations' });
                return;
            }

            if(this._onlineChecker.isOnline()) {
                this.processQueue().then(() => {
                    resolve({ status: 'processed' });
                }, reason => {
                    if(reason && reason.error) {
                        reject(reason.error);
                    } else {
                        resolve({ status: 'partially-processed', reason: reason.error });
                    }
                });
            } else {
                resolve({ status: 'skipped', reason: "offline" });
            }
        });
    }

    processQueue(){
        return new Promise((resolve, reject) => {
            if(this._processQueueInProgress){
                reject({ error: "already-processing" });
                return;
            }

            this._processQueueInProgress = true;

            try {
                let allWritingOpsProcessedPromise = _.reduce(this._operations, (resultPromise, writingOp) => {
                    return resultPromise.then(/* writingOperationSuccessful */() => new Promise((opResolve, opReject) => {
                        this._processNextWritingOperation(opResolve, opReject);
                    }), /* writingOperationFailed */() => Promise.reject("previous-writing-operation-failed"))
                }, Promise.resolve());

                // We should resolve the defer once every writing operation promises are resolved
                allWritingOpsProcessedPromise.then(/* allWritingOperationsProcessed */() => {
                    this._processQueueInProgress = false;
                    // If writing operation are still empty, we can return the defer
                    if(!this._operations.length){
                        resolve();
                    } else {
                        // If some writing operations appeared since the start of processQueue(), we
                        // should stack another process queue call
                        this.processQueue().then(() => resolve(), (reason) => {
                            if(reason.error) {
                                reject({ error: reason.error });
                            } else {
                                resolve();
                            }
                        });
                    }
                }, /* atLeastOneOperationFailed */() => {
                    this._processQueueInProgress = false;
                    resolve();
                });
            } catch(e) {
                this._processQueueInProgress = false;
                throw e;
            }
        });
    }

    _processNextWritingOperation(resolve, reject) {
        let writingOperation = this._operations[0];

        // This promise is an important promise here
        // - If resolved, it will mean that we should consider current writing operation as "to be removed from the queue"
        // - If rejected, it will mean that writing operation should be kept in the queue, in order to be processed
        // again later
        let considerWritingOperationDone = new Promise((resolveWritingOperationDone, rejectWritingOperationDone) => {
            try {
                if (this._onlineChecker.isOnline()) {
                    let writeOpFinalizer = this._finalizerFor(writingOperation);

                    this._operationExecutor(writingOperation)
                        .then(/* writingOpSuccessful */(response) => {
                            if (writeOpFinalizer.onSuccess) {
                                writeOpFinalizer.onSuccess(writingOperation, response);
                            }
                            resolveWritingOperationDone();
                        }, /* writingOpFailed */(errorType) => {
                            if (errorType === 'timeout' || errorType === 'postpone') {
                                // Request timeout => we should not consider the writing operation as done !
                                // (we will retry later..)
                                // TODO: It might be a nice thing to increase the frequency rate (and the timeout duration)
                                // for the 3-4 consecutive calls before considering we don't have a good QoS
                                console.error(`Timeout error when processing writing operation's execution of type ${writingOperation.type} (finalizer=${writingOperation.finalizerName})`);
                                rejectWritingOperationDone('timeout-during-writeop-exec');
                            } else {
                                // Not a timeout, we should consider the request as processed even if the http returned an error
                                // This is intended to not "block" the carrier and its writing queue if some security checks fail
                                // server side.
                                // Note that we might use more sophisticated testings here in order to retry to send the writing
                                // operation on some serverside errors
                                if (writeOpFinalizer.onFailure) {
                                    writeOpFinalizer.onFailure(writingOperation);
                                }
                                resolveWritingOperationDone();
                            }
                        }).catch(/* errorHappenedDuringWriteOpOnSuccessOrOnFailure */(...args) => {
                        console.error("Error while processing write queue after completion (either success or error, cannot say..)", args);
                        // In case we had an error during onSuccess/onFailure calls, we should REMOVE the write op from the queue
                        // in order to avoid infinite loops
                        resolveWritingOperationDone();
                    });
                } else {
                    console.error("No network available");
                    rejectWritingOperationDone('writeop-exec-while-offline');
                }
            } catch(e) {
                // When an exception occurs in code handling writing operation, we should remove this operation from the queue
                // otherwise it will block everything forever and ever.
                this._onExceptionOccuredInCode(`[${this._name}] Writing operation of type <${writingOperation.type}> has been removed !`, e);
                resolveWritingOperationDone();
            }
        });

        considerWritingOperationDone.then(() => {
            // Processing queue as a FIFO queue => removing current write op once xhr is OK
            this.removeWriteOperation(writingOperation).then(() => resolve(), reject);
        }, /* nonRecurrentErrorOccuredDuringWriteOpProcessing */ (errorMsg, ...args) => {
            writingOperation.latestErrorMsg = errorMsg;
            console.error("Writing operation not considered as done : ", [errorMsg, ...args]);
            reject("error-during-writequeue-processing");
        }).catch((errorMsg) => {
            console.error("Error while updating next writing operation's associated local data (xhr was well performed thought) : "+errorMsg);
            reject('global-error-during-writequeue-processing');
        });
    }

    removeWriteOperation(writeOperation) {
        return new Promise((resolve, reject) => {
            let i=0;
            let stringifiedSerData = JSON.stringify(writeOperation.serializableData);
            while(i<this._operations.length && JSON.stringify(this._operations[i].serializableData) !== stringifiedSerData) {
                i++;
            }

            if(i !== this._operations.length) {
                // Trying to call onFailure/onSuccess if requested
                let writeOpFinalizer = this._finalizerFor(writeOperation);

                try {
                    if (writeOpFinalizer.onSuccess) {
                        writeOpFinalizer.onSuccess(writeOperation);
                    }
                } catch (e) {
                    console.error("Error while processing onSuccess() after write queue is removed from queue", e);
                }

                try {
                    if (writeOpFinalizer.onFailure) {
                        writeOpFinalizer.onFailure(writeOperation.serializableData);
                    }
                } catch (e) {
                    console.error("Error while processing onFailure() after write queue is removed from queue", e);
                }

                this._operations.splice(i, 1);
            }

            this._operationsPersistor.persist(this._name, this._operations).then(resolve, reject);
        });
    }

}