export class SpreadsheetReaderDescriptor {
    constructor(opts) {
        _.extend(this, opts);
    }
}
export class PostProcessableSpreadsheetReaderDescriptor extends SpreadsheetReaderDescriptor {
    constructor(opts) {
        super(opts);
    }
}
export class SpreadsheetTabDescriptor {
    constructor(opts) {
        _.extend(this, opts);
    }
}
export class SpreadsheetReader {
    constructor() {
    }
    static readFromDescriptors(spreadsheetId, descriptors, errorHandler) {
        return Promise.all(_.map(descriptors, (spreadsheetTabDescriptor) => fetch(`https://spreadsheets.google.com/feeds/cells/${spreadsheetId}/${spreadsheetTabDescriptor.tabId}/public/basic?alt=json&v=3.0`, {
            method: 'get',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors'
        }).then(result => result.json()).then(result => new SpreadsheetReader().read(result, spreadsheetTabDescriptor.descriptor), () => {
            (errorHandler || console.error)(`Error while fetching spreadsheet info for tab ${spreadsheetTabDescriptor.tabId}`);
            return Promise.reject(null);
        }))).then((...results) => results);
    }
    read(spreadsheetRepresentation, descriptor) {
        return new Promise((resolve, reject) => {
            let cells = _.map(spreadsheetRepresentation.feed.entry, (spEntry) => {
                let cellCoords = /([A-Z]+)([0-9]+)/g.exec(spEntry.title.$t) || [null, null, null];
                return { v: spEntry.content.$t, r: Number(cellCoords[2]), c: cellCoords[1] };
            });
            let normalResult = _(cells)
                .filter((cell) => cell.r && cell.r >= descriptor.firstRow)
                .groupBy('r')
                .mapValues((cells) => {
                let lineObj = {};
                _.each(cells, (cell) => lineObj[descriptor.columnFields[cell.c]] = cell.v);
                if (descriptor.resultClass) {
                    return new descriptor.resultClass(lineObj);
                }
                else {
                    return lineObj;
                }
            }).values()
                .filter((obj) => {
                if (descriptor.isFilledRow) {
                    return descriptor.isFilledRow(obj);
                }
                else if (descriptor.fieldsRequiredToConsiderFilledRow) {
                    let emptyRequiredColumns = _.filter(descriptor.fieldsRequiredToConsiderFilledRow, fieldRequiredToConsiderFilledRow => !obj[fieldRequiredToConsiderFilledRow]);
                    return emptyRequiredColumns.length === 0;
                }
                else {
                    return true;
                }
            }).value();
            if (descriptor.sortBy) {
                normalResult = _.sortBy(normalResult, descriptor.sortBy);
            }
            let result = normalResult;
            if (descriptor.postProcess) {
                result = descriptor.postProcess(normalResult);
            }
            resolve(result);
        });
    }
}
//# sourceMappingURL=gspreadsheet-reader.js.map