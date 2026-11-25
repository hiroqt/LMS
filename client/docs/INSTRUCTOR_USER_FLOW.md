# Instructor end-to-end user flow

This is the instructor prototype flow. It was traced from the classic Instructor UI and is implemented by the rebuilt UI in `src/features/instructor/` (see “Since the rebuild” below). Start at **Instructor** in the role picker or open `/instructor`. The workspace uses fictional demo identities and browser-local data; there is no sign-in screen.

**Standalone flowchart:** [Open the scalable instructor flowchart](flowcharts/tmcc-instructor-user-flow.svg). Connector letters in the SVG match the student chart convention: follow a letter to any corresponding letter elsewhere in the diagram.

```mermaid
flowchart TD
    START([Open /instructor]) --> IDENT[Load active fictional instructor]
    IDENT --> MULTI{More than one active instructor?}
    MULTI -->|Yes| CHOOSE[Choose instructor; class selection and year filter reset]
    MULTI -->|No| ASSIGNED{Any active classrooms assigned?}
    CHOOSE --> ASSIGNED
    IDENT --> ASSIGNED

    ASSIGNED -->|No| EMPTY[Show no-classrooms message and Open Admin link]
    EMPTY -->|My classes dropdown is still available| NEWCLASS
    ASSIGNED -->|Yes| HOME[Overview: greeting, review queue, classes]
    HOME --> OVERVIEW{Choose dashboard view}
    OVERVIEW -->|Overview| DASH[Review counts, assigned class cards, review previews, and current-month calendar]
    OVERVIEW -->|News & announcements| NEWS[Featured upcoming school notice, class notices, and school event list]
    DASH -->|Select a class card or All classrooms| A1((A))
    DASH -->|Review student work / open review queue| F1((F))
    DASH -->|Academic date markers| CAL[View current-month dates; markers are informational]
    CAL -->|View announcements| NEWS
    NEWS -->|Select a teacher announcement| B1((B))
    NEWS -->|View calendar| HOME
    NEWS -->|Carousel controls| NEWS

    IDENT --> TOOLS[Shared top bar: search, notifications, breadcrumbs, role switch]
    TOOLS -->|Search class result| A2((A))
    TOOLS -->|Search material or assessment result| CLASSES[Open Classes view; result is not opened directly]
    TOOLS -->|Select one of up to 5 submission notifications| F2((F))
    TOOLS -->|Breadcrumb home| HOME
    TOOLS -->|Switch role| ROLE[Open Student, Instructor, or Admin workspace]

    IDENT --> SIDEBAR[Sidebar: Overview, Gradebook, Question sets, expandable My classes]
    SIDEBAR -->|Choose existing class| A3((A))
    ISMS[ISMS classes and class lists, read through the LMS API] --> K1((K))
    SIDEBAR -->|Gradebook| G1((G))
    SIDEBAR -->|Question sets| QS1((QS))
    A1 --> A4((A))
    A2 --> A4
    A3 --> A4
    A4 --> PICK[Choose a class; filter by All years or available year levels]
    PICK --> CLASS[Open class; choose among visible class tabs]
    K1 --> K2((K))
    K2 --> SYNCED[Each current-term ISMS class appears under its instructor with a starter module and default grade settings]
    SYNCED --> SIDEBAR
    CLASS --> HEADER[Class header: subject, year, section, term, enrolled count, and class code]
    HEADER --> TABS{Choose a class tab}

    TABS -->|Stream| STREAM[Read welcome post, up to 3 work updates, up to 2 material updates, upcoming 4 items, and About panel]
    STREAM -->|Upcoming / View classwork| D1((D))
    STREAM -->|View materials| C1((C))
    STREAM -->|Post class content| E1((E))
    TABS -->|Classwork| D2((D))
    TABS -->|Modules| MODULES[Modules with their submodules and content: add, rename, or reorder a submodule; move content between them]
    TABS -->|Announcements| B2((B))
    TABS -->|Materials| C2((C))
    TABS -->|People| PEOPLE[Search active enrolled students by name or email]
    TABS -->|Attendance| AT[Pick a month, set school days, enter days present per student, Save]
    TABS -->|Submissions| F3((F))
    F3 -->|Didn't hand in| NHI[Give one student a grade, or give 0 or any points to everyone who handed in nothing, after a confirmation]
    TABS -->|Create content| E2((E))

    D1 --> D3((D))
    D2 --> D3
    D3 --> WORK[Search and filter All work, Assignments, or Assessments]
    WORK -->|Create / no matching work| E3((E))
    WORK -->|Review published row, due date, points, and status| WORK
    WORK -->|Close or Reopen, with N of M graded| CLOSE[Close: refused with the students still to grade until everyone has a grade; Reopen returns it to published]
    CLOSE -->|Still to grade| F4((F))

    B1 --> B2
    B2 --> ANNOUNCEMENTS[Read class notices; choose New announcement]
    ANNOUNCEMENTS --> COMPOSE[Enter required title up to 120 characters and message up to 1,200]
    COMPOSE -->|Cancel| ANNOUNCEMENTS
    COMPOSE -->|Post announcement| POSTED[Save class, instructor, timestamp, and active status]
    POSTED --> B3((B))
    B3 -->|Student-facing result| STUDENTNOTICE[Notice appears in connected Student class Stream]
    B3 -->|Instructor-facing result| NEWSNOTICE[Notice appears in instructor News & announcements]
    NEWSNOTICE -->|Select notice| B1

    C1 --> C3((C))
    C2 --> C3
    C3 --> MATERIALS[Browse class materials]
    MATERIALS -->|Add material| E4((E))
    MATERIALS -->|Open a material| MATPAGE[Material page: the students' preview, Download, Replace or Remove the file, Archive, Delete]
    MATERIALS -->|Student-facing result| STUDENTMAT[Material is shared through the connected Student workspace]

    E1 --> E2
    E3 --> E2
    E4 --> E2
    E2 --> E5((E))
    E5 --> CONTENT{Choose a content category}
    CONTENT -->|Material| MATFORM[Choose module; enter title, resource type, optional description; attach a file, uploaded with progress]
    MATFORM -->|Save and share| MATSAVED[Add material to this class]
    MATSAVED --> C4((C))
    CONTENT -->|Assignment| ACTFORM[Assignment builder: optional preset; Details tab: module, title, short description, instructions, points]
    ACTFORM --> ACTRULES[Hand-in tab: written answer, files, link; file types and count; own-work statement. Dates and grading tab: dates, late work, its last day and its penalty, resubmission, when grades show, an optional rubric]
    ACTRULES -->|Manage rubrics| RUBRICS[Rubrics page: open, copy, delete, or write a rubric]
    CONTENT -->|Manage rubrics| RUBRICS
    RUBRICS -->|New rubric or Open| RUBRIC[Rubric editor: title; 1 to 12 criteria with 2 to 6 levels each; running total; a locked one keeps its criteria and can be copied]
    RUBRIC -->|Save| RUBRICS
    ACTRULES -->|Save draft| ACTDRAFT[Draft: listed as Draft, students can't see it; Edit draft reopens it]
    ACTDRAFT --> ACTFORM
    ACTRULES -->|Publish| ACTSAVED[Add active assignment to this class]
    ACTSAVED --> D4((D))
    ACTSAVED --> I1((I))
    CONTENT -->|Assessment| EXFORM[Choose module; enter title, instructions, due date, time limit, and attempts]
    EXFORM --> SOURCE{Questions}
    SOURCE -->|Write new questions| QUESTION[Enter points, one question, four answer choices, and correct answer; a new set for this subject]
    SOURCE -->|Use an existing question set| PICKSET[Choose one of your sets for this subject; the exam is worth its points]
    QUESTION -->|Save and share| EXSAVED[Add active assessment to this class]
    PICKSET -->|Save and share| EXSAVED
    EXSAVED --> D5((D))
    EXSAVED --> I1
    C4 --> MATERIALS
    D4 --> WORK
    D5 --> WORK
    I1 --> STUDENTWORK[Student opens assigned classwork and submits demo work]
    STUDENTWORK --> I2((I))

    F1 --> F4((F))
    F2 --> F4
    F3 --> F4
    I2 --> F4
    F4 --> REVIEW[Choose a pending submission for this class]
    REVIEW -->|Assignment| ACTREVIEW[Review student text, link, and uploaded files]
    ACTREVIEW -->|Open the grading page| AGRADE[Assignment grading page: filters, versions, file viewer, points or rubric, late penalty, own dates, excused, saved comments, Save and next, Return, zip]
    AGRADE --> SCORE
    REVIEW -->|Assessment with essays| EXREVIEW[Review the server-scored attempt and score each essay]
    ACTREVIEW --> SCORE[Enter final score and optional feedback]
    EXREVIEW --> SCORE
    SCORE --> VALID{Score from 0 through maximum?}
    VALID -->|No| SCORE
    VALID -->|Yes · Save grade| SAVEGRADE[Save grade and optional feedback through the LMS API]
    SAVEGRADE --> GRADED[Submission becomes graded and leaves pending queue]
    GRADED --> J1((J))
    J1 --> RESULT[Matching Student work detail shows the saved score and feedback]

    G1 --> G2((G))
    G2 --> GRADEBOOK[Choose an active classroom]
    GRADEBOOK --> SETTINGS[Edit activity weight, exam weight, and passing score]
    SETTINGS --> SUMMARY[Review graded record counts and category averages]
    SUMMARY -->|Breadcrumb home| HOME

    QS1 --> QS2((QS))
    QS2 --> SETS[Question sets: title, subject, question count, total points, exams using each, Locked badge]
    SETS -->|Open a set| SET{Has a student started an exam that uses it?}
    SET -->|No| EDITSET[Edit title and questions; Save question set]
    SET -->|Yes · Locked| VIEWSET[Read-only questions with an explanation]
    EDITSET -->|Make a copy| COPY[Unlocked copy titled “… (copy)”, used by no exam]
    VIEWSET -->|Make a copy| COPY
    COPY --> EDITSET
    SETS -->|Exam listed under Used by| D6((D))
    D6 --> WORK
```

