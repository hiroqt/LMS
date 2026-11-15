# Flow parity

Every node in [`STUDENT_USER_FLOW.md`](../STUDENT_USER_FLOW.md) and
[`INSTRUCTOR_USER_FLOW.md`](../INSTRUCTOR_USER_FLOW.md), its spec, and its migration
status. **A node without a spec gets one, against the old UI, before its screen is
rebuilt.**

Status: ⬜ legacy UI · 🟨 rebuilt behind the classic/new toggle · ✅ cut over
Spec: ✔ covered · ✖ not yet covered (add before rebuilding)

## Student

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| B | Today dashboard loads | ✔ `student-flow` Today | ⬜ |
| N | Overview ↔ News & announcements | ✔ `student-flow` B → N | ⬜ |
| N1 | Read teacher announcements | ✔ (renders without error) | ⬜ |
| N2, N3 | School announcements, featured carousel | ✖ | ⬜ |
| CAL | Academic calendar from the top bar | ✔ `student-flow` C → CAL → CAL1 | ⬜ |
| CAL1 | Browse months | ✔ `student-flow` C → CAL → CAL1 | ⬜ |
| CAL2 | Select a date entry → AD | ✖ | ⬜ |
| S, S1 | Search → class | ✔ `student-flow` C → S | ⬜ |
| S1 | Search → assessment / material | ✖ | ⬜ |
| NO | Notification → assessment | ✖ | ⬜ |
| P | Profile → Reset demo data | ✖ | ⬜ |
| T, T2 | Tasks list → open assessment | ✔ `student-flow` T → AD | ⬜ |
| T1 | Filter dropdown (Due soon / this week / Missing / Done) | ✖ | ⬜ |
| TD | "Assessments done" summary → Tasks: Done | ✔ `student-flow` (after reload) | ⬜ |
| TW | "Due this week" summary → Tasks | ✖ | ⬜ |
| CL, CL1, CL2 | Class opens on Stream; all tabs | ✔ `student-flow` CL → CL2 | ⬜ |
| STREAM → MD | Open material from Stream | ✔ `student-flow` STREAM → MD | ⬜ |
| MAT, PEOPLE | Materials list; roster search | ✖ (tabs reachable only) | ⬜ |
| CW | Classwork filter | ✖ | ⬜ |
| AD | Assessment details | ✔ `student-flow` | ⬜ |
| Q, Q1 | Answer, navigator, answers save | ✔ `student-flow` | ⬜ |
| Q2 | Per-question timer auto-advances | ✔ `student-flow` Q1 → Q2 | ⬜ |
| Q2 (last) | Final timeout auto-submits | ✖ | ⬜ |
| Q → AD | Exit assessment | ✔ `student-flow` Q → AD | ⬜ |
| CONF | Keep working / Submit now | ✔ `student-flow` | ⬜ |
| R | Result and answer review; persists after reload | ✔ `student-flow` | ⬜ |
| R → Q | Practice again | ✖ | ⬜ |
| MD1 | Mark material reviewed; back | ✔ `student-flow` | ⬜ |
| Activity | Submit an assignment (filename + comment) | ✔ `instructor-flow` E → I → F → J | ⬜ |
| Mobile | Today → class at phone width, no sideways scroll | ✔ `@mobile` | ⬜ |

## Instructor

| Node | Journey | Spec | Status |
| --- | --- | --- | --- |
| HOME, OVERVIEW | Teaching day; Overview ↔ News | ✔ `instructor-flow` | ⬜ |
| CHOOSE | Switch demo instructor | ✔ `instructor-flow` CHOOSE | ⬜ |
| EMPTY | No classrooms → message + Admin link | ✖ | ⬜ |
| NEWS → B1 | Select a teacher announcement → class Announcements | ✖ | ⬜ |
| TOOLS | Search, notifications → review, breadcrumbs | ✖ | ⬜ |
| ROLE | Switch role (URL, title, Back) | ✔ `routing` | ⬜ |
| A, PICK | Sidebar class; year filter | ✔ (sidebar) / ✖ (year filter) | ⬜ |
| TABS | All seven class tabs reachable | ✔ `instructor-flow` A → TABS | ⬜ |
| PEOPLE | Roster search | ✔ `instructor-flow` People | ⬜ |
| B | Post announcement → class + Student Stream | ✔ `instructor-flow` B | ⬜ |
| COMPOSE | Title ≤120 / message ≤1,200 validation; Cancel | ✖ | ⬜ |
| K | Create class → opens; Cancel closes | ✔ `instructor-flow` K | ⬜ |
| E: material | Material form → Materials list | ✖ | ⬜ |
| E: assignment | Assignment form → Classwork | ✔ `instructor-flow` E → I → F → J | ⬜ |
| E: assessment | Assessment form (one MCQ) → Classwork | ✖ | ⬜ |
| D | Classwork search and filter | ✖ | ⬜ |
| F, REVIEW | Pending submission → review | ✔ `instructor-flow` | ⬜ |
| SCORE, VALID | Out-of-range score rejected; valid saves | ✔ `instructor-flow` | ⬜ |
| J | Student sees score + feedback (assignment) | ✔ `instructor-flow` | ⬜ |
| J (exam) | Student sees exam grade later | ✖ known gap (L-003) | ⬜ |
| G | Gradebook loads | ✔ `instructor-flow` G | ⬜ |
| SETTINGS | Edit weights and passing score | ✖ | ⬜ |
| Mobile | Drawer → class at phone width | ✔ `@mobile` | ⬜ |

## Cross-cutting

| Check | Spec |
| --- | --- |
| Every legacy URL form resolves; unknown path fallback | ✔ `routing` |
| Admin smoke (out of scope, must not break) | ✔ `routing` |
| Poppins loaded on desktop, iPhone, Android | ✔ `platform` `@all` |
| axe WCAG 2.2 AA baseline | ✔ `a11y-baseline` (report-only in Phase 0) |
