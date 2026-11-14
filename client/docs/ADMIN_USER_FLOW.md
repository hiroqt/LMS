# Admin user flow

This flow documents the complete Admin journey in the TMCC LMS prototype: open the workspace, review the dashboard, configure the institution and academic term, manage people and courses, inspect audit history and reports, back up or reset demo data, and then return to Admin or leave the workspace. The workspace has no sign-in or authorization step. All records are fictional and browser-local.

The Mermaid diagram below is the editable end-to-end Admin flow.

```mermaid
flowchart TD
    START([Open /admin or switch to Admin]) --> SHELL[Admin workspace shell]
    SHELL --> OVERVIEW[Overview: student and faculty totals; active courses and users; learning analytics; student, course, and system activity; date filter]
    OVERVIEW --> ROUTE{Choose a page or dashboard action}

    ROUTE -->|Footer Settings| SETTINGS[System Configuration from sidebar footer]
    SETTINGS --> CONFIG[Set institution name, timezone, current term, and in-app alerts]
    SETTINGS --> BACKUP{Create backup or reset demo?}
    BACKUP -->|Create backup| SNAPSHOT[Save full browser-local snapshot]
    SNAPSHOT --> DOWNLOAD[Optionally download JSON]
    BACKUP -->|Reset demo| RESET{Confirm reset?}
    RESET -->|No| SETTINGS
    RESET -->|Yes| SNAPSHOT_RESET[Save and retain pre-reset snapshot]
    SNAPSHOT_RESET --> SEED[Restore initial demo records]
    SETTINGS -. scheduled backup card is display-only .-> CRON[No background job runs]

    ROUTE -->|Academic Term Configuration direct link| TERMS[Create or edit a term; set current; archive]
    TERMS --> TERM_RULES[Validate required fields and dates; one current term]
    TERM_RULES -->|Valid| TERMS_SAVE[Save term settings locally; existing classroom terms stay unchanged]
    TERM_RULES -->|Invalid| TERM_ERROR[Show validation; keep editing]
    TERM_ERROR --> TERMS

    ROUTE -->|People & access| PEOPLE{Choose User Management or Role Management}
    PEOPLE -->|Users| USERS[Search, filter, paginate; add, edit, activate, or deactivate a user]
    USERS --> USER_VALIDATE{Required fields and unique email valid?}
    USER_VALIDATE -->|No| USER_ERROR[Show validation; keep editing]
    USER_ERROR --> USERS
    USER_VALIDATE -->|Yes| USER_SAVE[Save user change]
    PEOPLE -->|Roles| ROLES[Edit Student, Instructor, and Admin module/action matrix]
    ROLES --> ROLE_SAVE[Save visual demo permissions; navigation remains unenforced]

    ROUTE -->|Courses| COURSE{Choose Course Management or Enrollments}
    COURSE -->|Course Management| COURSE_TAB{Choose tab}
    COURSE_TAB -->|Subjects| SUBJECTS[Search, filter, paginate; add, edit, activate, or delete an unused subject]
    COURSE_TAB -->|Classrooms| CLASSROOMS[Search, filter, paginate; add, edit, activate, or deactivate a classroom]
    COURSE -->|Enrollments| ENROLL[Search, filter, paginate; add or update a student enrollment]
    SUBJECTS --> COURSE_VALIDATE{Fields, unique values, and links valid?}
    CLASSROOMS --> COURSE_VALIDATE
    ENROLL --> COURSE_VALIDATE
    COURSE_VALIDATE -->|No| COURSE_ERROR[Show validation; keep editing]
    COURSE_ERROR --> COURSE_TAB
    COURSE_VALIDATE -->|Yes| COURSE_SAVE[Save course or enrollment change]

    ROUTE -->|Oversight| OVERSIGHT{Choose Audit Logs or System Reports}
    OVERSIGHT -->|Audit Logs| AUDIT[Review timestamped changes across roles; filter; paginate; export CSV]
    OVERSIGHT -->|System Reports| REPORTS[Export users, courses, rosters, submissions/grades, terms, role matrix, or audit CSV]

    CONFIG --> SHARED[(Shared browser-local LMS data)]
    TERMS_SAVE --> SHARED
    USER_SAVE --> SHARED
    ROLE_SAVE --> SHARED
    COURSE_SAVE --> SHARED
    SEED --> SHARED
    SHARED --> AUDIT_EVENT[Append metadata-only audit event for meaningful data changes]
    SHARED --> ROLE_SYNC[Updated records become visible in Student and Instructor workspaces]
    SHARED -->|Read current records| AUDIT
    SHARED -->|Read export records| REPORTS
    SHARED -->|Snapshot source| SNAPSHOT
    AUDIT_EVENT --> CONTINUE{Continue Admin work?}
    ROLE_SYNC --> CONTINUE
    AUDIT --> CONTINUE
    REPORTS --> CONTINUE
    DOWNLOAD --> CONTINUE
    TERMS_SAVE --> CONTINUE
    ROLE_SAVE --> CONTINUE
    COURSE_SAVE --> CONTINUE
    CONTINUE -->|Yes| OVERVIEW
    CONTINUE -->|No: switch role or leave| END([End Admin session])
```

## Flow stages

1. **Enter and orient:** Admin opens `/admin` or switches into the Admin workspace. Overview presents the shared-data counts, learning analytics, weekly student/course/system activity, recent event feed, and date range controls. Dashboard actions can open the matching creation form.
2. **Configure the system:** Admin updates browser-local institution defaults and alert preferences, manages academic terms, or creates/downloads a full JSON snapshot. The scheduled-backup panel is a display-only mock; it does not run while the browser is closed or in the background. Reset requires confirmation, saves a pre-reset snapshot, and then restores the initial demo records.
3. **Manage people and access:** User Management supports search, role/status filtering, pagination, and user create/edit/activate/deactivate. Role Management edits a local visual permission matrix only; it does not enforce access.
4. **Manage courses:** Course Management has Subjects and Classrooms tabs; Enrollments is its own page. These directories support their available search/filter/pagination and existing create/edit/status actions. Form validation blocks invalid links and duplicate values. Referenced records are deactivated when needed to preserve history; unused subjects may be deleted.
5. **Review and report:** Audit Logs show timestamped change metadata across roles with filters, pagination, and CSV export. System Reports export the available shared records as CSV. Audit summaries do not include answers, submission text, comments, or feedback.
6. **Persist and finish:** Meaningful changes are stored under the shared browser-local LMS data and append metadata-only audit events. Student and Instructor workspaces read the same updated records. Admin can return to Overview for another task or switch roles/leave the workspace.

## Prototype boundary

The role selector is not authentication. Data, settings, terms, role-matrix values, audit history, and backups stay in this browser; there is no server sync, enforced permission system, external integration, automatic scheduled job, or off-device backup unless the downloaded JSON is saved elsewhere. Audit history is reset with demo data after its pre-reset snapshot is saved.

Implementation references: [Admin workspace](../src/roles/admin/Admin.jsx), [Admin sidebar shell](../src/roles/shared/RoleWorkspace.jsx), [shared Admin data and audit/backup seam](../src/roles/shared/systemAdministrationData.js), [Admin directory](../src/roles/admin/AdminDirectory.jsx), and [storage](../src/roles/shared/storage.js).
