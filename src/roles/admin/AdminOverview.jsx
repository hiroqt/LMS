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
    { label: "Total Students", value: model.metrics.totalStudents, note: `${activeStudents} active · ${model.metrics.totalStudents - activeStudents} inactive`, icon: <UsersRound size={17} />, art: "students" },
    { label: "Total Faculty", value: model.metrics.totalFaculty, note: `${activeFaculty} active · ${model.metrics.totalFaculty - activeFaculty} inactive`, icon: <GraduationCap size={17} />, art: "faculty" },
    { label: "Active Courses", value: model.metrics.activeCourses, note: `Active class sections across ${model.metrics.totalSubjects} subjects`, icon: <BookOpen size={17} />, art: "courses" },
    { label: "Active Users", value: model.metrics.activeUsers, note: `of ${(data.users || []).length} user accounts`, icon: <UsersRound size={17} />, art: "users" },
  ];

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
          <AdminMetricArt variant={card.art} />
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

function AdminMetricArt({ variant }) {
  return <svg className="admin-metric-art" viewBox="0 0 120 78" aria-hidden="true" focusable="false">
    {variant === "students" && <g fill="currentColor">
      <circle cx="60" cy="22" r="11" opacity=".65" /><path d="M39 65c1-15 8-23 21-23s20 8 21 23H39Z" opacity=".35" />
      <circle cx="27" cy="33" r="8" opacity=".42" /><path d="M12 66c1-12 6-19 15-19 5 0 9 2 12 6-3 4-5 8-6 13H12Z" opacity=".24" />
      <circle cx="93" cy="33" r="8" opacity=".42" /><path d="M87 53c3-4 7-6 12-6 9 0 14 7 15 19H87c-1-5-3-9-6-13Z" opacity=".24" />
    </g>}
    {variant === "faculty" && <g fill="currentColor">
      <path d="m60 8 48 18-48 18-48-18L60 8Z" opacity=".38" /><path d="M34 35v16c14 12 38 12 52 0V35L60 45 34 35Z" opacity=".22" />
      <circle cx="60" cy="43" r="10" opacity=".72" /><path d="M38 73c1-14 8-22 22-22s21 8 22 22H38Z" opacity=".38" />
      <path d="M105 28v22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".7" />
    </g>}
    {variant === "courses" && <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
      <path d="M13 19c17-6 33-3 47 7v43C46 59 30 57 13 64V19Z" opacity=".28" />
      <path d="M107 19c-17-6-33-3-47 7v43c14-10 30-12 47-5V19Z" opacity=".42" />
      <path d="M60 26v43M23 31c9-2 18 0 26 4M23 42c9-2 18 0 26 4M97 31c-9-2-18 0-26 4M97 42c-9-2-18 0-26 4" fill="none" strokeWidth="3" strokeLinecap="round" opacity=".74" />
    </g>}
    {variant === "users" && <g fill="currentColor">
      <circle cx="60" cy="25" r="11" opacity=".68" /><circle cx="27" cy="35" r="9" opacity=".42" /><circle cx="93" cy="35" r="9" opacity=".42" />
      <path d="M39 67c1-15 8-23 21-23s20 8 21 23H39Z" opacity=".38" /><path d="M8 68c1-13 7-20 19-20 7 0 12 3 15 9-2 4-3 8-3 11H8Zm75 0c0-3-1-7-3-11 3-6 8-9 15-9 12 0 18 7 19 20H83Z" opacity=".24" />
      <path d="M38 17 48 22M82 22l10-5M38 53l9 3M73 56l9-3" fill="none" stroke="currentColor" strokeWidth="2" opacity=".45" />
    </g>}
  </svg>;
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
