import { useState } from "react";
import { ArrowRight } from "../../icons";
import "./instructorDashboard.css";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InstructorAcademicCalendar({ events, onAnnouncements }) {
  const [today] = useState(() => new Date());
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(today);
  const monthEvents = events.map((item) => ({ ...item, dayDate: new Date(`${item.date.slice(0, 10)}T12:00:00`) })).filter((item) => item.dayDate.getFullYear() === today.getFullYear() && item.dayDate.getMonth() === today.getMonth());
  const days = Array.from({ length: Math.ceil((firstDay.getDay() + new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, index) => {
    const day = index - firstDay.getDay() + 1;
    return day > 0 && day <= new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() ? day : null;
  });
  const academicCount = monthEvents.filter((item) => item.kind === "academic").length;
  const courseworkCount = monthEvents.length - academicCount;

  return <section className="instructor-academic-calendar" aria-labelledby="instructor-calendar-title"><div className="instructor-calendar-top"><span><i /> MONTH REVIEW</span><small>{monthLabel}</small></div><h2 id="instructor-calendar-title">Academic calendar</h2><p>{academicCount} academic dates · {courseworkCount} class deadlines</p><table aria-label={`${monthLabel} academic calendar`}><thead><tr>{weekdays.map((day) => <th scope="col" key={day}>{day}</th>)}</tr></thead><tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((day, weekday) => { const onDay = monthEvents.filter((item) => item.dayDate.getDate() === day); const isToday = day === today.getDate(); return <td key={weekday}>{day && <time className={`${onDay.length ? "has-events" : ""} ${isToday ? "today" : ""}`} dateTime={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`} title={onDay.map((item) => item.title).join(", ")} aria-label={`${monthLabel} ${day}${onDay.length ? `, ${onDay.map((item) => item.title).join(", ")}` : ""}`}>{day}{[...new Set(onDay.map((item) => item.kind))].map((kind) => <i className={kind} key={kind} />)}</time>}</td>; })}</tr>)}</tbody></table><button type="button" onClick={onAnnouncements}>View announcements <ArrowRight size={14} /></button></section>;
}
