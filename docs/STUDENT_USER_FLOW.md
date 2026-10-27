# Student user flow

This chart describes the student-facing flows implemented in the TMCC LMS prototype. Begin at **Today**; the prototype has no sign-in screen or server account. All names, classes, events, and assessments are fictional demo data.

**Standalone flowchart image:** [Open the scalable SVG](flowcharts/tmcc-student-user-flow.svg). It uses standard process, decision, start/end, and letter-connector symbols.

```mermaid
flowchart TD
    A([Open TMCC LMS]) --> B[Today dashboard]

    B --> C{Choose a workspace action}
    C -->|News and announcements| N[Switch dashboard to News & announcements]
    N --> N1[Read teacher announcements]
    N --> N2[Read school announcements]
    N --> N3[Browse featured school announcement]
    N3 -->|View calendar| CAL

    C -->|Academic calendar icon| CAL[Academic calendar]
    C -->|Tasks| T[Tasks list]
    C -->|My classes| CL[Choose a class]
    C -->|Search| S[Search classes, assessments, and materials]
    C -->|Notifications bell| NO[Open upcoming assessment reminder]
    C -->|Profile menu| P[Choose Reset demo data]
    C -->|Due this week summary| TW[Tasks: Due this week selected]
    C -->|Assessment done summary| TD[Tasks: Done selected]
    C -->|Week activities summary| CAL
    C -->|Active class| CL
    C -->|Assessment shortcut| AD
    C -->|Material shortcut| MD

    CAL --> CAL1[Browse months or this week's agenda]
    CAL1 --> CAL2{Select a date entry}
    CAL2 -->|Assessment deadline| AD
    CAL2 -->|Academic event| CAL1

    T --> T1[Choose filter: Due soon, Due this week, Missing, or Done]
    T1 --> T2[Browse matching assessments]
    TW --> T2
    TD --> T2
    T2 -->|Open an assessment| AD
    T2 -->|No matching work| T1

    CL --> CL1[Open class Stream]
    CL1 --> CL2{Choose class tab}
    CL2 -->|Stream| STREAM[Read class updates and open linked work or material]
    CL2 -->|Classwork| CW[Browse or filter Quiz, Long Quiz, and Exam]
    CL2 -->|Materials| MAT[Browse learning materials]
    CL2 -->|People| PEOPLE[Search the student roster]
    STREAM -->|Open assessment| AD
    STREAM -->|Open material| MD
    CW -->|Open assessment| AD
    MAT -->|Open material| MD
    PEOPLE -->|Choose another class or workspace item| CL

    S --> S1{Choose a result}
    S1 -->|Class| CL
    S1 -->|Assessment| AD
    S1 -->|Material| MD
    NO --> AD

    AD[Assessment details] -->|Back to classwork| CW
    AD -->|Start assessment or practice again| Q[Timed question flow]
    Q --> Q1[Choose an answer; it saves in this browser]
    Q1 -->|Previous, next, or question list| Q
    Q1 -->|Timer expires| Q2[Advance to next question]
    Q1 -->|Submit assessment| CONF{Confirm submission}
    Q -->|Review and submit| CONF
    Q -->|Exit assessment| AD
    Q -->|Previous, next, or question list| Q
    CONF -->|Keep working| Q
    CONF -->|Confirm submit| R[Result and answer review]
    Q2 -->|Last question times out| R
    R -->|Back to classwork| CW
    R -->|Practice again| Q

    MD[Material detail] -->|Read and optionally mark reviewed| MD1[Review status for this session]
    MD1 -->|Back to class| MAT

    P -->|Reset immediately| B
```

## How to read this flow

- **Today** is the starting point and the workspace breadcrumb returns to it. The dashboard can switch between Overview and News & announcements; its due, completed, activity, class, assessment, and material shortcuts open the corresponding workspace path.
- The **academic calendar** is opened from the top bar or the dashboard. Assessment entries lead to assessment details; school events are informational entries.
- **Tasks** groups assessments by due status. Selecting an assessment opens the same details view as calendar, notifications, search, and classwork.
- A **class** opens on Stream. Its tabs provide Stream, Classwork, Materials, and People. Assessment and material detail back buttons return to their matching class tab.
- During an assessment, each question has its own 60-second timer. Answers save to browser localStorage as the student works. Timeouts advance automatically; the final timeout submits. Manual submission asks for confirmation before showing the result.
- Assessment completion and answers persist in this browser. Material review state lasts only for the current app session. Reset demo data clears the saved assessment progress and returns to Today.

## Prototype boundaries

There is no authentication, server save, or cross-device sync. “Submit” records a local demo completion and displays a locally calculated result; instructor-created exams and saved instructor feedback are shared through browser storage. The academic calendar and class content are sample data, not an official TMCC schedule.

Implementation references: [workspace interactions](../src/App.jsx), [fictional classes and assessment data](../src/data.js), and [project scope](PROJECT_BRIEF.md).