### Connector key

- **A** — dashboard class cards, class search results, and the sidebar dropdown converge on assigned-class selection.
- **B** — instructor News opens a classroom announcement; publishing returns the notice to instructor News and the Student class Stream.
- **C** — Stream and Materials routes lead to the material list; **Add material** then crosses through **E** to the form and returns to the class list.
- **D** — classwork connects with the published assignment and assessment listings.
- **E** — Stream, Classwork, Materials, and Create content open the organized content form path.
- **F** — overview review actions, notifications, the Submissions tab, and demo student submissions converge on pending review.
- **G** — Gradebook navigation opens classroom settings and aggregate progress.
- **H** — instructor breadcrumbs return to Overview; role switching redirects to another workspace.
- **I** — saved classwork reaches the Student demo submission path and returns to instructor review.
- **J** — saving a grade updates the matching Student work detail; there is no standalone Student Grades page.
- **QS** — Question sets lists the instructor's reusable sets; a new assessment can use one instead of new questions, and a locked set is changed by copying it (D-034).
- **K** — classes are not created in the LMS. They arrive from ISMS and appear in the sidebar and Classes page of the instructor who teaches them (D-031).

## Code-based details

- **Initial state:** the page chooses the first active instructor by default. When several are active, a selector lets the demo user switch instructors. Active classrooms are filtered by the selected instructor. With no active classrooms, the normal dashboard is replaced by a no-classrooms message and an Admin link; there is no Create class action; classes are assigned in ISMS.
- **Overview:** the dashboard shows assigned classroom, awaiting review, active assessment, and active enrollment counts. Class cards show student and coursework counts. Year filters are **All years** plus year levels present in that instructor's assigned classrooms. The review panel previews at most three submissions. The calendar is a static current-month grid that marks academic events and class deadlines; dates are not links. Its **View announcements** control switches to News.
- **News & announcements:** the featured school announcement carousel can be changed with its controls. The teacher list includes active class announcements; selecting one opens that class's Announcements tab. The school event list shows up to six upcoming entries. **View calendar** returns to the Overview calendar.
- **Shared top bar:** search matches up to six displayed results from assigned classes, instructor materials, and assessments. A class result selects that class and opens Stream. A material or assessment result only changes to the Classes view; it does not open the specific result. Notifications contain up to five pending submissions and open the selected review. Breadcrumb home returns to Overview; the role switch navigates to Student, Instructor, or Admin.
- **Classes:** year-level filters are also available on the Classes page, which shows a chooser for the visible classrooms. The class header includes the subject, section, term, enrolled count, and enrollment code. Stream shows a static welcome post, up to three work updates, up to two material updates, up to four upcoming due items, and the About panel. Stream links into Classwork, Materials, or Create content.
- **Class tabs:** Classwork searches the selected class's assignment and assessment rows, and filters All, Assignments, and Assessments; rows show due date, points, "N of M graded", and Draft, Published or Closed, with Close or Reopen (D-036); an assignment row also has Edit, and a draft has Edit draft (D-059). People searches active enrolled student names and email addresses. Materials shows class resources. Announcements lists active class notices and provides a required title/message composer. Submissions lists only pending items for the selected class. Create content groups existing Materials, Assignments, and Assessments and shows their counts. Modules (D-033) lists each module with its submodules (one level) and the materials, assignments, and assessments placed in each; an instructor adds a submodule under a module, renames it, moves it up or down, and moves any item to another module or submodule of the class.
- **Classes from ISMS:** the LMS API syncs the current term's ISMS classes and class lists into its database; the workspace shows the classes of the instructor being viewed ("Choose demo instructor" on Overview, a demo identity, not a sign-in). A class seen for the first time gets a starter module and default gradebook settings (40% activity, 60% exam, 60 passing score). A class ISMS stops offering becomes read-only with its content kept. Modules, materials, assignments, assessments, announcements, and grades are LMS-owned and stored by the LMS API (D-032). ISMS classes have no class code.
- **Create content:** the forms require a title and module; the module picker lists each module followed by its submodules ("Unit 1 › 1.1 Joins"). Materials additionally have one of four resource types (Study guide, Reading, Video, Practice set) and an optional description. Assignments open the **assignment builder** (D-059): Details, Hand-in, and Dates and grading tabs, each at its own URL, with presets (Homework, In-class activity, Project, Copy a previous assignment) and a Summary that shows the rules exactly as students will read them, with Preview as student, Save draft, and Publish. A published assignment opens in the same builder from its Classwork row (Edit) with one Save changes action; a closed one is read-only until it is reopened. On Dates and grading, **Take points off late work** (a whole percent per calendar day late, up to a cap) is available only with a due date and late work, and **Grade with a rubric** chooses one of the class's rubrics: the assignment is then worth the rubric's total, and the rubric can't be changed once work is graded (D-063). **Rubrics** (`/instructor/classes/:classId/rubrics`, from Create content's Manage rubrics or the builder) lists the class's rubrics with Open, Copy, and Delete (confirmed; refused while an assignment uses it or a grade has used it). The rubric editor has a title and 1–12 criteria, each with 2–6 levels worth points, and a running total; a rubric that has been used to grade is locked: only its title changes, and Copy makes an editable copy. Assessments support instructions, due date, time limit (0 means none), and attempts allowed (1 to 20), and then either **Write new questions** (points, one required question, four required answer choices, and one correct answer; this creates a new question set for the class's subject) or **Use an existing question set** (one of the instructor's sets for that subject; the exam is worth the set's points). Each exam keeps its own dates, attempts, and time limit.
- **Announcements:** posting requires a nonblank title and message (maximum 120 and 1,200 characters). Saving associates the notice with the selected class and instructor and timestamps it. It appears in the instructor News list and the connected Student class Stream. Cancel closes the composer.
- **Submissions and grading:** the overview hero, review list, notification menu, and class Submissions tab enter the same review flow. It holds handed-in assignments without a grade, and exam attempts with essays. Multiple-choice and true/false exams are graded by the server on submit, so they never wait for review. Assignments show the student's note, link, and uploaded files (Download), the typed file name only for work from before uploads, and **Open the grading page** (D-061). An exam review shows the server's points for each question and asks for points on each essay.
- **Attendance (D-035):** monthly totals, not a daily roll call. Pick a month (this month and the eleven before it, plus any older month already recorded), enter the month's school days (1 to the days in that month) and each student's days present (0 to the school days). Each row shows the live attendance % (days present ÷ school days × 100). **Save attendance** stores the whole month in one call (Saving…/Saved); out-of-range values show a field error, and lowering the school days below a saved entry is refused with the students named. Leaving a student blank before the first save means not recorded; a saved entry cannot be cleared. Attendance is recorded only and does not count in the gradebook yet.
- **Question sets:** each set belongs to one instructor and one subject they teach and can back exams in any of their classes for that subject. The page lists question count, total points, the exams that use each set (archived exams left out), and a **Locked** badge once any student has started one of those exams. An unlocked set can be edited (title, prompts, points, choices, answers; multiple-choice questions can be added; questions removed) and saved as a whole. A locked set is read-only, with an explanation; **Make a copy** (available on every set) creates an unlocked copy used by no exam, which can then be edited and chosen for new exams (D-034).
- **Gradebook:** select an active classroom and edit category weights and passing score. Changes save once the activity and exam weights add up to 100 (Saving…/Saved); until then a warning says so. The panel reports graded counts and averages for activities and exams.

