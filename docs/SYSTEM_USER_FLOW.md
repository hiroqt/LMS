# TMCC LMS end-to-end system flow

This chart connects the admin, instructor, and student journeys through the shared browser data model. It follows the lifecycle from initial setup to student coursework, submission, grading, and grade review. The student section follows [Student user flow](STUDENT_USER_FLOW.md): the student workspace opens at Today, and dashboard, calendar, tasks, classwork, search, and notifications lead into the same assessment or material details. All records are fictional prototype data; each role opens directly without sign-in.

**Standalone system flowchart:** [Open the scalable end-to-end SVG](flowcharts/tmcc-system-end-to-end-flow.svg). It follows the student chart's standard start/end, process, decision, and connector notation.

```mermaid
flowchart TD
    OPEN([Open TMCC LMS]) --> ROLE{Choose a workspace}

    subgraph ADMIN[Admin setup]
      A1[Manage users, subjects, classrooms, and enrollments] --> A2{Fields, unique values, and links valid?}
      A2 -->|No| AERR[Show error; keep editing] --> A1
      A2 -->|Yes| A3[Save to shared browser data]
      A3 --> A4{Remove a record?}
      A4 -->|Referenced| A5[Deactivate; preserve history]
      A4 -->|Unused| A6[Confirm deletion]
    end

    subgraph INSTRUCTOR[Instructor course preparation and grading]
      I1[Open assigned classroom] --> I2[Manage enrollment and gradebook settings]
      I2 --> I3[Create modules, materials, activities, and exams]
      I3 --> I4[Set due, resubmission, timer, attempt, scoring, and answer review rules]
      I4 --> I5[Save coursework]
      I6[Review activity submissions and exam essays] --> I7[Enter score, essay grade, and optional feedback]
      I7 --> I8[Save grade and submission updates]
    end

    subgraph STUDENT[Student journey · follows Student user flow]
      S1([Today dashboard]) --> S2{Choose a route}
      S2 -->|Class / active class| S3[Class Stream, Classwork, Materials, or People]
      S2 -->|Tasks / due summary| S4[Filter assessments by due status]
      S2 -->|Calendar / week activities| S5[Browse dates and upcoming work]
      S2 -->|Search / notification| S6[Open matching class, assessment, or material]
      S3 -->|Assessment| S7[Assessment details]
      S4 --> S7
      S5 -->|Assessment entry| S7
      S6 -->|Assessment| S7
      S3 -->|Material| SM[Read material; review status lasts this session]
      S6 -->|Material| SM
      S7 --> S8{Questions available and attempts remain?}
      S8 -->|No| S9[Show attempt limit]
      S8 -->|Yes| S10[Start timed attempt]
      S10 --> S11[Answer question; save answer in this browser]
      S11 -->|Next / previous / question list| S10
      S11 -->|Timer expires| S12[Advance; final timeout submits]
      S11 -->|Review and submit| S13{Confirm submission?}
      S10 -->|Submit| S13
      S13 -->|Keep working| S10
      S13 -->|Confirm| S14[Save completion; score objective answers]
      S12 -->|Final question| S14
      S14 --> S15{Essay grading required?}
      S15 -->|Yes| S16[Await instructor grade and feedback]
      S15 -->|No| S17[Show result and permitted answer review]
      S16 --> S17
      S17 --> S18[Open Grades or exam attempt review]
    end

    ROLE -->|Admin| A1
    ROLE -->|Instructor| I1
    ROLE -->|Student| S1
    A3 --> SHARED[(Shared browser-local LMS data)]
    A5 --> SHARED
    A6 --> SHARED
    SHARED --> I1
    I5 --> S1
    SHARED -->|Enrollment / class data| S1
    S14 -->|Activity submission or essay pending| I6
    S16 --> I6
    I8 --> GB[Update illustrative category averages and weighted overall]
    GB --> S17
    S14 -->|Objective result| S17
```

## End-to-end stages

- **Provisioning:** Admin creates or edits users, subjects, classrooms, and enrollments. Valid changes are shared in browser storage; invalid forms remain open. Referenced records are deactivated to preserve history.
- **Course preparation:** An assigned instructor manages classroom enrollment and gradebook settings, then creates modules, materials, activities, and exams. Activities configure due, late, and resubmission behavior. Exams configure question types, timers, attempts, scoring, and answer review.
- **Student access:** A student sees active enrollments or joins with a classroom code. The student can open materials, submit an activity filename and comment, or take an available exam attempt.
- **Submission and grading:** Activity work and exam essays enter the instructor's review queue. Objective exam questions are scored locally. Saving instructor grades and feedback updates the same browser data the student reads.
- **Results:** The student reviews activity grades, exam scores, feedback, and answers permitted by the exam's review policy. The overall is illustrative and uses graded work only.

## Prototype boundary

The role picker is not authentication or authorization. Data is stored in one browser's localStorage, with no backend, actual file upload, audit trail, or cross-device sync. Exam answers and correct answers are available in client data; timers and review settings are demonstration behavior, not security controls. Use fictional data only.

Implementation references: [app routing and shared state](../src/main.jsx), [student workspace](../src/Student.jsx), [instructor workspace](../src/Instructor.jsx), [admin workspace](../src/Admin.jsx), [shared browser data and grading](../src/lmsData.js), and [system architecture](ARCHITECTURE.md).
