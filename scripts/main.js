import {SpreadsheetReader, SpreadsheetTabDescriptor, PostProcessableSpreadsheetReaderDescriptor} from '../libs/gspreadsheet-reader.js';

let students = [], studentsById = {}, currentStudent = null;
function resetSelect() {
    $(".select2").select2({
        placeholder: "Rechercher",
        // allowClear: true
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
                    ${student.latestUpdate?"✅":""}
                </option>
            `);
            $(selectorByGrade[grade]).html($(html.join("\n")));
        }).value();

    let totals = _(fetchedStudents)
        .reduce((totals, student) => {
            return {
                maternelleAdults: totals.maternelleAdults + ((student.latestUpdate && student.grade === 'Maternelle')?student.adultsCount:0),
                maternelleChildren: totals.maternelleChildren + ((student.latestUpdate && student.grade === 'Maternelle')?student.childrenCount:0),
                primaireAdults: totals.primaireAdults + ((student.latestUpdate && student.grade === 'Primaire')?student.adultsCount:0),
                primaireChildren: totals.primaireChildren + ((student.latestUpdate && student.grade === 'Primaire')?student.childrenCount:0),
                adults: totals.adults + (student.latestUpdate?student.adultsCount:0),
                children: totals.children + (student.latestUpdate?student.childrenCount:0)
            };
        }, { maternelleAdults: 0, maternelleChildren: 0, primaireAdults: 0, primaireChildren: 0, adults: 0, children: 0 });

    $("#totalMaternelleAdults").html(""+(totals.maternelleAdults || 0));
    $("#totalMaternelleChildren").html(""+(totals.maternelleChildren || 0));
    $("#totalMaternelle").html(""+((totals.maternelleChildren || 0) + (totals.maternelleAdults || 0)));
    $("#totalPrimaireAdults").html(""+(totals.primaireAdults || 0));
    $("#totalPrimaireChildren").html(""+(totals.primaireChildren || 0));
    $("#totalPrimaire").html(""+((totals.primaireChildren || 0) + (totals.primaireAdults || 0)));
    $("#totalAdults").html(""+(totals.adults || 0));
    $("#totalChildren").html(""+(totals.children || 0));
    $("#total").html(""+((totals.children || 0) + (totals.adults || 0)));

    resetSelect();
}

function refreshStudents() {
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

    $("#grade").html(student.grade);
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
    sendStudentData(student);
}

function sendStudentData(student) {
    fetch(`https://script.google.com/macros/s/${KEYS.spreadsheetScriptKey}/exec`, {
        method: 'post',
        body: JSON.stringify(student),
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        }
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

    refreshStudents();
});

