# Flow parity

Every node in [`STUDENT_USER_FLOW.md`](../STUDENT_USER_FLOW.md) and
[`INSTRUCTOR_USER_FLOW.md`](../INSTRUCTOR_USER_FLOW.md), its spec, and its migration
status. **A node without a spec gets one, against the old UI, before its screen is
rebuilt.**

Status: ⬜ legacy UI · 🟨 rebuilt behind the classic/new toggle · ✅ cut over (2026-11-17, D-021; the `*-new` projects that proved parity were retired at cutover)
Spec: ✔ covered · ✖ not yet covered (add before rebuilding)

## Student

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| B | Today dashboard loads | ✔ `student-flow` Today | ✅ |
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
| TD | "Assessments done" summary → Tasks: Done | ✔ `student-flow` (after reload) | ✅ |
| TW | "Due this week" summary → Tasks | ✔ `shell` TW | ✅ |
| CL, CL1, CL2 | Class opens on Stream; all tabs | ✔ `student-flow` CL → CL2 | ✅ |
| STREAM → MD | Open material from Stream | ✔ `student-flow` STREAM → MD | ✅ |
| MAT, PEOPLE | Materials list; roster search | ✖ (tabs reachable only) | ✅ |
| CL-AT | Attendance tab: own % per month; empty state (D-035) | ✔ `attendance` AT → CL-AT | ✅ |
| MODS | Modules tab: modules with submodules nested, content under its submodule, item opens (D-033) | ✔ `submodules` | ✅ |
| CW | Classwork filter | ✖ | ✅ |
| AD | Assessment details | ✔ `student-flow` | ✅ |
| Q, Q1 | Answer, navigator, answers save | ✔ `student-flow` | ✅ |
| Q2 | Per-question timer auto-advances | ✔ `student-flow` Q1 → Q2 | ✅ |
| Q2 (last) | Final timeout auto-submits | ✖ | ✅ |
| Q → AD | Exit assessment | ✔ `student-flow` Q → AD | ✅ |
| CONF | Keep working / Submit now | ✔ `student-flow` | ✅ |
| R | Result and answer review; persists after reload | ✔ `student-flow` | ✅ |
| R → Q | Practice again | ✖ | ✅ |
| MD1 | Mark material reviewed; back | ✔ `student-flow` | ✅ |
| Activity | Submit an assignment (filename + comment) | ✔ `instructor-flow` E → I → F → J | ✅ |
| Mobile | Today → class at phone width, no sideways scroll | ✔ `@mobile` | ✅ |
| D-015 | Exam grade + feedback on the exam page (rebuilt only) | ✔ `student-new` | ✅ |

Student: every ✔ row passed unchanged on the rebuilt UI before cutover (Phase 2) and is now guarded in the default projects.

## Instructor

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| HOME, OVERVIEW | Teaching day; Overview ↔ News | ✔ `instructor-flow` | ✅ |
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
| B | Post announcement → class + Student Stream | ✔ `instructor-flow` B | ✅ |
| COMPOSE | Title ≤120 / message ≤1,200 validation; Cancel | ✔ `instructor-more` | ✅ |
| K | Classes come from ISMS: no Create class; ISMS class opens with its class list and accepts LMS work (D-031) | ✔ `instructor-flow` K, `instructor-isms` (API mocked) | ✅ |
| E: material | Material form → Materials list | ✔ `instructor-more` | ✅ |
| C | Archive and restore a material | ✔ `instructor-more` | ✅ |
| E: assignment | Assignment form → Classwork | ✔ `instructor-flow` E → I → F → J | ✅ |
| E: assessment | Assessment form (one MCQ) → Classwork | ✔ `instructor-more` | ✅ |
| D | Classwork search and filter | ✔ `instructor-more` | ✅ |
| MODULES | Add, rename, and reorder a submodule; create a material in it; move content into it (D-033) | ✔ `submodules` | ✅ |
| F, REVIEW | Pending submission → review | ✔ `instructor-flow` | ✅ |
| SCORE, VALID | Out-of-range score rejected; valid saves | ✔ `instructor-flow` | ✅ |
| J | Student sees score + feedback (assignment) | ✔ `instructor-flow` | ✅ |
| J (exam) | Student sees exam grade later | ✔ rebuilt UI (`student-new`, D-015); classic keeps the gap | ✅ |
| E: assessment (reuse) | Assessment uses an existing question set; Points hidden; set lists both exams (D-034) | ✔ `question-sets` QS → E | ✅ |
| QS | Question sets page: count, points, exams using each, Locked badge; edit an unlocked set | ✔ `question-sets`, `QuestionSetEditor.test.tsx` | ✅ |
| QS (locked) | Locked set is read-only with an explanation; Make a copy gives an editable copy; original unchanged | ✔ `question-sets` | ✅ |
| G | Gradebook loads | ✔ `instructor-flow` G | ✅ |
| SETTINGS | Edit weights and passing score (persisted) | ✔ `instructor-more` | ✅ |
| Mobile | Drawer → class at phone width | ✔ `@mobile` | ✅ |

Instructor: every ✔ row passed on the rebuilt UI and in `both-new` before cutover (Phase 3) and is now guarded in the default projects.

## Cross-cutting

| Check | Spec |
| --- | --- |
| Every legacy URL form resolves; unknown path fallback | ✔ `routing` |
| Admin smoke (out of scope, must not break) | ✔ `routing` |
| Poppins loaded on desktop, iPhone, Android | ✔ `platform` `@all` |
| axe WCAG 2.2 AA baseline | retired at cutover (classic removed); strict checks in `student-new`, `instructor-new`, `new-shell` |

## New shell (Phase 1)

| Check | Spec |
| --- | --- |
| Skip link first; nav `aria-current`; focus moves to h1 on page change | ✔ `new-shell` |
| Choice remembered; "Use classic view" returns to the legacy UI | retired at cutover (D-021); a leftover `?ui=classic` opens the rebuilt UI: ✔ `new-shell` |
| Workspace switch keeps the new UI; Admin stays classic | ✔ `new-shell` |
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
