import React from "react";
import {
  BookOpen,
  Check,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Settings,
  UsersRound,
} from "../../icons";

export default function AdminOverview({
  data,
  onNavigate,
  onOpenCreate,
  onResetDemo,
}) {
  const users = data.users || [];
  const activeUsers = users.filter((u) => u.status === "active");
  const students = activeUsers.filter((u) => u.role === "student");
  const instructors = activeUsers.filter((u) => u.role === "instructor");
  const classrooms = data.classrooms || [];
  const activeClassrooms = classrooms.filter((c) => c.status === "active");
  const subjects = data.subjects || [];
  const enrollments = (data.enrollments || []).filter((e) => e.status === "active");

  const unassignedRooms = activeClassrooms.filter((room) => !room.instructorId).length;
  const emptyRooms = activeClassrooms.filter(
    (room) => !enrollments.some((e) => e.classroomId === room.id)
  ).length;
  const needsAttention = unassignedRooms + emptyRooms;

  // Distribution by year level
  const yearDistribution = [1, 2, 3, 4].map((year) => {
    const classCount = activeClassrooms.filter(
      (room) =>
        Number(room.yearLevel) === year ||
        room.section?.toLowerCase().includes(`year ${year}`)
    ).length;
    return { year, classCount };
  });

  // Calculate setup completion
  const checklist = [
    {
      title: "Users",
      desc: "Add faculty and students",
      count: users.length,
      target: "Users",
      ready: users.length > 0,
      openType: "Users",
    },
    {
      title: "Subjects",
      desc: "Define the course catalog",
      count: subjects.length,
      target: "Subjects",
      ready: subjects.length > 0,
      openType: "Subjects",
    },
    {
      title: "Classrooms",
      desc: "Assign teachers and terms",
      count: classrooms.length,
      target: "Classrooms",
      ready: classrooms.length > 0,
      openType: "Classrooms",
    },
    {
      title: "Enrollments",
      desc: "Place students in classes",
      count: enrollments.length,
      target: "Enrollments",
      ready: enrollments.length > 0,
      openType: "Enrollments",
    },
  ];

  const readySteps = checklist.filter((item) => item.ready).length;
  const progressPct = Math.round((readySteps / checklist.length) * 100);

  // Instructor assignment summary
  const instructorLoad = instructors.map((teacher) => {
    const assigned = activeClassrooms.filter(
      (room) => room.instructorId === teacher.id
    );
    return {
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      classCount: assigned.length,
    };
  });

  return (
    <div className="admin-overview-container">
      {/* Administrative Hero Greeting */}
      <section className="admin-hero">
        <div className="admin-hero-content">
          <div>
            <span className="admin-hero-kicker">
              <i /> TMCC Administrative Console
            </span>
            <h2>Academic Operations Dashboard</h2>
            <p>
              Manage people, course offerings, classroom assignments, and student
              enrollments. Updates synchronize across instructor and student workspaces in real time.
            </p>
          </div>
          <div className="admin-term-badge">
            <strong>Fall 2026 Term</strong>
            <small>Active Academic Cycle</small>
          </div>
        </div>

        <div className="admin-quick-actions">
          <button
            type="button"
            className="admin-action-btn primary"
            onClick={() => onOpenCreate("Users")}
          >
            <UsersRound size={14} /> + Add Person
          </button>
          <button
            type="button"
            className="admin-action-btn"
            onClick={() => onOpenCreate("Subjects")}
          >
            <BookOpen size={14} /> + New Subject
          </button>
          <button
            type="button"
            className="admin-action-btn"
            onClick={() => onOpenCreate("Classrooms")}
          >
            <LayoutDashboard size={14} /> + Create Classroom
          </button>
          <button
            type="button"
            className="admin-action-btn"
            onClick={() => onOpenCreate("Enrollments")}
          >
            <ListChecks size={14} /> + Enroll Student
          </button>
          <button
            type="button"
            className="admin-action-btn danger"
            onClick={onResetDemo}
            title="Reset browser demo data to seed defaults"
          >
            <Settings size={14} /> Reset Demo Data
          </button>
        </div>
      </section>

      {/* KPI Stats Grid */}
      <div className="role-stat-grid">
        <article className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Active Community</span>
            <div className="admin-stat-icon">
              <UsersRound size={17} />
            </div>
          </div>
          <strong>{activeUsers.length}</strong>
          <div className="admin-stat-meta">
            <span>{students.length} students · {instructors.length} faculty</span>
            <span className="admin-badge-ok">Healthy</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Catalog Offerings</span>
            <div className="admin-stat-icon">
              <BookOpen size={17} />
            </div>
          </div>
          <strong>{subjects.length}</strong>
          <div className="admin-stat-meta">
            <span>{activeClassrooms.length} active class sections</span>
            <span className="admin-badge-ok">Accredited</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Total Enrollments</span>
            <div className="admin-stat-icon">
              <GraduationCap size={17} />
            </div>
          </div>
          <strong>{enrollments.length}</strong>
          <div className="admin-stat-meta">
            <span>Across all active sections</span>
            <span className="admin-badge-ok">Synchronized</span>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Operational Alerts</span>
            <div className="admin-stat-icon">
              <ClipboardCheck size={17} />
            </div>
          </div>
          <strong style={{ color: needsAttention ? "#ad5c19" : "#276954" }}>
            {needsAttention}
          </strong>
          <div className="admin-stat-meta">
            <span>
              {emptyRooms > 0
                ? `${emptyRooms} class${emptyRooms === 1 ? "" : "es"} without students`
                : "All classes populated"}
            </span>
            <span className={needsAttention ? "admin-badge-alert" : "admin-badge-ok"}>
              {needsAttention ? "Needs Review" : "Nominal"}
            </span>
          </div>
        </article>
      </div>

      {/* Two Column Layout: Setup Progress + Faculty & Operations */}
      <div className="admin-two-column">
        {/* Left: Setup Progress */}
        <section className="role-panel admin-setup">
          <div className="role-panel-head">
            <div>
              <h2>Academic Provisioning Checklist</h2>
              <p>Core setup required for teaching and grading workflows.</p>
            </div>
            <span className="role-soft-tag">
              {progressPct === 100 ? "Ready to Teach" : `${progressPct}% Configured`}
            </span>
          </div>

          <div className="admin-progress-header">
            <span>Configuration Readiness</span>
            <b>{readySteps} of {checklist.length} Complete ({progressPct}%)</b>
          </div>
          <div className="admin-progress-bar">
            <div
              className="admin-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="setup-list">
            {checklist.map((step, index) => (
              <button
                type="button"
                className="setup-row"
                key={step.title}
                onClick={() => onNavigate(step.target)}
              >
                <span className="setup-number">0{index + 1}</span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.desc}</small>
                </span>
                <b>{step.count}</b>
                <span className="setup-arrow">›</span>
              </button>
            ))}
          </div>

          {/* Academic Level Breakdown */}
          <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid #edf1ef" }}>
            <h3 style={{ fontSize: "12px", margin: "0 0 12px", color: "#32443b" }}>
              Classroom Distribution by Year Level
            </h3>
            <div className="admin-distribution-list">
              {yearDistribution.map((dist) => {
                const max = Math.max(...yearDistribution.map((d) => d.classCount), 1);
                const pct = Math.round((dist.classCount / max) * 100);
                return (
                  <div key={dist.year} className="admin-dist-row">
                    <span>Year {dist.year}</span>
                    <div className="admin-dist-bar">
                      <div
                        className="admin-dist-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <small>{dist.classCount} {dist.classCount === 1 ? "class" : "classes"}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Faculty Workload & Recent Operations */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Faculty Workload Card */}
          <section className="role-panel">
            <div className="role-panel-head">
              <div>
                <h2>Faculty Workload</h2>
                <p>Assigned course sections per instructor</p>
              </div>
              <button
                type="button"
                className="role-link-button"
                onClick={() => onNavigate("Users")}
              >
                View all faculty →
              </button>
            </div>

            <div className="role-table-wrap">
              <table className="role-table">
                <thead>
                  <tr>
                    <th>Instructor</th>
                    <th>Email</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {instructorLoad.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <strong>{teacher.name}</strong>
                      </td>
                      <td>{teacher.email}</td>
                      <td>
                        <span className="role-pill">
                          {teacher.classCount} {teacher.classCount === 1 ? "class" : "classes"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Operational Activity Stream */}
          <section className="role-panel">
            <div className="role-panel-head">
              <div>
                <h2>System Activity</h2>
                <p>Recent platform events and sync status</p>
              </div>
              <span className="role-soft-tag">
                <Check size={12} style={{ marginRight: "4px" }} /> Local Storage Synced
              </span>
            </div>

            <div className="admin-activity-list">
              <div className="admin-activity-item">
                <span className="admin-activity-dot user" />
                <div className="admin-activity-content">
                  <strong>{students.length} Student Accounts Active</strong>
                  <p>Alex Rivera and peers ready for assignment submissions.</p>
                </div>
                <span className="admin-activity-time">Now</span>
              </div>
              <div className="admin-activity-item">
                <span className="admin-activity-dot classroom" />
                <div className="admin-activity-content">
                  <strong>{activeClassrooms.length} Classrooms Online</strong>
                  <p>Sections configured with syllabus modules and materials.</p>
                </div>
                <span className="admin-activity-time">Active</span>
              </div>
              <div className="admin-activity-item">
                <span className="admin-activity-dot enrollment" />
                <div className="admin-activity-content">
                  <strong>{enrollments.length} Active Roster Enrollments</strong>
                  <p>Linked to student workspaces under TMCC Fall 2026.</p>
                </div>
                <span className="admin-activity-time">Live</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
