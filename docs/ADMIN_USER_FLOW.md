# Admin user flow

This flow describes the comprehensive administrative workspace in the TMCC LMS prototype. Open **Admin** from the top-bar role selector or navigate directly to `/admin`; there is no sign-in screen. All records are browser-local mock data synchronized across the Student, Instructor, and Admin workspaces.

**Standalone flowchart:** [Open the admin flow SVG](flowcharts/tmcc-admin-user-flow.svg).

```mermaid
flowchart TD
    START([Open /admin or Switch to Admin]) --> SHELL[Admin Workspace Shell]
    SHELL --> TOP[Top Bar: Breadcrumbs, Global Search, Notifications, Role Switcher]
    SHELL --> SIDEBAR[Sidebar Navigation: Overview, Users, Subjects, Classrooms, Enrollments]
    
    TOP -->|Global search select| DIRECTORY
    TOP -->|Notification select| CL_NAV[Navigate to Classrooms]
    TOP -->|Switch role| OTHER_ROLE[Switch to Student or Instructor]
    
    SIDEBAR -->|Overview| OVERVIEW[Admin Operations Dashboard]
    SIDEBAR -->|Users| USERS_DIR[Users Directory]
    SIDEBAR -->|Subjects| SUBJ_DIR[Subjects Directory]
    SIDEBAR -->|Classrooms| CLASS_DIR[Classrooms Directory]
    SIDEBAR -->|Enrollments| ENROLL_DIR[Enrollments Directory]
    
    subgraph OVERVIEW_FLOW["Overview Dashboard View"]
      OVERVIEW --> HERO["Hero Header: Fall 2026 Term Status"]
      HERO --> QA{Choose Quick Action}
      QA -->|+ Add Person| F_USER[Open New User Form]
      QA -->|+ New Subject| F_SUBJ[Open New Subject Form]
      QA -->|+ Create Classroom| F_CLASS[Open New Classroom Form]
      QA -->|+ Enroll Student| F_ENROLL[Open New Enrollment Form]
      QA -->|Reset Demo Data| RESET_CONF{Confirm Reset?}
      RESET_CONF -->|Yes| SEED[Restore Seed Data to localStorage]
      RESET_CONF -->|No| OVERVIEW

      OVERVIEW --> KPIS["KPI Cards: Active Community, Catalog, Enrollments, Alerts"]
      OVERVIEW --> CHECKLIST["Provisioning Checklist: 4 Setup Steps & Readiness %"]
      CHECKLIST -->|Click step 01-04| DIRECTORY
      OVERVIEW --> DISTRIB["Year Level Distribution: Year 1-4 Class Counts"]
      OVERVIEW --> WORKLOAD["Faculty Workload: Assigned Classes per Instructor"]
      WORKLOAD -->|View all faculty| USERS_DIR
      OVERVIEW --> ACTIVITY["Live System Activity: Real-Time Audit Log"]
    end

    subgraph DIRECTORY_FLOW["Directory & Records Management"]
      DIRECTORY[Management Directory View]
      USERS_DIR --> DIRECTORY
      SUBJ_DIR --> DIRECTORY
      CLASS_DIR --> DIRECTORY
      ENROLL_DIR --> DIRECTORY

      DIRECTORY --> FILTER_BAR[Filter & Search Bar]
      FILTER_BAR -->|Role Pills: All / Student / Instructor / Admin| FILTER_APPLY[Filter Table Rows]
      FILTER_BAR -->|Year Pills: All / Year 1-4| FILTER_APPLY
      FILTER_BAR -->|Classroom Dropdown Selector| FILTER_APPLY
      FILTER_BAR -->|Status Pills: All / Active / Inactive| FILTER_APPLY
      FILTER_BAR -->|Search input| FILTER_APPLY
      FILTER_APPLY --> TABLE[Interactive Records Table]

      TABLE -->|+ Add Record Button| OPEN_FORM[Open Creation Form]
      TABLE -->|Click record title / code| DETAIL_MODAL[Open Record Detail Modal]
      TABLE -->|Row Action: Deactivate / Activate| TOGGLE_STATUS[Toggle Active / Inactive Status]
      TABLE -->|Row Action: Delete unused subject| DELETE_REC[Permanently Delete Subject]

      DETAIL_MODAL --> VIEW_DETAILS[Inspect Profile, Enrolled Classes, Taught Sections, or Classroom Rosters]
      VIEW_DETAILS -->|Close| TABLE
    end

    subgraph FORM_FLOW["Validation & Persistence"]
      F_USER --> OPEN_FORM
      F_SUBJ --> OPEN_FORM
      F_CLASS --> OPEN_FORM
      F_ENROLL --> OPEN_FORM

      OPEN_FORM --> SUBMIT[Submit Form]
      SUBMIT --> VALIDATE{Validate Inputs}
      VALIDATE -->|Empty required fields| ERR[Display error: Field required]
      VALIDATE -->|Duplicate email or code| ERR
      VALIDATE -->|Student already enrolled in class| ERR
      ERR --> OPEN_FORM

      VALIDATE -->|Valid| SAVE_DATA[Save Record to Shared State]
      TOGGLE_STATUS --> SAVE_DATA
      DELETE_REC --> SAVE_DATA
      SEED --> SAVE_DATA

      SAVE_DATA --> SYNC[(Local Storage: tmcc-lms-roles-v1)]
      SYNC --> EVENT[Dispatch tmcc-lms-data Event]
      EVENT --> NOTIFY[Instructor and Student Workspaces Read Live Updates]
    end
```