## Completion and prototype limits

- Classes come from ISMS through the LMS API. Admin can still create demo subjects and classrooms in its browser-local demo data; those do not reach the Instructor or Student workspaces.
- Announcement completion means the notice is stored by the LMS API and shown in the instructor News view and the Student class Stream.
- A grade is complete when a valid score is saved. The submission is marked graded and removed from the pending queue. The Student sees the score and optional feedback in the matching work detail after returning to or refreshing the Student workspace; there is no standalone Student Grades page.
- There is no sign-in yet (the instructor is a demo identity), no real file upload, and no class codes. The LMS API enforces who may see and change each class.

## Since the rebuild (2026-11-17)

The journeys above are unchanged and are verified by `e2e/instructor-flow.spec.ts`, `e2e/instructor-more.spec.ts`, and `e2e/shell.spec.ts`. The rebuilt UI adds:

- **Every screen, tab, open form, and selected submission has a URL**, so notifications and "Review" open straight into grading.
- **Search results open the matching class tab** (Materials or Classwork) instead of only the Classes view (D-017).
- **Deleting a material asks first** in a dialog that names it. Forms and the announcement composer explain missing fields inline and show character counts.
- **Grading** shows the server's points per question for exams with essays and asks for each essay's points; assignment scores start empty. Saving confirms with a message.
- **Gradebook** warns when the weights do not add up to 100% and saves only once they do (D-032); its averages are correct (the classic page showed NaN% for graded assignments).
- The class header shows the **class code with a copy button**.
- **Attendance tab** (D-035): monthly attendance per class, recorded only (`e2e/attendance.spec.ts`).
- **Closing an activity** (D-036): each Classwork row shows "N of M graded" with **Close** (and **Reopen** once closed). Close is refused until every student on the class list has a grade and lists who is left; Submissions gains **Didn't hand in** to grade students who handed in nothing, one at a time or with **Give 0 to everyone who didn't hand in** (confirmed; points default to 0). Closed work takes no more hand-ins or attempts; grades can still be corrected (`e2e/close-activities.spec.ts`).
- **Phones:** the drawer holds navigation and the class list and closes on any choice; search opens in a sheet.
- **Assessment builder** (D-040): Create on the Assessments card opens its own page (`…/assessments/new`, then `…/:id/edit`): Details, Questions (write them in sections with every type, import a file, or use a question set), Settings (dates, attempts, time limit, what students see after submitting, spelling, shuffle), and a summary with **Preview as student**, **Save draft**, and **Publish**. Publishing is refused while a question needs attention. Drafts show **Draft** in Classwork with **Edit draft** (`e2e/assessment-builder.spec.ts`, journey E in `instructor-more`).
- **Import** (D-041): a Word, Excel, CSV, or pasted exam becomes draft questions with the original text and warnings beside each; nothing is saved until the instructor saves.
- **Exam grading page** (D-043): Classwork's **Grading** opens `…/assessments/:id/grading` with Submissions (each answer beside its key, points overrides for typed answers), Spelling review (accept or reject near misses), and Item analysis (correct rate, top answers, a "Check the key" warning). **Fix answer key** re-scores every submitted attempt (D-042), also from a locked question set (`e2e/grading-accuracy.spec.ts`).
- **Assignment grading page** (D-061): Classwork's **Grading** on an assignment opens `…/assignments/:id/grading?filter=&student=`: every student on the class list with their latest version, filters with counts (All, Needs grading, Late, Missing, Graded, Returned), the written answer, the link, the files with a viewer for photos, PDF and text (Word, PowerPoint and Excel are download-only) and "Same file as another student", earlier versions, points and feedback with **Save** and **Save and next**, grades for students who handed in nothing after the last day, and, when grades wait to be returned, **Return** for one student or **Return all graded** (`e2e/assignment-grading.spec.ts`).
- **Assignment grading, Phase 3** (D-064): the Score field takes the raw points, and late work on an assignment with a late penalty shows the sum ("18 − 20% (2 days late) = 14.4 of 20") and **Waive the late penalty for this student**; the list shows the score after the penalty. An assignment with a rubric is graded by choosing a level for each criterion (every one is needed). On a student's work: **Give this student more time** (their own due date and last day), **Remove their own dates**, **Excuse from this assignment** / **No longer excused**, each confirmed; the list shows "Own due date" and **Excused** (a filter of its own; excused students are left out of Needs grading, Missing and the gradebook). The feedback has **Saved comments** (add, edit, delete) and **Save this feedback as a comment**. With held grades, **Return selected (N)** returns the students ticked. **Download all work (.zip)** saves every student's latest work. The class Submissions tab sends an assignment with a rubric to this page (`e2e/assignment-grading-more.spec.ts`).

Implementation references: [Instructor workspace](../src/features/instructor/InstructorApp.tsx), [screens and class tabs](../src/features/instructor/pages/), [data, rules, and writes](../src/features/instructor/api/), [shared shell](../src/shared/layout/AppShell.tsx), and [local data model](../src/features/admin/data/lmsData.js).
