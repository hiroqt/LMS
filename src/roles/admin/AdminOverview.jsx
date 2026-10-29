import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Settings,
  UsersRound,
} from "../../icons";
import { buildAdminDashboard } from "./adminDashboardData";

function readLegacyCompletions() {
  try {
    return JSON.parse(window.localStorage.getItem("gclass-student-workspace-v1") || "{}").completed || [];
  } catch {
    return [];
  }
}

const ranges = [
  ["term", "Current term"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 90 days"],
  ["all", "All time"],
];

export default function AdminOverview({ data, onNavigate, onOpenCreate, onResetDemo }) {
  const [chartsLoading, setChartsLoading] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [term, setTerm] = useState(() => data.classrooms?.find((room) => room.status === "active")?.term || "all");
  const [range, setRange] = useState("term");
  const terms = [...new Set((data.classrooms || []).map((room) => room.term).filter(Boolean))];
  const selectedTerm = term !== "all" && !terms.includes(term) ? terms[0] || "all" : term;
  const model = useMemo(() => buildAdminDashboard(data, { term: selectedTerm, range, legacyCompleted: readLegacyCompletions() }), [data, selectedTerm, range]);
  const activeStudents = (data.users || []).filter((user) => user.role === "student" && user.status === "active").length;
  const activeFaculty = (data.users || []).filter((user) => user.role === "instructor" && user.status === "active").length;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setTimeout(() => setChartsLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  const cards = [
    { label: "Total Students", value: model.metrics.totalStudents, note: `${activeStudents} active · ${model.metrics.totalStudents - activeStudents} inactive`, action: "View students", target: "Users", role: "student", icon: <UsersRound size={19} /> },
    { label: "Total Faculty", value: model.metrics.totalFaculty, note: `${activeFaculty} active · ${model.metrics.totalFaculty - activeFaculty} inactive`, action: "View faculty", target: "Users", role: "instructor", icon: <GraduationCap size={19} /> },
    { label: "Active Courses", value: model.metrics.activeCourses, note: `Class sections across ${model.metrics.totalSubjects} subjects`, action: "View classrooms", target: "Classrooms", icon: <BookOpen size={19} /> },
    { label: "Active Users", value: model.metrics.activeUsers, note: `of ${(data.users || []).length} user accounts`, action: "Manage users", target: "Users", icon: <UsersRound size={19} /> },
  ];

  const scopedRooms = (data.classrooms || []).filter((room) => selectedTerm === "all" || room.term === selectedTerm);
  const roomStatuses = [...new Set(["active", "inactive", ...scopedRooms.map((room) => room.status || "unspecified")])];
  const { records: recentEvents, isSample: recentActivityIsSample } = model.recentActivity;

  return (
    <div className="admin-overview-container">
      <section className="admin-hero">
        <div className="admin-hero-content">
          <div>
            <span className="admin-hero-kicker">ADMINISTRATIVE OVERVIEW</span>
            <h2>Academic overview</h2>
            <p>People, courses, and learning activity across the current reporting scope.</p>
          </div>
          <div className="admin-term-badge">
            <strong>{selectedTerm === "all" ? "All academic terms" : selectedTerm}</strong>
            <small>Current reporting scope</small>
          </div>
        </div>

        <div className="admin-quick-actions" aria-label="Administrative actions">
          <button type="button" className="admin-action-btn primary" onClick={() => onOpenCreate("Users")}><UsersRound size={16} /> + Add Person</button>
          <button type="button" className="admin-action-btn" onClick={() => onOpenCreate("Subjects")} title="Create a new subject"><BookOpen size={16} /> + Create Subject</button>
          <button type="button" className="admin-action-btn" onClick={() => onOpenCreate("Classrooms")}><LayoutDashboard size={16} /> + Create Classroom</button>
          <button type="button" className="admin-action-btn" onClick={() => onOpenCreate("Enrollments")}><ListChecks size={16} /> + Enroll Student</button>
          <button type="button" className="admin-action-btn danger" onClick={onResetDemo} title="Reset browser demo data to seed defaults"><Settings size={16} /> Reset Demo Data</button>
        </div>
      </section>

      <div className="role-stat-grid admin-kpi-grid">
        {cards.map((card) => <button type="button" className="admin-stat-card" key={card.label} onClick={() => onNavigate(card.target, card.role)} aria-label={`${card.label}: ${card.value}. ${card.action}`}>
          <span className="admin-stat-top"><span>{card.label}</span><span className="admin-stat-icon">{card.icon}</span></span>
          <strong>{card.value}</strong>
          <span className="admin-stat-meta">{card.note}</span>
          <span className="admin-stat-action">{card.action}<ArrowRight size={15} aria-hidden="true" /></span>
        </button>)}
      </div>

      <div className="admin-insights-toolbar">
        <div className="admin-insights-toolbar-intro">
          <h3>Activity & Analytics</h3>
          <p>
            <CircleHelp size={14} aria-hidden="true" />
            Activity and completion data uses timestamped records available in this demo.
          </p>
        </div>
        <div className="admin-insights-controls" role="group" aria-label="Activity scope filters">
          <div className="admin-filter-group">
            <label htmlFor="admin-term-select" className="admin-filter-label">
              Academic term
            </label>
            <div className="admin-select-wrapper">
              <CalendarDays size={15} className="admin-select-icon-left" aria-hidden="true" />
              <select
                id="admin-term-select"
                aria-label="Filter by academic term"
                value={selectedTerm}
                onChange={(event) => setTerm(event.target.value)}
              >
                <option value="all">All terms</option>
                {terms.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
              <ChevronDown size={14} className="admin-select-caret" aria-hidden="true" />
            </div>
          </div>

          <div className="admin-filter-group">
            <label htmlFor="admin-range-select" className="admin-filter-label">
              Date range
            </label>
            <div className="admin-select-wrapper">
              <Clock3 size={15} className="admin-select-icon-left" aria-hidden="true" />
              <select
                id="admin-range-select"
                aria-label="Filter by date range"
                value={range}
                onChange={(event) => setRange(event.target.value)}
              >
                {ranges.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <ChevronDown size={14} className="admin-select-caret" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div className="admin-insights-grid">
        <section className="role-panel admin-insight-panel admin-course-panel">
          <PanelHeading title="Course Activity" detail="Weekly activity" count={model.events.course.length} />
          <WeeklyChart weeks={model.weeklyActivity.course} sample={[3, 5, 4, 7, 5, 8, 6, 9]} loading={chartsLoading} label="Course activity" variant="area" />
          <button type="button" className="role-link-button" onClick={() => onNavigate("Classrooms")}>View classrooms →</button>
        </section>

        <section className="role-panel admin-insight-panel admin-status-panel">
          <PanelHeading title="Classroom status" detail="Selected academic term · all dates" />
          <div className="admin-status-total"><strong>{scopedRooms.length}</strong><span>classroom sections</span></div>
          <div className="admin-status-list">{roomStatuses.map((status) => {
            const count = scopedRooms.filter((room) => (room.status || "unspecified") === status).length;
            return <div className="admin-status-row" key={status}>
              <div><span>{status}</span><strong>{count}</strong></div>
              <meter min="0" max={Math.max(1, scopedRooms.length)} value={count} aria-label={`${status} classrooms: ${count} of ${scopedRooms.length}`} />
            </div>;
          })}</div>
          <p className="admin-insight-note">Current browser-local records. Date filters apply to activity charts and recent activity.</p>
          <button type="button" className="role-link-button" onClick={() => onNavigate("Classrooms")}>Manage classrooms →</button>
        </section>

        <section className="role-panel admin-recent-panel">
          <PanelHeading title="Recent workspace activity" detail={recentActivityIsSample ? "Sample activity · fictional preview because this scope has no timestamped records" : "Latest records in the selected scope · not an audit log"} />
          <div className="role-table-wrap"><table className="role-table">
            <thead><tr><th scope="col">Activity</th><th scope="col">Details</th><th scope="col">Record type</th><th scope="col">Date</th></tr></thead>
            <tbody>{recentEvents.length ? recentEvents.map((event, index) => <tr key={`${event.type}-${event.date}-${index}`}>
              <td><strong>{event.title}</strong></td><td>{event.detail}</td><td><span className="role-soft-tag">{event.type}</span></td>
              <td><time dateTime={event.date}>{new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></td>
            </tr>) : <tr><td colSpan="4">No timestamped activity in this scope. Create a record or select another reporting range.</td></tr>}</tbody>
          </table></div>
        </section>

        <section className="role-panel admin-insight-panel admin-system-panel">
          <PanelHeading title="System Activity" detail="Weekly changes" count={model.events.system.length} />
          <WeeklyChart weeks={model.weeklyActivity.system} sample={[4, 3, 6, 5, 7, 4, 8, 6]} loading={chartsLoading} label="System activity" variant="line" />
          <EventList events={model.events.system.slice(0, 3)} />
          <p className="admin-insight-note">This is a recent activity summary, not an audit log.</p>
        </section>

        <section className="role-panel admin-insight-panel admin-student-panel">
          <PanelHeading title="Student Activity" detail="Weekly activity" count={model.events.students.length} />
          <WeeklyChart weeks={model.weeklyActivity.students} sample={[2, 4, 3, 6, 5, 7, 6, 10]} loading={chartsLoading} label="Student activity" variant="bar" />
          <EventList events={model.events.students.slice(0, 3)} compact />
        </section>

        <section className="role-panel admin-insight-panel admin-learning-panel">
          <PanelHeading title="Total Students" detail="Illustrative demo breakdown by sex" />
          <StudentDemographicsChart total={model.metrics.totalStudents} loading={chartsLoading} />
          <button type="button" className="role-link-button" onClick={() => onNavigate("Users")}>View students →</button>
        </section>
      </div>
    </div>
  );
}

function PanelHeading({ title, detail, count }) {
  return <div className="role-panel-head"><div><h2>{title}</h2><p>{detail}</p></div>{count !== undefined && <span className="role-soft-tag">{count} records</span>}</div>;
}

function EventList({ events, compact = false }) {
  return events.length ? <div className={`admin-feed ${compact ? "is-compact" : ""}`}>
    {events.map((event, index) => <article className="admin-feed-item" key={`${event.type}-${event.date}-${index}`}>
      <span className={`admin-activity-dot ${event.type}`} />
      <div><strong>{event.title}</strong><p>{event.detail}</p></div>
      <time dateTime={event.date}>{new Date(event.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time>
    </article>)}
  </div> : null;
}

function WeeklyChart({ weeks, sample, loading, label, variant }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const hasEvents = weeks.some((week) => week.count > 0);
  const values = hasEvents ? weeks.map((week) => week.count) : sample;
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => ({ x: 30 + index * 128.57, y: 360 - value / maximum * 290, value }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1).x},360 L${points[0].x},360 Z`;
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const tooltipX = activePoint ? Math.min(650, Math.max(30, activePoint.x - 140)) : 0;
  const tooltipY = activePoint ? Math.max(5, activePoint.y - 92) : 0;
  return <div className="admin-chart-wrap" aria-busy={loading}>
    {loading ? <ChartLoading label={label} /> : <>
      <svg className={`admin-weekly-chart is-${variant}`} viewBox="0 0 960 480" role="group" aria-label={`${label} by week${hasEvents ? " from shared LMS events" : " sample preview because no timestamped events match this range"}`} onPointerMove={(event) => {
        const transform = event.currentTarget.getScreenCTM();
        if (!transform) return;
        const { x } = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
        const nearest = Math.max(0, Math.min(points.length - 1, Math.round((x - 30) / 128.57)));
        setActiveIndex(nearest);
      }} onPointerLeave={() => setActiveIndex(null)}>
        {[70, 167, 263, 360].map((y) => <line className="admin-chart-gridline" key={y} x1="30" x2="930" y1={y} y2={y} />)}
        {variant === "area" && <path className="admin-chart-area" d={area} />}
        {variant === "bar" && points.map((point, index) => <rect className="admin-chart-bar" key={weeks[index].label} x={point.x - 16} y={point.y} width="32" height={360 - point.y} rx="5" style={{ animationDelay: `${index * 55}ms` }} />)}
        {variant !== "bar" && <path className="admin-chart-line" d={line} pathLength="500" />}
        <line className={`admin-chart-crosshair ${activePoint ? "is-visible" : ""}`} x1="30" x2="30" y1="62" y2="360" style={{ transform: `translateX(${activePoint ? activePoint.x - 30 : 0}px)` }} />
        {points.map((point, index) => <circle
          className={`admin-chart-hitpoint ${variant === "bar" ? "is-bar" : `is-${variant}`} ${activeIndex === index ? "is-active" : ""}`}
          key={weeks[index].label}
          cx={point.x}
          cy={point.y}
          r="6"
          tabIndex="0"
          role="button"
          aria-pressed={activeIndex === index}
          aria-label={`${weeks[index].label}: ${point.value} ${variant === "bar" ? "student actions" : `${label.toLowerCase()} events`}`}
          onFocus={() => setActiveIndex(index)}
          onBlur={() => setActiveIndex(null)}
          onClick={() => setActiveIndex(index)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setActiveIndex(null);
            if (event.key === "Enter" || event.key === " ") setActiveIndex(index);
          }}
        />)}
        {weeks.map((week, index) => <text className="admin-chart-label" key={week.label} x={points[index].x} y="440" textAnchor="middle">{week.label}</text>)}
        <g className={`admin-chart-tooltip ${activePoint ? "is-visible" : ""}`} pointerEvents="none" aria-hidden={!activePoint} style={{ transform: `translate(${tooltipX}px, ${tooltipY}px)` }}>
          <rect width="280" height="78" rx="12" />
          <text className="admin-chart-tooltip-week" x="18" y="29">{activePoint && weeks[activeIndex].label}</text>
          <text className="admin-chart-tooltip-value" x="18" y="61">{activePoint && `${activePoint.value} ${variant === "bar" ? "student actions" : "events"}`}</text>
        </g>
      </svg>
      {!hasEvents && <p className="admin-chart-source">Sample preview · no timestamped records in this range</p>}
    </>}
  </div>;
}

function StudentDemographicsChart({ total, loading }) {
  const [activeSegment, setActiveSegment] = useState("");
  const values = [Math.round(total * 7 / 12), Math.floor(total * 5 / 12)];
  const chartTotal = values[0] + values[1];
  const circumference = 2 * Math.PI * 52;
  const firstArc = chartTotal ? circumference * values[0] / chartTotal : 0;
  const names = ["Female", "Male"];
  return <div className="admin-learning-chart" aria-busy={loading}>
    {loading ? <ChartLoading label="student breakdown" /> : <div className="admin-pie-content">
      <div className="admin-pie-chart">
        <svg viewBox="0 0 160 160" role="group" aria-label={`Illustrative demo breakdown for ${total} students: ${values[0]} female and ${values[1]} male`}>
          {names.map((name, index) => <circle key={name} className={`admin-pie-segment segment-${index} ${activeSegment === name ? "is-active" : ""}`} cx="80" cy="80" r="52" pathLength={circumference} strokeDasharray={`${index === 0 ? firstArc : circumference - firstArc} ${circumference}`} strokeDashoffset={index === 0 ? 0 : -firstArc} tabIndex="0" role="button" aria-pressed={activeSegment === name} aria-label={`${name}: ${values[index]} students (illustrative demo data)`} onPointerEnter={() => setActiveSegment(name)} onPointerLeave={() => setActiveSegment("")} onFocus={() => setActiveSegment(name)} onBlur={() => setActiveSegment("")} onClick={() => setActiveSegment(name)} onKeyDown={(event) => { if (event.key === "Escape") setActiveSegment(""); if (event.key === "Enter" || event.key === " ") setActiveSegment(name); }} />)}
        </svg>
        <div><strong>{total}</strong><span>students</span></div>
      </div>
      <div className="admin-pie-legend">{names.map((name, index) => <span key={name} tabIndex="0" role="button" aria-pressed={activeSegment === name} onPointerEnter={() => setActiveSegment(name)} onPointerLeave={() => setActiveSegment("")} onFocus={() => setActiveSegment(name)} onBlur={() => setActiveSegment("")}><i className={`segment-${index}`} />{name} <strong>{values[index]}</strong></span>)}</div>
      <div className="admin-pie-tooltip-slot"><p className={`admin-pie-tooltip ${activeSegment ? "is-visible" : ""}`} role="status" aria-hidden={!activeSegment}>{activeSegment ? `${activeSegment} · ${values[names.indexOf(activeSegment)]} students · ${chartTotal ? Math.round(values[names.indexOf(activeSegment)] / chartTotal * 100) : 0}% (sample data)` : " "}</p></div>
      <p className="admin-chart-source">Illustrative sample only · sex is not stored in student records</p>
    </div>}
  </div>;
}

function ChartLoading({ label }) {
  return <div className="admin-chart-loading" role="status" aria-label={`Loading ${label} chart`}><i /><i /><i /><i /><i /><i /><i /><i /></div>;
}