## How to read this flow

### 1. Operations Overview (`AdminOverview.jsx`)
- **Hero Header & Quick Actions:** Displays current academic cycle status (`Fall 2026 Term · Active Academic Cycle`) and direct action buttons to quickly create people, subjects, classrooms, or enrollments, as well as a one-click demo data reset.
- **KPI Metrics:**
  - **Active Community:** Total active accounts with student and instructor counts.
  * **Catalog Offerings:** Accredited subject count and active class sections.
  * **Total Enrollments:** Roster count across active sections.
  * **Operational Alerts:** Highlights empty classrooms or unassigned instructors.
- **Academic Provisioning Checklist:** 4-step configuration progress (`Users` → `Subjects` → `Classrooms` → `Enrollments`) displaying completion percentage and direct jump links.
- **Classroom Distribution by Year Level:** Visual bar chart showing active class density across Year 1, Year 2, Year 3, and Year 4.
- **Faculty Workload:** Real-time table displaying course sections assigned per instructor.
- **Live System Activity:** Audit log reflecting user counts, active classrooms, and enrollment sync.

### 2. Directory & Records Management (`AdminDirectory.jsx`)
- **Users Directory:** Search and filter by role (`Students`, `Instructors`, `Admins`) and status (`Active`, `Inactive`). Clicking a user opens a modal displaying their profile, enrolled courses (for students), or assigned courses (for instructors).
- **Subjects Directory:** Academic catalog view with subject codes, titles, descriptions, and linked class section counts. Unreferenced subjects can be deleted; active subjects in use are protected.
- **Classrooms Directory:** Filter by Year Level (`Year 1` to `Year 4`) and status. Displays enrollment codes, assigned instructors, and enrolled student totals. Clicking a classroom opens its detail modal with the full student roster.
- **Enrollments Directory:** Filter by classroom selector and status. Displays enrolled students, sections, and terms.
- **Status Toggling:** Allows switching records between `active` and `inactive` states dynamically.

### 3. Data Integrity & Validation
- **Users:** Requires full name and unique email address.
- **Subjects:** Requires unique uppercase subject code and title.
- **Classrooms:** Requires subject selection, section name, and unique enrollment code. Generates starter syllabus module automatically.
- **Enrollments:** Requires classroom and student selection; blocks duplicate active enrollments.
- **Referenced Deactivation:** Records referenced by coursework, submissions, or classes are soft-deactivated to preserve history rather than deleted.

### 4. Cross-Role Reactivity & Storage
All actions persist to `localStorage` under `tmcc-lms-roles-v1` and trigger the `tmcc-lms-data` event via `useLmsData()`. Created subjects and classrooms immediately become available to instructors in `/instructor` and enrolled classes become visible to students in `/student`.

---

Implementation references:
- [Admin workspace shell](../src/roles/admin/Admin.jsx)
- [Admin overview dashboard](../src/roles/admin/AdminOverview.jsx)
- [Admin directory & modals](../src/roles/admin/AdminDirectory.jsx)
- [Admin styling](../src/roles/admin/adminDashboard.css)
- [Shared role data and seeds](../src/roles/shared/lmsData.js)
- [Local storage driver](../src/roles/shared/storage.js)

---

Implementation references:
- [Admin workspace shell](../src/roles/admin/Admin.jsx)
- [Admin overview dashboard](../src/roles/admin/AdminOverview.jsx)
- [Admin directory & modals](../src/roles/admin/AdminDirectory.jsx)
- [Admin styling](../src/roles/admin/adminDashboard.css)
- [Shared role data and seeds](../src/roles/shared/lmsData.js)
- [Local storage driver](../src/roles/shared/storage.js)

