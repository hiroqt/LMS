# Project brief

## Goal

Create a responsive, interactive React prototype for a student-facing classroom workspace, using the existing GClass student workspace concept as the reference.

## Student outcomes

- See current classes and work that is due soon from one home screen.
- Review assessment due dates and separate upcoming, missing, and completed work from a Tasks page.
- Browse dated academic activities in a month-based Calendar view from the workspace sidebar.
- Open a class to view its stream, classwork, learning materials, and student roster.
- Understand each class's section and student count, and search named students.
- Find assessments grouped as Quiz, Long Quiz, or Exam.
- Start an assessment, answer one question at a time, see a per-question countdown, navigate questions, submit, and view a result.

## Scope and boundaries

- Student role only; fictional local sample data.
- No backend, authentication, network persistence, or real classroom records.
- Interactions and completion state persist in the current browser via localStorage.
- Desktop-first layout that adapts to tablet and mobile widths.
- Calendar mock data includes term milestones, school events, and assessment due dates; replace it with official dates before real student use.
- Assessment timer is real in the running prototype. Each question has its own one-minute budget; unanswered questions advance automatically when time expires.

## Acceptance

- Home, Calendar (month navigation, scheduled dates, and links to assessment details), Tasks (with dated upcoming, missing, and done assessments), class detail tabs, categorized classwork, materials, people/roster, assessment details, timed question navigation, submission, and result views all work from the UI.
- Quiz answers and completion state survive refresh in the same browser.
- The app can be installed and started using README commands and can produce a static Vite build.
- No service credentials or external data are needed.
