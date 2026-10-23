# Architecture and data flow

The app is a static Vite + React single-page prototype. `src/data.js` owns the sample courses, students, materials, assessments, and question sets. `src/App.jsx` owns the small view state machine and student interactions. `src/App.css`, `src/Details.css`, and `src/index.css` provide the responsive classroom UI.

There is no API layer. A localStorage adapter in the app loads and saves only quiz answers and completed assessment IDs. If browser storage is unavailable, the current session still works in memory. Reset demo data removes the prototype's storage key.

## Interaction flow

Home → Calendar, Tasks, or class → Stream / Classwork / Materials / People → assessment or material detail → timed questions → result. Calendar groups mock term dates, school events, and assessment deadlines by month and links assessment entries to details; replace the fictional schedule with official dates before real student use. Tasks groups assessment dates into upcoming, missing (past due and not completed), and done (submitted). The sidebar and breadcrumb controls return to earlier views. Assessment questions each receive an independent 60-second countdown; time remaining and answers are kept per question while navigating.

## Data and privacy

All people, class names, dates, and assessment content are fictional. Nothing leaves the browser. localStorage is scoped to this browser profile and is not a substitute for a secure student system.
