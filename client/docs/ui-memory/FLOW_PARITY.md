# Flow parity

Every node in [`STUDENT_USER_FLOW.md`](../STUDENT_USER_FLOW.md),
[`INSTRUCTOR_USER_FLOW.md`](../INSTRUCTOR_USER_FLOW.md), and
[`ADMIN_USER_FLOW.md`](../ADMIN_USER_FLOW.md), its spec, and its migration status. **A node without a spec gets one, against the old UI, before its screen is
rebuilt.**

Status: ⬜ legacy UI · 🟨 rebuilt behind the classic/new toggle · ✅ cut over (2026-11-17, D-021; the `*-new` projects that proved parity were retired at cutover)
Spec: ✔ covered · ✖ not yet covered (add before rebuilding)

## Student

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| B | Today dashboard loads (D-066 layout) | ✔ `student-flow` Today | ✅ |
| N | Dashboard → News & Announcements page (D-023; was a dashboard toggle) | ✔ `student-flow` B → N | ✅ |
| N1 | Read teacher announcements | ✔ (renders without error) | ✅ |
| N2, N3 | School announcements, featured carousel | ✖ | ✅ |
| CAL | Academic calendar from the top bar | ✔ `student-flow` C → CAL → CAL1 | ✅ |
| CAL1 | Browse months | ✔ `student-flow` C → CAL → CAL1 | ✅ |
| CAL2 | Select a date entry → AD | ✖ | ✅ |
| S, S1 | Search → class | ✔ `student-flow` C → S | ✅ |
| S1 | Search → assessment / material | ✔ `shell` S1 | ✅ |
| NO | Notification → assessment | ✔ `shell` NO | ✅ |
| P | Profile names the viewed student; Today switches student (D-032; Reset demo data removed) | ✔ `shell` P | ✅ |
| ROLE | Profile menu → switch workspace | ✔ `shell` ROLE | ✅ |
| T, T2 | Tasks list → open assessment | ✔ `student-flow` T → AD | ✅ |
| T1 | Filter dropdown (Due soon / this week / Missing / Done) | ✖ | ✅ |
| TD | "Done" count in Tasks & Assessments → Tasks: Done (D-071; was "Assessments done") | ✔ `student-flow` (after reload) | ✅ |
| TM | "Missing" count in Tasks & Assessments → Tasks: Missing (D-071) | ✔ `shell` TM | ✅ |
| TW | "Due this week" count in Tasks & Assessments → Tasks | ✔ `shell` TW | ✅ |
| CL, CL1, CL2 | Class opens on Stream; all tabs | ✔ `student-flow` CL → CL2 | ✅ |
| STREAM → MD | Open material from Stream | ✔ `student-flow` STREAM → MD | ✅ |
| MAT | Materials grouped by module and submodule; type filter; By module / Newest first; search; a material page with preview, file details, Download, Previous and Next (D-067) | ✔ `materials` | ✅ |
| PEOPLE | Roster search | ✖ (tab reachable only) | ✅ |
| CL-AT | Attendance tab: own % per month; empty state (D-035) | ✔ `attendance` AT → CL-AT | ✅ |
| CL-MT | Live now banner → Join meeting → pre-join (mic off to start; a right the instructor hasn't given says why) → in the meeting with the instructor → Leave → Back to class; waiting until the instructor starts; Meetings tab read-only; 320px and axe (D-072) | ✔ `meetings` MT → CL-MT | ✅ |
| MT: running it | People: Mute, Ask to unmute (the student's prompt → Turn on mic), Let speak, Lower hand, Stop their screen share, Remove (confirmed; the student can't return); Host controls: students' mic, chat, lock, each told to the student; End the meeting for everyone; settings chosen when scheduling (D-072) | ✔ `meetings` | ✅ |
| MT → CL-MT: after a meeting | Past meeting → its page: Attendance table and Download CSV (instructor), Saved chat (class), Delete the saved chat (confirmed); a formula-looking name defused in the CSV; axe (D-072) | ✔ `meetings` | ✅ |
| CL-MT: blur | Blur background on the pre-join screen and in More, kept into the meeting; no request leaves the LMS (D-072) | ✔ `meetings` | ✅ |
| Dashboards: meetings | Student and instructor dashboards list live and coming meetings only when there are any; a live row joins, a coming one opens the class's Meetings tab (D-072) | ✔ `meetings` | ✅ |
| CL-MT: in the meeting | Chat both ways (links, unread count, "being saved"), a raised hand first in People, a reaction on the tile and announced, a shared screen filling the stage, pin, Speaker view, Data saver pausing video, chat as a sheet on a phone at 320px; axe (D-072) | ✔ `meetings` | ✅ |
| CLOSED | Closed activity: Closed, no hand-in or start; Not handed in grade (D-036) | ✔ `close-activities` CLOSE → CLOSED | ✅ |
| MODS | Modules tab: one button per module; each opens the module's own page (`/student/classes/:id/modules/:moduleId`) with four columns, Assessments, Activities, Assignments, Materials, each grouped by submodule, and a Submodules panel of closed submodules that show their items when clicked, empty submodules included (D-074–D-076); item opens; **Back to modules** returns to the Modules tab (D-073) | ✔ `submodules` | ✅ |
| CW | Classwork filter | ✖ | ✅ |
| AD | Assessment details | ✔ `student-flow` | ✅ |
| Q, Q1 | Answer, navigator, answers save | ✔ `student-flow` | ✅ |
| Q2 | Per-question timer auto-advances | ✔ `student-flow` Q1 → Q2 | ✅ |
| Q2 (last) | Final timeout auto-submits | ✖ | ✅ |
| Q → AD | Exit assessment | ✔ `student-flow` Q → AD | ✅ |
| CONF | Keep working / Submit now | ✔ `student-flow` | ✅ |
| R | Result and answer review; persists after reload | ✔ `student-flow` | ✅ |
| R → Q | Practice again | ✖ | ✅ |
| Q (types) | Every question type answered; section directions; spelling notice; typed answers autosave and survive reload; unanswered list on submit (D-040, D-043) | ✔ `quiz-types` | ✅ |
| R (review modes) | Score only / which were right / correct answers after submit or due; Waiting for grading; keys only once no attempt is left (D-040, D-042) | ✔ `quiz-types` | ✅ |
| MD1 | Open a material: its file's preview and Download; back (D-067; was "mark reviewed") | ✔ `student-flow` | ✅ |
| Activity | Hand in an assignment: written answer, upload a file, Turn in with confirmation (D-060) | ✔ `instructor-flow` E → I → F → J | ✅ |
| Your work | Draft autosaves; uploads with progress, refusals in the server's words; receipt with file codes after reload; Take back; new versions; honor statement; past due shows the reason; offline (D-060) | ✔ `assignment-work` | ✅ |
| Own due date | An extension shows "Your due date: … (your instructor gave you more time)" in the rules and details; Turn in after the class's date, not late; Tasks lists it under Due soon with the student's date, not Missing (D-065) | ✔ `assignment-work-more` | ✅ |
| Excused | "Excused" badge and the sentence; no editor or Turn in; work already handed in stays read-only; not in Due soon, Due this week, or Missing (D-065) | ✔ `assignment-work-more`, `selectors.test.ts` | ✅ |
| Late penalty | The rule before handing in; the dialog says what turning in now loses; the grade shows points given, percent and days late, and the score; "Late penalty waived"; nothing while held (D-065) | ✔ `assignment-work-more`, `work.test.ts` | ✅ |
| Rubric | Read-only in the brief before handing in; the chosen level per criterion on the grade, once; not on a held grade (D-065) | ✔ `assignment-work-more` | ✅ |
| Mobile | Today → class at phone width, no sideways scroll | ✔ `@mobile` | ✅ |
| D-015 | Exam grade + feedback on the exam page (rebuilt only) | ✔ `student-new` | ✅ |

Student: every ✔ row passed unchanged on the rebuilt UI before cutover (Phase 2) and is now guarded in the default projects.

## Instructor

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| HOME, OVERVIEW | Overview (greeting h1, D-066); Overview ↔ News | ✔ `instructor-flow` | ✅ |
| CHOOSE | Switch demo instructor | ✔ `instructor-flow` CHOOSE | ✅ |
| EMPTY | No classrooms → message + Admin link | ✖ | ✅ |
| NEWS → B1 | Select a teacher announcement → class Announcements | ✔ `instructor-more` | ✅ |
| TOOLS | Search → class, notifications (empty state), breadcrumb → Overview | ✔ `shell` TOOLS | ✅ |
| TOOLS | Notification → pending review | ✔ `instructor-more` | ✅ |
| F | "Review student work" → review queue | ✔ `instructor-more` | ✅ |
| ROLE | Switch role (URL, title, Back) | ✔ `routing` | ✅ |
| A, PICK | Sidebar class; year filter | ✔ `instructor-flow` / `shell` PICK | ✅ |
| TABS | All seven class tabs reachable (Attendance, the eighth, is covered by `attendance`) | ✔ `instructor-flow` A → TABS | ✅ |
| PEOPLE | Roster search | ✔ `instructor-flow` People | ✅ |
| AT | Attendance tab: month, school days, days present, live %, field errors, Save (D-035) | ✔ `attendance` AT → CL-AT | ✅ |
| MT | Meetings tab: Schedule a meeting (title, time) → upcoming list → Delete, confirmed; Start meeting → full-screen meeting page in the same tab → pre-join (mic on) → Join now → a student joins (D-072) | ✔ `meetings` MT → CL-MT | ✅ |
| CLOSE | Classwork "N of M graded", Close refused with the ungraded list, Reopen (D-036) | ✔ `close-activities` CLOSE → CLOSED | ✅ |
| NHI | Submissions: grade a student who handed in nothing; Give 0 to everyone who didn't hand in (D-036) | ✔ `close-activities` CLOSE → CLOSED | ✅ |
| B | Post announcement → class + Student Stream | ✔ `instructor-flow` B | ✅ |
| COMPOSE | Title ≤120 / message ≤1,200 validation; Cancel | ✔ `instructor-more` | ✅ |
| K | Classes come from ISMS: no Create class; ISMS class opens with its class list and accepts LMS work (D-031) | ✔ `instructor-flow` K, `instructor-isms` (API mocked) | ✅ |
| E: material | Material form → Materials list | ✔ `instructor-more` | ✅ |
| C | Archive and restore a material | ✔ `instructor-more` | ✅ |
| E: material file | Material form with a file → upload with progress → Materials list with the real type and size; a file the server refuses keeps the form and shows why; an Office file with no converter is saved without a preview (D-067) | ✔ `materials` | ✅ |
| MAT-I | A material's page: the same preview students get (PDF pages, image, text, an Office file's PDF copy), page or slide count, Download; Replace file and Remove file (confirmed by name); axe and 320px (D-067) | ✔ `materials` | ✅ |
| E: assignment | Create → assignment builder → Publish → Classwork (D-059; was the inline form) | ✔ `instructor-flow` E → I → F → J, `student-new` | ✅ |
| E: assignment builder | Details · Hand-in · Dates and grading tabs with URLs; presets and Copy a previous assignment; a problem on a hidden tab (or a server field error) opens it and focuses the field; the last day needs late work and a due date; Save draft → Draft in Classwork → Edit draft → Publish → students see it; Preview saves first; a published one is edited with Save changes and a note when work was handed in; a closed one is read-only; leave-without-saving; 320px and axe (D-059) | ✔ `assignment-builder` | ✅ |
| E: penalty and rubric | Late penalty only with a due date and late work (the reason when not), its sentence in the Summary, saved values; turning late work off sends 0; a rubric makes Points its read-only total and is shown; the server's refusal for graded work lands on the picker (D-063) | ✔ `assignment-builder` | ✅ |
| RUBRICS | Create content → Manage rubrics → empty list → New rubric with two criteria (add, remove a level, total) → saved; problems on their inputs with focus; edit title and order; leave-without-saving; Copy; Delete confirmed by name, focus to the heading; the in-use refusal in the dialog; a locked rubric read-only with title editable and Copy opening the copy; 320px and axe (D-063) | ✔ `rubrics` | ✅ |
| E: assessment | Create → assessment builder → Publish → Classwork (D-040; was the one-MCQ form) | ✔ `instructor-more` | ✅ |
| E: builder | Sections with every type; Save draft → Draft in Classwork → Edit draft; Publish refused while a question needs attention; dates can be cleared | ✔ `assessment-builder` | ✅ |
| E: builder tabs | Details · Questions · Settings tabs with URLs; a problem on a hidden tab opens it and focuses the field; badges fit at 320px (D-056) | ✔ `assessment-builder` | ✅ |
| E: import | Pasted or uploaded exam → draft questions with original text and warnings; nothing saved until Save (D-041) | ✔ `assessment-builder`, server `ImportTests` | ✅ |
| PREVIEW | Preview as student; Check answers shows results and keys; nothing saved | ✔ `quiz-types` | ✅ |
| GRADE (types) | Answers beside the key for every type; points override for typed answers kept on re-score (D-043, D-042) | ✔ `grading-accuracy` | ✅ |
| SPELL | Accept or reject near misses; count on the Classwork row | ✔ `grading-accuracy` | ✅ |
| KEY | Item analysis flags a likely wrong key → Fix answer key → attempts re-scored, students see "score updated" | ✔ `grading-accuracy` | ✅ |
| AGRADE | Classwork Grading → assignment grading page: filters with counts, `?filter=&student=` survive reload, versions, link, files in the viewer (PDF, photo, text), download, "Same file as another student" (D-061) | ✔ `assignment-grading` | ✅ |
| AGRADE: save | Save and next in list order; out-of-range score on the field; grade without work after the last day, the server's sentence before it; Give 0 to everyone (D-061, D-036) | ✔ `assignment-grading` | ✅ |
| RETURN | Held grades: student sees none until Return (one student, then Return all graded, each confirmed with the count) (D-061, D-054) | ✔ `assignment-grading` | ✅ |
| RETURN (selected) | Checkboxes on graded rows → Return selected (N), confirmed; the others stay held (D-064) | ✔ `assignment-grading-more` | ✅ |
| AGRADE: penalty | Late work: days late, the penalty sum on raw points, the score after it in the list; waive gives the raw score back (D-064, D-062) | ✔ `assignment-grading-more` | ✅ |
| AGRADE: rubric | A level per criterion, refused until each has one; levels and total saved and shown again (D-064) | ✔ `assignment-grading-more` | ✅ |
| AGRADE: own dates | Give more time (field error before the class's due date) → work no longer late, "Own due date"; remove them; Give 0 skips students whose own last day hasn't passed (D-064) | ✔ `assignment-grading-more` | ✅ |
| AGRADE: excused | Excuse / No longer excused, confirmed; Excused filter; out of Needs grading, Missing and the gradebook; no grade form (D-064) | ✔ `assignment-grading-more` | ✅ |
| AGRADE: comments | Saved comments: save from feedback, add to feedback, edit, delete, empty state (D-064) | ✔ `assignment-grading-more` | ✅ |
| AGRADE: zip | Download all work (.zip); disabled with the reason when nobody handed in (D-064) | ✔ `assignment-grading-more` | ✅ |
| REVIEW (files) | Submissions tab shows an assignment's files and link; Open the grading page (D-061) | ✔ `assignment-grading`, `instructor-new` | ✅ |
| D | Classwork search and filter | ✔ `instructor-more` | ✅ |
| MODULES | Add, rename, and reorder a submodule; create a material in it; move content into it (D-033) | ✔ `submodules` | ✅ |
| F, REVIEW | Pending submission → review | ✔ `instructor-flow` | ✅ |
| SCORE, VALID | Out-of-range score rejected; valid saves | ✔ `instructor-flow` | ✅ |
| J | Student sees score + feedback (assignment) | ✔ `instructor-flow` | ✅ |
| J (exam) | Student sees exam grade later | ✔ rebuilt UI (`student-new`, D-015); classic keeps the gap | ✅ |
| E: assessment (reuse) | Builder → Use a question set; set lists both exams (D-034, D-040) | ✔ `question-sets` QS → E | ✅ |
| QS | Question sets page: count, points, exams using each, Locked badge; edit an unlocked set | ✔ `question-sets`, `QuestionSetEditor.test.tsx` | ✅ |
| QS (locked) | Locked set is read-only with an explanation; Make a copy gives an editable copy; original unchanged | ✔ `question-sets` | ✅ |
| G | Gradebook loads | ✔ `instructor-flow` G | ✅ |
| SETTINGS | Edit weights and passing score (persisted) | ✔ `instructor-more` | ✅ |
| Mobile | Drawer → class at phone width | ✔ `@mobile` | ✅ |

Instructor: every ✔ row passed on the rebuilt UI and in `both-new` before cutover (Phase 3) and is now guarded in the default projects.

## Admin (rebuilt in UI revamp v2, D-037, D-038)

Specs written against the classic Admin first, then run unchanged against the rebuild
(confirmations moved from `window.confirm` to a dialog, D-038).

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| OVERVIEW | Totals open the matching directory with its filter (D-066 summary strip) | ✔ `admin-flow` OVERVIEW | ✅ |
| USERS, USER_VALIDATE, USER_SAVE | Duplicate email refused; add, find, deactivate | ✔ `admin-flow` USERS | ✅ |
| SUBJECTS, COURSE_VALIDATE | Duplicate code refused; delete an unused subject | ✔ `admin-flow` SUBJECTS | ✅ |
| CLASSROOMS, ENROLL | Add a classroom; enroll once, duplicate refused; remove | ✔ `admin-flow` CLASSROOMS and ENROLLMENTS | ✅ |
| TERMS, TERM_RULES | Date validation; new term made current; old term archived | ✔ `admin-flow` TERMS | ✅ |
| ROLES, ROLE_SAVE | Matrix saves and survives a reload | ✔ `admin-flow` ROLES | ✅ |
| SETTINGS, CONFIG, SNAPSHOT, DOWNLOAD, RESET, SEED | Save defaults; back up; download; confirmed reset | ✔ `admin-flow` SETTINGS | ✅ |
| AUDIT, AUDIT_EVENT | Changes appear; category filter; CSV export | ✔ `admin-flow` USERS | ✅ |
| REPORTS | Each report downloads a CSV | ✔ `admin-flow` REPORTS (users) | ✅ |
| Search, phone menu | Top-bar search; drawer reaches a page | ✔ `admin-flow` SEARCH, MOBILE `@mobile` | ✅ |
| a11y | Zero axe violations, text ≥14px, no sideways scroll at 320px | ✔ `admin-flow` `@all`, `@mobile` | ✅ |

## Cross-cutting

| Check | Spec |
| --- | --- |
| Every legacy URL form resolves; unknown path fallback | ✔ `routing` |
| Admin landmark and URL forms | ✔ `routing` |
| Poppins loaded on desktop, iPhone, Android | ✔ `platform` `@all` |
| axe WCAG 2.2 AA baseline | retired at cutover (classic removed); strict checks in `student-new`, `instructor-new`, `new-shell` |

## New shell (Phase 1)

| Check | Spec |
| --- | --- |
| Skip link first; nav `aria-current`; focus moves to h1 on page change | ✔ `new-shell` |
| Choice remembered; "Use classic view" returns to the legacy UI | retired at cutover (D-021); a leftover `?ui=classic` opens the rebuilt UI: ✔ `new-shell` |
| Workspace switch keeps the new UI | ✔ `new-shell` |
| Offline banner announced and cleared | ✔ `new-shell` |
| Student bottom nav on phones; no sideways scroll at 320px | ✔ `new-shell` `@mobile` |
| Instructor drawer closes and focuses the page after navigating | ✔ `new-shell` `@mobile` |
| Zero axe violations (incl. contrast), text ≥14px, controls ≥44px | ✔ `new-shell` `@all` (shells and `/ui-kit`) |

## Resilience (Phase 4)

| Check | Spec |
| --- | --- |
| After one visit, the app opens offline; quiz answers save offline and survive reload | ✔ `resilience` (production build) |
| First visit on Slow 3G shows content in under 10 s (measured 5.8 s) | ✔ `resilience` (production build) |
| Reduced motion stops the carousel auto-advancing | ✔ `resilience` |
| Selected states visible in Windows high contrast | ✔ `resilience` `@all` |
| Bundle within budget | ✔ `npm run budget` (CI) |
| Screen-reader journeys | ✖ manual: `SCREEN_READER_CHECKLIST.md` |

## Server-backed: ISMS connection (D-030)

| Check | Spec |
| --- | --- |
| `/isms-link` shows status, classes (instructor filter, student roster by keyboard), subjects, read-only note; zero axe violations, text ≥14px | ✔ `isms-link` `@all` (API mocked) |
| API not running: plain error with retry per section | ✔ `isms-link` `@all`; offline and 502 in `IsmsLinkPage.test.tsx` |
| No sideways scroll at 320px | ✔ `isms-link` `@mobile` |
| Instructor Classes page names ISMS as the source; no Create class; zero axe violations | ✔ `instructor-isms` `@all` (API mocked) |
| Against the real LMS API | ✖ manual, once `../server` is running |

## Server-backed workspaces (D-032)

| Check | Spec |
| --- | --- |
| Every Student and Instructor journey runs against the LMS API in Demo mode, one database per test | ✔ all specs (`playwright.config.ts`, `e2e/fixtures.ts`) |
| Instructor publishes → student hands in → instructor grades → student sees feedback, all through the API | ✔ `instructor-flow` E → I → F → J |
| A handed-in assignment reaches notifications, the Overview review button, and a review link | ✔ `instructor-more`, `instructor-new` |
| Gradebook saves once the weights add up to 100 | ✔ `instructor-more` SETTINGS, `instructor-new` |
| An exam's grade shows on the exam page and the result (D-015) | ✔ `student-new` |
| Overview mapping: completed work, best exam attempt, archived content, review queue | ✔ `catalog.test.ts`, `store.test.ts` |
| Submodules: instructor builds them, student sees them nested; Modules tabs pass axe and fit 320px (D-033) | ✔ `submodules` (`@all` for axe and 320px); tree rules in `moduleTree.test.ts` |
| Question sets: copy is deep and owner-only; an exam uses only the instructor's own set for its class's subject (D-034) | ✔ `CourseworkTests` (server), `questionSets.test.ts` |
| Question sets pages: zero axe violations, text ≥14px, no sideways scroll at 320px, reachable from the drawer | ✔ `question-sets` `@all`, `@mobile` |
| Assignment turn-in rules come from the server (`turnIn`); late work ends at `closeAt`; grades held until returned; drafts private (D-054) | ✔ `AssignmentRulesTests`, `AssignmentTests` (server), `catalog.test.ts` |
