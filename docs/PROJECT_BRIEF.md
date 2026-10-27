# Project brief

## Goal

Demonstrate a fictional college Information Technology LMS to developers and school management through connected student, instructor, and admin workspaces. Open each role directly without sign-in. The frontend uses the supplied ERD as a starting point, with additions for materials and gradebook settings.

## Role outcomes

- Admin: manage users, subjects, classrooms, instructor assignments, and enrollments. Referenced records are deactivated instead of deleted.
- Instructor: manage assigned classrooms, enrollment, modules, materials, announcements, activities, and exams; configure attempts, timers, review, and gradebook weights; grade submissions and essays with feedback.
- Student: browse enrolled classrooms and coursework, read instructor announcements, join with a code, submit an attachment filename with a comment, take exams, review attempts, and see grades. Resubmission and late work follow instructor settings.

## Experience goals

- Keep the existing Student dashboard unchanged as the visual reference. Apply its Poppins typography, soft green surfaces, and rounded cards to the Instructor and Admin workspaces, which share a responsive shell with a collapsible desktop sidebar, mobile navigation drawer, and role/user switching.
- Keep each role's dashboard focused on its primary job: the existing Student experience, instructor submissions awaiting review, and admin setup and enrollment.
- Keep the role-specific task flows understandable from overview through completion, with the supplied ERD as the data relationship reference.

## Boundaries and acceptance

- Frontend-only React/Vite, fictional college data, no accounts, real uploads, backend, or cross-device persistence.
- Role data and submissions persist in the current browser; no reset control.
- Exams support multiple choice, true/false, essay, enumeration, and matching. Essays need instructor grading; remaining types use simple local automatic grading. Both exam-wide and per-question timers can be disabled or configured; retry and correct-answer visibility settings are configurable.
- Gradebook category weights and passing threshold are instructor-configurable. The illustrative overall uses graded work only.
- Document Student, Instructor, and Admin journeys in matching role flow documents and standalone SVG charts.
- Validate with lint/build and visual role journeys at desktop and mobile widths. Browser-local data and client-side policies are not suitable for real classroom use.
