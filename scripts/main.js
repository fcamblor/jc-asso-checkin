import {SpreadsheetReader, SpreadsheetTabDescriptor, PostProcessableSpreadsheetReaderDescriptor} from '../libs/gspreadsheet-reader.js';
import {WriteQueue} from '../libs/WriteQueue.js';

let students = [], studentsById = {}, currentStudent = null;
function resetSelect() {
    $(".select2").select2({
        placeholder: "Rechercher"
    });
}

function fillStudents(fetchedStudents) {
    students = fetchedStudents;
    studentsById = _.indexBy(fetchedStudents, fetchedStudent => ""+fetchedStudent.id);

    let $child = $("#child");
    let selectedValue = $child.val();

    const selectorByGrade = {
        'Maternelle': '#matn',
        'Primaire': '#prim'
    };

    _.each(selectorByGrade, selector => $(selector).html(''));
    _(fetchedStudents)
        .groupBy(fetchedStudent => fetchedStudent.grade)
        .forEach((students, grade) => {
            let html = _.map(students, student => `
                <option value="${student.id}" ${student.id == selectedValue?"selected":""}>
                    ${student.lastName.toUpperCase()} 
                    ${student.firstName[0].toUpperCase() + student.firstName.substr(1).toLowerCase()}
                    ${student.latestUpdate?"✔️":""}
                </option>
            `);
            $(selectorByGrade[grade]).html($(html.join("\n")));
        }).value();

    let totals = _(fetchedStudents)
        .reduce((totals, student) => {
            return {
                real: {
                    maternelleAdults: totals.real.maternelleAdults + ((student.latestUpdate && student.grade === 'Maternelle')?student.adultsCount:0),
                    maternelleChildren: totals.real.maternelleChildren + ((student.latestUpdate && student.grade === 'Maternelle')?student.childrenCount:0),
                    maternelleCheckins: totals.real.maternelleCheckins + ((student.latestUpdate && student.grade === 'Maternelle')?1:0),
                    primaireAdults: totals.real.primaireAdults + ((student.latestUpdate && student.grade === 'Primaire')?student.adultsCount:0),
                    primaireChildren: totals.real.primaireChildren + ((student.latestUpdate && student.grade === 'Primaire')?student.childrenCount:0),
                    primaireCheckins: totals.real.primaireCheckins + ((student.latestUpdate && student.grade === 'Primaire')?1:0),
                    adults: totals.real.adults + (student.latestUpdate?student.adultsCount:0),
                    children: totals.real.children + (student.latestUpdate?student.childrenCount:0),
                    checkins: totals.real.checkins + (student.latestUpdate?1:0)
                },
                remaining: {
                    maternelleAdults: totals.remaining.maternelleAdults + (((!student.latestUpdate) && student.grade === 'Maternelle')?student.plannedAdultsCount:0),
                    maternelleChildren: totals.remaining.maternelleChildren + (((!student.latestUpdate) && student.grade === 'Maternelle')?student.plannedChildrenCount:0),
                    maternelleCheckins: totals.remaining.maternelleCheckins + (((!student.latestUpdate) && student.grade === 'Maternelle' && student.plannedChildrenCount)?1:0),
                    primaireAdults: totals.remaining.primaireAdults + (((!student.latestUpdate) && student.grade === 'Primaire')?student.plannedAdultsCount:0),
                    primaireChildren: totals.remaining.primaireChildren + (((!student.latestUpdate) && student.grade === 'Primaire')?student.plannedChildrenCount:0),
                    primaireCheckins: totals.remaining.primaireCheckins + (((!student.latestUpdate) && student.grade === 'Primaire' && student.plannedChildrenCount)?1:0),
                    adults: totals.remaining.adults + ((!student.latestUpdate)?student.plannedAdultsCount:0),
                    children: totals.remaining.children + ((!student.latestUpdate)?student.plannedChildrenCount:0),
                    checkins: totals.remaining.checkins + (((!student.latestUpdate) && student.plannedChildrenCount)?1:0)
                }
            };
        }, {
            real: {
                maternelleAdults: 0, maternelleChildren: 0, maternelleCheckins: 0,
                primaireAdults: 0, primaireChildren: 0, primaireCheckins: 0,
                adults: 0, children: 0, checkins: 0
            },
            remaining: {
                maternelleAdults: 0, maternelleChildren: 0, maternelleCheckins: 0,
                primaireAdults: 0, primaireChildren: 0, primaireCheckins: 0,
                adults: 0, children: 0, checkins: 0
            }
        });

    $("#totalMaternelleAdults").html(""+(totals.real.maternelleAdults || 0));
    $("#totalMaternelleChildren").html(""+(totals.real.maternelleChildren || 0));
    $("#totalMaternelleCheckins").html(""+(totals.real.maternelleCheckins || 0));
    $("#totalMaternelle").html(""+((totals.real.maternelleChildren || 0) + (totals.real.maternelleAdults || 0)));
    $("#totalPrimaireAdults").html(""+(totals.real.primaireAdults || 0));
    $("#totalPrimaireChildren").html(""+(totals.real.primaireChildren || 0));
    $("#totalPrimaireCheckins").html(""+(totals.real.primaireCheckins || 0));
    $("#totalPrimaire").html(""+((totals.real.primaireChildren || 0) + (totals.real.primaireAdults || 0)));
    $("#totalAdults").html(""+(totals.real.adults || 0));
    $("#totalChildren").html(""+(totals.real.children || 0));
    $("#totalCheckins").html(""+(totals.real.checkins || 0));
    $("#total").html(""+((totals.real.children || 0) + (totals.real.adults || 0)));

    $("#remainingMaternelleAdults").html(""+(totals.remaining.maternelleAdults || 0));
    $("#remainingMaternelleChildren").html(""+(totals.remaining.maternelleChildren || 0));
    $("#remainingMaternelleCheckins").html(""+(totals.remaining.maternelleCheckins || 0));
    $("#remainingMaternelle").html(""+((totals.remaining.maternelleChildren || 0) + (totals.remaining.maternelleAdults || 0)));
    $("#remainingPrimaireAdults").html(""+(totals.remaining.primaireAdults || 0));
    $("#remainingPrimaireChildren").html(""+(totals.remaining.primaireChildren || 0));
    $("#remainingPrimaireCheckins").html(""+(totals.remaining.primaireCheckins || 0));
    $("#remainingPrimaire").html(""+((totals.remaining.primaireChildren || 0) + (totals.remaining.primaireAdults || 0)));
    $("#remainingAdults").html(""+(totals.remaining.adults || 0));
    $("#remainingChildren").html(""+(totals.remaining.children || 0));
    $("#remainingCheckins").html(""+(totals.remaining.checkins || 0));
    $("#remaining").html(""+((totals.remaining.children || 0) + (totals.remaining.adults || 0)));

    resetSelect();
}

