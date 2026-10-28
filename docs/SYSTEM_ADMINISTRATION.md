# System Administration module

## Purpose

Give the Admin role one sidebar group for system setup, access-profile previews, activity history, and exports while reusing the existing user, subject, classroom, and report workflows.

## Navigation and pages

Keep Overview as its own Admin destination. Add an expandable System Administration group with these pages:

- System Configuration: institution display name, browser-local timezone, current/default academic term, in-app alert preferences, and a display-only scheduled-job card. The backup action creates a full browser-local snapshot and offers JSON download.
- Academic Term Configuration: planned, current, and archived terms with start/end dates. The migrated term has optional dates; new terms require dates. Exactly one term is current. Making a term current changes the default for new classrooms and leaves existing classroom assignments unchanged.
- User Management: reuse the existing Users directory and actions.
- Role Management: show editable View, Create, Edit, Deactivate, and Export values for Student, Instructor, and Admin across Overview, System Configuration, Academic Terms, Users, Courses, Reports, and Audit Logs. This is a local demo matrix and does not enforce access.
- Course Management: reuse the Subjects and Classrooms directories as tabs.
- Enrollments: keep the existing enrollment directory available in the group so the current admin workflow is preserved.
- Audit Logs: show timestamped historical events that can be reconstructed from saved records and log new data changes made by Admin, Instructor, and Student. Do not invent timestamps or actor identities. Store action metadata only; omit answers, submission text, and feedback. Show unknown historical actors as “Not recorded.” Provide role/category/date filters and reverse-chronological pagination with eight rows per page, including when there is one page. Keep events until Reset Demo.
- System Reports: reuse existing CSV exports and add terms, role permissions, and audit logs.

## Browser-local behavior

Persist system settings, academic terms, role permissions, and audit events in the shared LMS localStorage record. Save a full snapshot to a separate browser-local key when an Admin requests a backup and before Reset Demo; make the latest snapshot downloadable as JSON. Reset Demo clears active settings and audit history but retains the latest backup. The scheduled-job card is a mock only; it never runs automatically and does not represent a real cron service.

## Acceptance

- The Admin sidebar keeps Overview separate and provides the seven requested System Administration destinations plus the existing Enrollments directory in an expandable group.
- Existing Users, Subjects, Classrooms, and CSV report actions remain available from their new destinations.
- Current-term selection updates the default for new classrooms without changing existing classroom terms.
- Settings and permissions survive navigation and reload through browser storage; permission values are visibly identified as non-enforced demo settings.
- Audit history includes timestamped historical records without fabricated data and records new persisted changes across roles without storing submission contents.
- Audit filters work together, pagination is always shown, and the newest eight matching events appear first.
- A requested backup can be downloaded; Reset Demo saves and retains a snapshot before clearing active demo data.
- The mock scheduled-job display clearly states that it is not an active scheduler.
- Existing role flows remain usable at desktop and mobile widths.

## Limits

There is no backend, authentication, authorization enforcement, off-device backup, or background scheduler. Browser storage can be cleared or reach quota limits; the audit log has no record cap by request and is cleared by Reset Demo. Role permissions and scheduled jobs are demonstrations only.
