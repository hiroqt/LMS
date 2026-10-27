import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
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
    { label: "Total Students", value: model.metrics.totalStudents, note: `${activeStudents} active · ${model.metrics.totalStudents - activeStudents} inactive`, icon: <UsersRound size={17} /> },
    { label: "Total Faculty", value: model.metrics.totalFaculty, note: `${activeFaculty} active · ${model.metrics.totalFaculty - activeFaculty} inactive`, icon: <GraduationCap size={17} /> },
  { label: "Active Courses", value: model.metrics.activeCourses, note: `Active class sections across ${model.metrics.totalSubjects} subjects`, icon: <BookOpen size={17} /> },
    { label: "Active Users", value: model.metrics.activeUsers, note: `of ${(data.users || []).length} user accounts`, icon: <UsersRound size={17} /> },
  ];

  return (
    <div className="admin-overview-container">
      <section className="admin-hero">
        <div className="admin-hero-content">
          <div>
            <span className="admin-hero-kicker"><i /> TMCC Administrative Console</span>
            <h2>Administrator Dashboard</h2>
            <p>Monitor courses, student learning, and system activity across the browser-based LMS demo.</p>
          </div>
          <div className="admin-term-badge">
            <strong>{selectedTerm === "all" ? "All academic terms" : selectedTerm}</strong>
            <small>Dashboard reporting scope</small>
          </div>
        </div>

        <div className="admin-quick-actions">
          <button type="button" className="admin-action-btn primary" onClick={() => onOpenCreate("Users")}><UsersRound size={14} /> + Add Person</button>
          <button type="button" className="admin-action-btn" onClick={() => onOpenCreate("Subjects")}><BookOpen size={14} /> + New Subject</button>
          <button type="button" className="admin-action-btn" onClick={() => onOpenCreate("Classrooms")}><LayoutDashboard size={14} /> + Create Classroom</button>
          <button type="button" className="admin-action-btn" onClick={() => onOpenCreate("Enrollments")}><ListChecks size={14} /> + Enroll Student</button>
          <button type="button" className="admin-action-btn danger" onClick={onResetDemo} title="Reset browser demo data to seed defaults"><Settings size={14} /> Reset Demo Data</button>
        </div>
      </section>

      <div className="role-stat-grid admin-kpi-grid">
        {cards.map((card) => <article className="admin-stat-card" key={card.label}>
          <div className="admin-stat-top"><span>{card.label}</span><div className="admin-stat-icon">{card.icon}</div></div>
          <strong>{card.value}</strong>
          <div className="admin-stat-meta">{card.note}</div>
        </article>)}
      </div>

      <div className="admin-insights-toolbar">
        <p>Activity and completion data uses timestamped records available in this demo.</p>
        <div>
          <label>Academic term<select aria-label="Filter by academic term" value={selectedTerm} onChange={(event) => setTerm(event.target.value)}>
            <option value="all">All terms</option>{terms.map((item) => <option value={item} key={item}>{item}</option>)}
          </select></label>
          <label>Date range<select aria-label="Filter by date range" value={range} onChange={(event) => setRange(event.target.value)}>
            {ranges.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select></label>
        </div>
      </div>

      <div className="admin-insights-grid">
        <section className="role-panel admin-insight-panel admin-learning-panel">
          <PanelHeading title="Total Students" detail="Illustrative demo breakdown by sex" />
          <StudentDemographicsChart total={model.metrics.totalStudents} loading={chartsLoading} />
          <button type="button" className="role-link-button" onClick={() => onNavigate("Users")}>View students →</button>
        </section>

        <section className="role-panel admin-insight-panel admin-student-panel">
          <PanelHeading title="Student Activity" detail="Weekly activity" count={model.events.students.length} />
          <WeeklyChart weeks={model.weeklyActivity.students} sample={[2, 4, 3, 6, 5, 7, 6, 10]} loading={chartsLoading} label="Student activity" variant="bar" />
          <EventList events={model.events.students.slice(0, 3)} compact />
        </section>

        <section className="role-panel admin-insight-panel admin-course-panel">
          <PanelHeading title="Course Activity" detail="Weekly activity" count={model.events.course.length} />
          <WeeklyChart weeks={model.weeklyActivity.course} sample={[3, 5, 4, 7, 5, 8, 6, 9]} loading={chartsLoading} label="Course activity" variant="area" />
          <EventList events={model.events.course.slice(0, 3)} />
          <button type="button" className="role-link-button" onClick={() => onNavigate("Classrooms")}>View classrooms →</button>
        </section>

        <section className="role-panel admin-insight-panel admin-system-panel">
          <PanelHeading title="System Activity" detail="Weekly changes" count={model.events.system.length} />
          <WeeklyChart weeks={model.weeklyActivity.system} sample={[4, 3, 6, 5, 7, 4, 8, 6]} loading={chartsLoading} label="System activity" variant="line" />
          <EventList events={model.events.system.slice(0, 3)} />
          <p className="admin-insight-note">This is a recent activity summary, not an audit log.</p>
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
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width * 960;
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
      <p className={`admin-pie-tooltip ${activeSegment ? "is-visible" : ""}`} role="status" aria-hidden={!activeSegment}>{activeSegment ? `${activeSegment} · ${values[names.indexOf(activeSegment)]} students · ${chartTotal ? Math.round(values[names.indexOf(activeSegment)] / chartTotal * 100) : 0}% (sample data)` : " "}</p>
      <p className="admin-chart-source">Illustrative sample only · sex is not stored in student records</p>
    </div>}
  </div>;
}

function ChartLoading({ label }) {
  return <div className="admin-chart-loading" role="status" aria-label={`Loading ${label} chart`}><i /><i /><i /><i /><i /><i /><i /><i /></div>;
}