function refreshStudents() {
    if(!navigator.onLine) {
        console.info("Refresh students skipped : offline");
        return;
    }

    let previousLastName = null;
    SpreadsheetReader.readFromDescriptors(KEYS.spreadsheetKey, [
        new SpreadsheetTabDescriptor({
            tabId: 1,
            dataField: "students",
            descriptor: new PostProcessableSpreadsheetReaderDescriptor({
                firstRow: 2,
                columnFields: {
                    "A": "lastName", "B": "firstName",
                    "E": "plannedAdultsCount", "F": "plannedChildrenCount",
                    "M": "adultsCount", "N": "childrenCount", "O": "latestUpdate",
                    "G": "detail", "C": "gradeName"
                },
                fieldsRequiredToConsiderFilledRow: ["firstName"],
                postProcess: (results) => {
                    _.each(results, (result, index) => {
                        result.id = index + 1;

                        result.lastName = result.lastName || previousLastName;
                        previousLastName = result.lastName;

                        result.plannedAdultsCount = Number(result.plannedAdultsCount || 0);
                        result.plannedChildrenCount = Number(result.plannedChildrenCount || 0);
                        result.adultsCount = (result.adultsCount===undefined || result.adultsCount===null)?null:Number(result.adultsCount);
                        result.childrenCount = (result.childrenCount===undefined || result.childrenCount===null)?null:Number(result.childrenCount);
                        if(
                            result.gradeName.indexOf("CP") !== -1
                            || result.gradeName.indexOf("CE1") !== -1
                            || result.gradeName.indexOf("CE2") !== -1
                            || result.gradeName.indexOf("CM1") !== -1
                            || result.gradeName.indexOf("CM2") !== -1
                        ) {
                            result.grade = 'Primaire';
                        } else {
                            result.grade = 'Maternelle';
                        }

                        result.detail = result.detail || "";
                    });

                    results = _.sortBy(results, 'lastName');
                    return results;
                }
            })
        })
    ]).then((results) => {
        let fetchedStudents = results[0][0];
        fillStudents(fetchedStudents);
    });
}

