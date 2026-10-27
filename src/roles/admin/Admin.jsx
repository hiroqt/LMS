import { useMemo, useState } from "react";
import RoleWorkspace from "../shared/RoleWorkspace";
import { useLmsData } from "../shared/useLmsData";
import "../shared/rolePages.css";

const sections = ["Overview", "Users", "Subjects", "Classrooms", "Enrollments"];
const adminUser = { firstName: "Taylor", lastName: "Morgan" };

export default function Admin() {
  const [data, update] = useLmsData();
  const [page, setPage] = useState("Overview");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({});
  const activeStudents = data.users.filter((item) => item.role === "student" && item.status === "active").length;
  const activeClassrooms = data.classrooms.filter((item) => item.status === "active").length;
  const unmatched = data.classrooms.filter((room) => room.status === "active" && !(data.enrollments || []).some((item) => item.classroomId === room.id && item.status === "active")).length;
  const records = useMemo(() => {
    const source = page === "Users" ? data.users : page === "Subjects" ? data.subjects : page === "Classrooms" ? data.classrooms : data.enrollments;
    const term = query.trim().toLowerCase();
    return source.filter((item) => !term || JSON.stringify(item).toLowerCase().includes(term));
  }, [data, page, query]);
  function openForm() { setForm({}); setNotice(""); setFormOpen(true); }
  function save(event) {
    event.preventDefault(); setNotice("");
    if (page === "Users") {
      if (data.users.some((item) => item.email.toLowerCase() === form.email.trim().toLowerCase())) return setNotice("That email is already in use.");
      const [firstName, ...last] = form.name.trim().split(/\s+/);
      update((current) => ({ ...current, users: [...current.users, { id: `user-${crypto.randomUUID()}`, firstName, lastName: last.join(" "), email: form.email.trim(), role: form.role, status: "active" }] }));
    } else if (page === "Subjects") {
      if (data.subjects.some((item) => item.code.toLowerCase() === form.code.trim().toLowerCase())) return setNotice("That subject code is already in use.");
      update((current) => ({ ...current, subjects: [...current.subjects, { id: `subject-${crypto.randomUUID()}`, code: form.code.trim().toUpperCase(), title: form.title.trim(), description: form.description.trim() }] }));
    } else if (page === "Classrooms") {
      if (data.classrooms.some((item) => item.enrollmentCode.toLowerCase() === form.enrollmentCode.trim().toLowerCase())) return setNotice("That enrollment code is already in use.");
      const classroomId = `class-${crypto.randomUUID()}`;
      update((current) => ({ ...current, classrooms: [...current.classrooms, { id: classroomId, subjectId: form.subjectId, instructorId: form.instructorId, section: form.section.trim(), yearLevel: Number(form.yearLevel) || 1, term: form.term.trim(), enrollmentCode: form.enrollmentCode.trim().toUpperCase(), status: "active" }], modules: [...current.modules, { id: `module-${crypto.randomUUID()}`, classroomId, title: "Getting started", order: 1 }] }));
    } else {
      if (data.enrollments.some((item) => item.classroomId === form.classroomId && item.studentId === form.studentId && item.status === "active")) return setNotice("This student is already enrolled in that classroom.");
      update((current) => ({ ...current, enrollments: [...current.enrollments, { id: `enrollment-${crypto.randomUUID()}`, classroomId: form.classroomId, studentId: form.studentId, status: "active" }] }));
    }
    setFormOpen(false);
  }
  function deactivate(kind, recordId) {
    update((current) => ({ ...current, [kind]: current[kind].map((item) => item.id === recordId ? { ...item, status: "inactive" } : item) }));
  }
  const heading = page === "Overview" ? ["Set up your learning community", "Keep people, subjects, classrooms, and enrollments connected."] : [page, `Manage ${page.toLowerCase()} in this browser’s demo workspace.`];
  const searchItems = [
    ...data.users.map((item) => ({ id: item.id, kind: "Person", title: `${item.firstName} ${item.lastName}`, onSelect: () => setPage("Users") })),
    ...data.subjects.map((item) => ({ id: item.id, kind: "Subject", title: `${item.code} · ${item.title}`, onSelect: () => setPage("Subjects") })),
    ...data.classrooms.map((item) => ({ id: item.id, kind: "Classroom", title: `${data.subjects.find((subject) => subject.id === item.subjectId)?.title || "Classroom"} · ${item.section}`, onSelect: () => setPage("Classrooms") })),
  ];
  const notifications = unmatched ? [{ id: "unmatched", title: `${unmatched} classroom${unmatched === 1 ? "" : "s"} need enrollment`, detail: "Review classroom setup" }] : [];

  return <RoleWorkspace role="admin" user={adminUser} sections={sections} page={page} onNavigate={(next) => { setPage(next); setFormOpen(false); setQuery(""); }} title={heading[0]} subtitle={heading[1]} searchItems={searchItems} notifications={notifications} onNotificationSelect={() => setPage("Enrollments")}>
    {page === "Overview" ? <>
      <div className="role-stat-grid"><Stat label="Active people" value={data.users.filter((item) => item.status === "active").length} note={`${activeStudents} students`} /><Stat label="Classrooms" value={activeClassrooms} note={`${data.subjects.length} subjects in catalog`} /><Stat label="Enrollments" value={data.enrollments.filter((item) => item.status === "active").length} note="Across active classrooms" /><Stat label="Needs attention" value={unmatched} note="Classrooms without students" /></div>
      <section className="role-panel admin-setup"><div className="role-panel-head"><div><h2>Setup checklist</h2><p>Build the structure instructors and students work in.</p></div><span className="role-soft-tag">{unmatched ? "In progress" : "Ready to teach"}</span></div><div className="setup-list">{[["Users", "Add the people who teach and learn", "Users"], ["Subjects", "Create the academic catalog", "Subjects"], ["Classrooms", "Assign an instructor and term", "Classrooms"], ["Enrollments", "Connect students to classrooms", "Enrollments"]].map(([title, desc, target], index) => <button type="button" className="setup-row" key={title} onClick={() => setPage(target)}><span className="setup-number">0{index + 1}</span><span><strong>{title}</strong><small>{desc}</small></span><b>{target === "Users" ? data.users.length : target === "Subjects" ? data.subjects.length : target === "Classrooms" ? data.classrooms.length : data.enrollments.length}</b><span className="setup-arrow">›</span></button>)}</div><p className="role-footnote">Records are stored in this browser and shared with the instructor workspace.</p></section>
    </> : <section className="role-panel">
      <div className="role-panel-head"><div><h2>{page} directory</h2><p>{records.length} records · changes are available to the other demo roles.</p></div><button type="button" className="role-primary" onClick={openForm}>+ Add {page === "Users" ? "person" : page === "Subjects" ? "subject" : page === "Classrooms" ? "classroom" : "enrollment"}</button></div>
      <div className="role-table-tools"><label className="role-search"><span aria-hidden="true">⌕</span><input placeholder={`Search ${page.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
      {formOpen && <form className="role-form" onSubmit={save}><div className="role-form-heading"><div><h3>New {page === "Users" ? "person" : page === "Subjects" ? "subject" : page === "Classrooms" ? "classroom" : "enrollment"}</h3><p>Fields marked required must be filled in.</p></div><button type="button" className="role-close" onClick={() => setFormOpen(false)} aria-label="Close form">×</button></div>
        {page === "Users" && <><Field label="Full name" name="name" required value={form.name} onChange={setForm} /><Field label="Email" name="email" type="email" required value={form.email} onChange={setForm} /><label className="role-field"><span>Role</span><select required value={form.role || "student"} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label></>}
        {page === "Subjects" && <><Field label="Subject code" name="code" required value={form.code} onChange={setForm} /><Field label="Subject name" name="title" required value={form.title} onChange={setForm} /><Field label="Description" name="description" value={form.description} onChange={setForm} /></>}
        {page === "Classrooms" && <><label className="role-field"><span>Subject</span><select required value={form.subjectId || ""} onChange={(event) => setForm({ ...form, subjectId: event.target.value })}><option value="">Select a subject</option>{data.subjects.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.title}</option>)}</select></label><label className="role-field"><span>Instructor</span><select required value={form.instructorId || ""} onChange={(event) => setForm({ ...form, instructorId: event.target.value })}><option value="">Assign instructor</option>{data.users.filter((item) => item.role === "instructor" && item.status === "active").map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label className="role-field"><span>Year level</span><select required value={form.yearLevel || "1"} onChange={(event) => setForm({ ...form, yearLevel: event.target.value })}>{[1, 2, 3, 4].map((level) => <option key={level} value={level}>Year {level}</option>)}</select></label><Field label="Section" name="section" required value={form.section} onChange={setForm} /><Field label="Term" name="term" required value={form.term} onChange={setForm} /><Field label="Enrollment code" name="enrollmentCode" required value={form.enrollmentCode} onChange={setForm} /></>}
        {page === "Enrollments" && <><label className="role-field"><span>Classroom</span><select required value={form.classroomId || ""} onChange={(event) => setForm({ ...form, classroomId: event.target.value })}><option value="">Select a classroom</option>{data.classrooms.filter((item) => item.status === "active").map((room) => <option value={room.id} key={room.id}>{data.subjects.find((subject) => subject.id === room.subjectId)?.title} · {room.section}</option>)}</select></label><label className="role-field"><span>Student</span><select required value={form.studentId || ""} onChange={(event) => setForm({ ...form, studentId: event.target.value })}><option value="">Select a student</option>{data.users.filter((item) => item.role === "student" && item.status === "active").map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName}</option>)}</select></label></>}
        {notice && <p className="role-form-error" role="alert">{notice}</p>}<div className="role-form-actions"><button type="button" className="role-secondary" onClick={() => setFormOpen(false)}>Cancel</button><button className="role-primary" type="submit">Save {page === "Users" ? "person" : page === "Subjects" ? "subject" : page === "Classrooms" ? "classroom" : "enrollment"}</button></div></form>}
      <AdminTable page={page} data={data} rows={records} onDeactivate={deactivate} />
    </section>}
  </RoleWorkspace>;
}

function Stat({ label, value, note }) { return <article className="role-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function Field({ label, name, value = "", onChange, type = "text", required = false }) { return <label className="role-field"><span>{label}{required ? " · required" : ""}</span><input name={name} type={type} required={required} value={value} onChange={(event) => onChange((current) => ({ ...current, [name]: event.target.value }))} /></label>; }

function AdminTable({ page, data, rows, onDeactivate }) {
  if (!rows.length) return <div className="role-empty"><strong>No {page.toLowerCase()} yet</strong><span>Add a record to connect this learning workspace.</span></div>;
  return <div className="role-table-wrap"><table className="role-table"><thead><tr>{(page === "Users" ? ["Person", "Role", "Email", "Status"] : page === "Subjects" ? ["Subject", "Code", "Description"] : page === "Classrooms" ? ["Classroom", "Instructor", "Term", "Status"] : ["Student", "Classroom", "Enrolled", "Status"]).map((label) => <th key={label}>{label}</th>)}<th aria-label="Actions" /></tr></thead><tbody>{rows.map((item) => {
    const subject = data.subjects.find((record) => record.id === item.subjectId);
    const instructor = data.users.find((record) => record.id === item.instructorId);
    const student = data.users.find((record) => record.id === item.studentId);
    const room = data.classrooms.find((record) => record.id === item.classroomId);
    return <tr key={item.id}>{page === "Users" ? <><td><strong>{item.firstName} {item.lastName}</strong></td><td><span className="role-pill">{item.role}</span></td><td>{item.email}</td><td><Status value={item.status} /></td></> : page === "Subjects" ? <><td><strong>{item.title}</strong></td><td>{item.code}</td><td>{item.description}</td></> : page === "Classrooms" ? <><td><strong>{subject?.title || "Unknown subject"}</strong><small>Year {item.yearLevel || item.section.match(/Year\s+(\d+)/i)?.[1] || 1} · {item.section} · {item.enrollmentCode}</small></td><td>{instructor ? `${instructor.firstName} ${instructor.lastName}` : "Unassigned"}</td><td>{item.term}</td><td><Status value={item.status} /></td></> : <><td><strong>{student ? `${student.firstName} ${student.lastName}` : "Unknown student"}</strong></td><td>{room ? `${data.subjects.find((record) => record.id === room.subjectId)?.title} · ${room.section}` : "Classroom removed"}</td><td>Demo enrollment</td><td><Status value={item.status} /></td></>}{item.status !== "inactive" && page !== "Subjects" && <td><button type="button" className="role-row-action" onClick={() => onDeactivate(page === "Users" ? "users" : page === "Classrooms" ? "classrooms" : "enrollments", item.id)}>{page === "Enrollments" ? "Remove" : "Deactivate"}</button></td>}{(item.status === "inactive" || page === "Subjects") && <td />}</tr>;
  })}</tbody></table></div>;
}
function Status({ value }) { return <span className={`role-status ${value === "active" ? "is-active" : ""}`}>{value || "active"}</span>; }
