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
                adults: totals.adults + (student.latestUpdate?student.adultsCount:0),
                children: totals.children + (student.latestUpdate?student.childrenCount:0)
            };
        }, { adults: 0, children: 0 });

    $("#totalAdults").html(""+(totals.adults || 0));
    $("#totalChildren").html(""+(totals.children || 0));

    resetSelect();
}

function refreshStudents() {
    SpreadsheetReader.readFromDescriptors(spreadsheetKey, [
        new SpreadsheetTabDescriptor({
            tabId: 1 /* 1 */ /* 1917990444 */,
            dataField: "students",
            descriptor: new PostProcessableSpreadsheetReaderDescriptor({
                firstRow: 2,
                columnFields: {
                    "A": "lastName", "B": "firstName", "E": "adultsCount", "F": "childrenCount", "G": "detail", "C": "gradeName"
                },
                fieldsRequiredToConsiderFilledRow: ["firstName", "lastName"],
                postProcess: (results) => {
                    _.each(results, (result, index) => {
                        result.id = index;
                        result.adultsCount = Number(result.adultsCount || 0);
                        result.childrenCount = Number(result.childrenCount || 0);
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

function showStudentDetail(student) {
    currentStudent = student;

    $("#grade").html(student.grade);
    $("#adultsCount").val(student.adultsCount || student.plannedAdultsCount);
    $("#childrenCount").val(student.childrenCount || student.plannedChildrenCount);
    $("#description").html(student.detail.replace("\n", "<br/>"));

    $("#details").show();
}

function updateStudent(student) {
    student.adultsCount = Number($("#adultsCount").val());
    student.childrenCount = Number($("#childrenCount").val());
    student.latestUpdate = new Date().toISOString();

    fillStudents(students);
}

let spreadsheetKey = localStorage.getItem('spreadsheet-key');
if(!spreadsheetKey) {
    spreadsheetKey = getQueryVariable('spreadsheetKey');
}
if(!spreadsheetKey) {
    spreadsheetKey = prompt("GSpreadsheet key");
}
localStorage.setItem("spreadsheet-key", spreadsheetKey);

$(() => {
    $("#refreshData").on('click', () => refreshStudents());
    $(".select2").on('change', (event) => {
        let studentId = $(event.currentTarget).val();

        showStudentDetail(studentsById[studentId]);
    });
    $("#updateStudent").on('click', () => updateStudent(currentStudent));
    $(":input[type='number']").on('focusin', (event) => $(event.currentTarget).val(''));
    $("#adultsCount").on('focusout', (event) => $(event.currentTarget).val($(event.currentTarget).val() || currentStudent.adultsCount || currentStudent.plannedAdultsCount));
    $("#childrenCount").on('focusout', (event) => $(event.currentTarget).val($(event.currentTarget).val() || currentStudent.childrenCount || currentStudent.plannedChildrenCount));

    refreshStudents();
});