function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    console.log('Query variable %s not found', variable);
}

function extractCount(realCount, plannedCount) {
    return realCount === null ? plannedCount : realCount;
}

function showStudentDetail(student) {
    currentStudent = student;

    $("#grade").html(`${student.grade} - ${student.gradeName}`);
    $("#adultsCount").val(extractCount(student.adultsCount, student.plannedAdultsCount));
    $("#childrenCount").val(extractCount(student.childrenCount, student.plannedChildrenCount));
    $("#description").html(student.detail.replace("\n", "<br/>"));

    $("#details").show();
}

function updateStudent(student) {
    student.adultsCount = Number($("#adultsCount").val());
    student.childrenCount = Number($("#childrenCount").val());
    student.latestUpdate = new Date().toISOString();

    fillStudents(students);
    writeQueue.queueOperation({
        type: 'student-update',
        serializableData: student,
        finalizerName: 'no-op'
    });
}

var KEYS = {};
function requireSpreadsheetKey(keyName, localstorageKeyName, promptMessage) {
    let spreadsheetKey = localStorage.getItem(localstorageKeyName);
    if(!spreadsheetKey) {
        spreadsheetKey = getQueryVariable(keyName);
    }
    if(!spreadsheetKey) {
        spreadsheetKey = prompt(promptMessage);
    }
    localStorage.setItem(localstorageKeyName, spreadsheetKey);

    KEYS[keyName] = spreadsheetKey;
}

requireSpreadsheetKey('spreadsheetKey', 'spreadsheet-key', 'GSpreadsheet key');
requireSpreadsheetKey('spreadsheetScriptKey', 'spreadsheet-script-key', 'Script key');

let writeQueue = new WriteQueue({
    name: 'offline-actions',
    finalizer: {
        onSuccess(writeOperation) {
            var localStudent = studentsById[writeOperation.serializableData.id];
            var persistedStudent = writeOperation.serializableData;

            localStudent.adultsCount = persistedStudent.adultsCount;
            localStudent.childrenCount = persistedStudent.childrenCount;
            localStudent.latestUpdate = persistedStudent.latestUpdate;

            fillStudents(students);
        }
    },
    operationsPersistor: {
        persist(name, writeOperations) {
            localStorage.setItem(`writeOps-${name}`, JSON.stringify(writeOperations));
            return Promise.resolve();
        },
        load(name) {
            return Promise.resolve(JSON.parse(localStorage.getItem(`writeOps-${name}`) || "[]"));
        }
    },
    operationExecutor: (writeOperation) => {
        return new Promise((resolve, reject) => {
            fetch(`https://script.google.com/macros/s/${KEYS.spreadsheetScriptKey}/exec`, {
                method: 'post',
                body: JSON.stringify(writeOperation.serializableData),
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then(resolve, () => {
                // TODO: handle timeouts
                reject();
            })
        });
    },
    onExceptionOccuredInCode: console.error
});

$(() => {
    $("#refreshData").on('click', () => refreshStudents());
    $(".select2").on('change', (event) => {
        let studentId = $(event.currentTarget).val();

        showStudentDetail(studentsById[studentId]);
    });
    $("#updateStudent").on('click', () => updateStudent(currentStudent));
    $(":input[type='number']").on('focusin', (event) => $(event.currentTarget).val(''));
    $("#adultsCount").on('focusout', (event) => $(event.currentTarget).val($(event.currentTarget).val() || extractCount(currentStudent.adultsCount, currentStudent.plannedAdultsCount)));
    $("#childrenCount").on('focusout', (event) => $(event.currentTarget).val($(event.currentTarget).val() || extractCount(currentStudent.childrenCount, currentStudent.plannedChildrenCount)));

    setInterval(() => refreshStudents(), 60000);
    refreshStudents();

    writeQueue.start();
});

