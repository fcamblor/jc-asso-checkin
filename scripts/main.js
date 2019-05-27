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
    fetch('/scripts/data.json')
        .then((res) => res.json())
        .then((fetchedStudents) => fillStudents(fetchedStudents));
}

function showStudentDetail(student) {
    currentStudent = student;

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

