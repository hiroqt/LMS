import { useState } from "react";
import { academicEvents, assessments, questionsByAssessment } from "../../data";
import { ArrowRight, BookOpen, ClipboardCheck, Clock3, MoreHorizontal, UsersRound } from "../../icons";
import Avatar from "../../components/shared/Avatar";
import InstructorClassroom from "./InstructorClassroom";
import InstructorAcademicCalendar from "./InstructorAcademicCalendar";
import InstructorDashboardNews from "./InstructorDashboardNews";
import RoleWorkspace from "../shared/RoleWorkspace";
import { useLmsData } from "../shared/useLmsData";
import "../shared/rolePages.css";

const sections = ["Overview", "Gradebook"];
const readStudentProgress = () => {
  try { return JSON.parse(localStorage.getItem("gclass-student-workspace-v1") || "{}"); }
  catch { return {}; }
};
const timestamp = () => new Date().toISOString();

export default function Instructor() {
  const [data, update] = useLmsData();
  const instructors = data.users.filter((item) => item.role === "instructor" && item.status === "active");
  const [instructorId, setInstructorId] = useState(instructors[0]?.id || "");
  const instructor = instructors.find((item) => item.id === instructorId) || instructors[0] || { firstName: "Demo", lastName: "Instructor" };
  const [page, setPage] = useState("Overview");
  const [classroomId, setClassroomId] = useState("");
  const [formType, setFormType] = useState("");
  const [error, setError] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({});
  const [newClass, setNewClass] = useState({ subjectId: "", yearLevel: "1", section: "" });
  const [yearLevelFilter, setYearLevelFilter] = useState("all");
  const [classTab, setClassTab] = useState("Stream");
  const [overviewView, setOverviewView] = useState("overview");
  const classrooms = data.classrooms.filter((item) => item.status === "active" && item.instructorId === instructor?.id);
  const yearOf = (room) => Number(room.yearLevel) || Number(room.section.match(/Year\s+(\d+)/i)?.[1]) || 1;
  const yearLevels = [...new Set(classrooms.map(yearOf))].sort((a, b) => a - b);
  const visibleClassrooms = yearLevelFilter === "all" ? classrooms : classrooms.filter((room) => yearOf(room) === Number(yearLevelFilter));
  const selected = visibleClassrooms.find((item) => item.id === classroomId) || visibleClassrooms[0] || classrooms[0];
  const subjectOf = (room) => data.subjects.find((item) => item.id === room?.subjectId);
  const selectedModules = data.modules.filter((item) => item.classroomId === selected?.id);
  const selectedModuleIds = new Set(selectedModules.map((item) => item.id));
  const classMaterials = data.materials.filter((item) => selectedModuleIds.has(item.moduleId) && item.status !== "inactive");
  const classAnnouncements = (data.announcements || []).filter((item) => item.classroomId === selected?.id && item.status !== "inactive");
  const classActivities = data.activities.filter((item) => selectedModuleIds.has(item.moduleId) && item.status !== "inactive");
  const classExams = data.exams.filter((item) => item.classroomId === selected?.id && item.status !== "inactive");
  const classStudents = data.enrollments.filter((item) => item.classroomId === selected?.id && item.status === "active").map((item) => data.users.find((user) => user.id === item.studentId)).filter(Boolean);
  const exams = data.exams.filter((item) => item.status !== "inactive" && classrooms.some((room) => room.id === item.classroomId));
  const completed = readStudentProgress().completed || [];
  const examQueue = completed.map((assessmentId) => {
    const assessment = assessments.find((item) => item.id === assessmentId);
    const exam = data.exams.find((item) => item.id === assessmentId);
    if (!exam || !classrooms.some((room) => room.id === exam.classroomId)) return null;
    const existing = data.examSubmissions.find((item) => item.examId === exam.id && item.studentId === "s0");
    if (existing?.status === "graded") return null;
    const answers = readStudentProgress().answers?.[assessmentId] || {};
    const questions = assessment ? questionsByAssessment[assessmentId] || [] : (exam.questions || []).map((question) => ({ ...question, correct: question.correctIndex }));
    const correct = questions.reduce((total, question, index) => total + (answers[index] === question.correct ? 1 : 0), 0);
    return { id: exam.id, exam, assessment, answers, questions, correct, student: data.users.find((item) => item.id === "s0"), existing };
  }).filter(Boolean);
  const activityQueue = (data.activitySubmissions || []).filter((record) => record.status === "submitted" && record.grade === null && classrooms.some((room) => room.id === record.classroomId)).map((record) => {
    const activity = data.activities.find((item) => item.id === record.activityId);
    if (!activity) return null;
    const exam = { id: activity.id, classroomId: record.classroomId, totalMarks: activity.maxScore, title: activity.title };
    return { id: record.id, kind: "activity", exam, student: data.users.find((item) => item.id === record.studentId), existing: record, correct: 0, questions: [], answers: {} };
  }).filter(Boolean);
  const submissions = [...activityQueue, ...examQueue];
  const classSubmissions = submissions.filter((item) => item.exam.classroomId === selected?.id);
  const instructorClassrooms = classrooms.map((room) => ({ ...room, title: subjectOf(room)?.title || "Classroom", code: subjectOf(room)?.code || "CL", yearLevel: yearOf(room) }));
  const pending = submissions.length;
  const [activityAverage, examAverage] = selected ? [
    data.activitySubmissions.filter((item) => item.classroomId === selected.id && item.grade !== null && item.grade !== undefined),
    data.examSubmissions.filter((item) => item.classroomId === selected.id && item.status === "graded"),
  ] : [[], []];

  function openCreate(kind) { setFormType(kind); setClassTab("Create content"); setForm({ moduleId: data.modules.find((item) => item.classroomId === selected?.id)?.id || "", type: "multiple_choice", points: "10", correctIndex: "0" }); setError(""); }
  function createClass(event) {
    event.preventDefault();
    const id = `classroom-${crypto.randomUUID()}`;
    const classroom = { id, subjectId: newClass.subjectId, instructorId: instructor.id, section: newClass.section.trim(), yearLevel: Number(newClass.yearLevel), term: "Fall 2026", enrollmentCode: `TMCC-${id.slice(-8).toUpperCase()}`, status: "active", createdAt: timestamp() };
    update((current) => ({ ...current, classrooms: [...current.classrooms, classroom], modules: [...current.modules, { id: `module-${crypto.randomUUID()}`, classroomId: id, title: "Unit 1 · Foundations", order: 1 }], gradebookSettings: { ...current.gradebookSettings, [id]: { activityWeight: 40, examWeight: 60, passingScore: 60 } } }));
    setClassroomId(id); setYearLevelFilter("all"); setPage("Classes"); setClassTab("Stream"); setFormType(""); setNewClass({ subjectId: "", yearLevel: "1", section: "" });
  }
  function create(event) {
    event.preventDefault(); setError("");
    if (!selected) return;
    if (formType === "material") update((current) => ({ ...current, materials: [...current.materials, { id: `material-${crypto.randomUUID()}`, moduleId: form.moduleId, title: form.title.trim(), kind: form.kind || "Study guide", description: form.description.trim(), status: "active", createdAt: timestamp() }] }));
    if (formType === "activity") update((current) => ({ ...current, activities: [...current.activities, { id: `activity-${crypto.randomUUID()}`, moduleId: form.moduleId, title: form.title.trim(), instructions: form.instructions.trim(), dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : "", maxScore: Number(form.points) || 10, allowLate: form.allowLate === true, allowResubmission: form.allowResubmission === true, status: "active", createdAt: timestamp() }] }));
    if (formType === "exam") {
      const rawDate = form.dueAt ? new Date(form.dueAt).toISOString() : "";
      update((current) => ({ ...current, exams: [...current.exams, { id: `exam-${crypto.randomUUID()}`, classroomId: selected.id, moduleId: form.moduleId, title: form.title.trim(), instructions: form.instructions.trim(), dueAt: rawDate, totalMarks: Number(form.points) || 10, timeLimitMinutes: Number(form.timeLimit) || 0, attempts: 1, status: "active", createdAt: timestamp(), questions: [{ prompt: form.prompt.trim(), options: form.type === "true_false" ? ["True", "False"] : [form.option1, form.option2, form.option3, form.option4].filter(Boolean), correctIndex: form.type === "true_false" ? Number(form.correctIndex) : Number(form.correctIndex), points: Number(form.points) || 10 }] }] }));
    }
    setFormType("");
  }
  function publishAnnouncement({ title: announcementTitle, message }) {
    update((current) => ({ ...current, announcements: [...(current.announcements || []), { id: `announcement-${crypto.randomUUID()}`, classroomId: selected.id, instructorId: instructor.id, title: announcementTitle.trim(), message: message.trim(), createdAt: timestamp(), status: "active" }] }));
  }
  function saveGrade(event) {
    event.preventDefault();
    const item = submissions.find((submission) => submission.id === gradeId);
    if (!item || grade === "" || Number(grade) < 0 || Number(grade) > item.exam.totalMarks) return setError(`Enter a score from 0 to ${item?.exam.totalMarks ?? "the maximum"}.`);
    if (item.kind === "activity") update((current) => ({ ...current, activitySubmissions: current.activitySubmissions.map((record) => record.id === item.id ? { ...record, grade: Number(grade), feedback: feedback.trim(), status: "graded", gradedAt: timestamp() } : record) }));
    else update((current) => ({ ...current, examSubmissions: [...current.examSubmissions.filter((record) => !(record.examId === item.id && record.studentId === item.student.id)), { id: item.existing?.id || `submission-${crypto.randomUUID()}`, examId: item.id, classroomId: item.exam.classroomId, studentId: item.student.id, status: "graded", totalScore: Number(grade), feedback: feedback.trim(), answers: item.answers, submittedAt: item.existing?.submittedAt || timestamp(), gradedAt: timestamp() }] }));
    setGradeId(""); setGrade(""); setFeedback(""); setError("");
  }
  function setSetting(key, value) {
    update((current) => ({ ...current, gradebookSettings: { ...current.gradebookSettings, [selected.id]: { ...(current.gradebookSettings[selected.id] || { activityWeight: 40, examWeight: 60, passingScore: 60 }), [key]: Number(value) } } }));
  }
  function openReviewQueue(item = submissions[0]) {
    const room = classrooms.find((entry) => entry.id === item?.exam.classroomId) || selected;
    if (!room) return;
    setClassroomId(room.id);
    setYearLevelFilter(String(yearOf(room)));
    setPage("Classes");
    setClassTab("Submissions");
    setFormType("");
    setGradeId(item?.id || "");
    setGrade(item ? String(Math.round(item.correct / Math.max(item.questions.length, 1) * item.exam.totalMarks)) : "");
    setFeedback("");
    setError("");
  }
  function filterYear(level) {
    setClassTab("Stream");
    setYearLevelFilter(level);
    const nextClassrooms = level === "all" ? classrooms : classrooms.filter((room) => yearOf(room) === Number(level));
    setClassroomId(nextClassrooms[0]?.id || "");
    setFormType("");
  }

  const title = page === "Overview" ? "Your teaching day" : "Gradebook";
  const subtitle = page === "Overview" ? "Keep coursework moving and give every submission timely attention." : "Set category weights and follow progress across your class.";
  const searchItems = [
    ...classrooms.map((room) => ({ id: room.id, kind: `Year ${yearOf(room)} classroom`, title: `${subjectOf(room)?.title || "Classroom"} · ${room.section}`, onSelect: () => { setPage("Classes"); setClassroomId(room.id); setYearLevelFilter(String(yearOf(room))); setClassTab("Stream"); setFormType(""); } })),
    ...data.materials.filter((item) => data.modules.some((module) => module.id === item.moduleId && classrooms.some((room) => room.id === module.classroomId))).map((item) => ({ id: item.id, kind: "Material", title: item.title, onSelect: () => setPage("Classes") })),
    ...exams.map((item) => ({ id: item.id, kind: "Assessment", title: item.title, onSelect: () => setPage("Classes") })),
  ];
  const notifications = submissions.slice(0, 5).map((item) => ({ id: item.id, title: item.exam.title, detail: `${item.student?.firstName || "Student"} ${item.student?.lastName || ""} · awaiting review` }));
  const classroomIds = new Set(classrooms.map((room) => room.id));
  const moduleClassroom = new Map(data.modules.map((module) => [module.id, module.classroomId]));
  const dashboardAnnouncements = (data.announcements || []).filter((item) => classroomIds.has(item.classroomId) && item.status !== "inactive");
  const dashboardCalendarEvents = [
    ...academicEvents.map((item) => ({ ...item, kind: "academic" })),
    ...exams.filter((item) => item.dueAt).map((item) => ({ id: item.id, title: item.title, date: item.dueAt, kind: "assessment" })),
    ...data.activities.filter((item) => item.dueAt && classroomIds.has(moduleClassroom.get(item.moduleId))).map((item) => ({ id: item.id, title: item.title, date: item.dueAt, kind: "activity" })),
  ];
  function openAnnouncementClass(room) {
    if (!room) return;
    setClassroomId(room.id);
    setYearLevelFilter(String(yearOf(room)));
    setClassTab("Announcements");
    setPage("Classes");
  }

  return <RoleWorkspace role="instructor" user={instructor} sections={sections} page={page} onNavigate={(next) => { setPage(next); setFormType(""); setGradeId(""); }} onCreateClass={() => { setNewClass({ subjectId: data.subjects[0]?.id || "", yearLevel: "1", section: "" }); setFormType("classroom"); }} showHeading={page !== "Classes"} title={title} subtitle={subtitle} searchItems={searchItems} notifications={notifications} onNotificationSelect={(item) => openReviewQueue(submissions.find((submission) => submission.id === item.id))} classrooms={instructorClassrooms} selectedClassId={selected?.id} onClassSelect={(room) => { setClassroomId(room.id); setYearLevelFilter(String(yearOf(room))); setPage("Classes"); setClassTab("Stream"); setFormType(""); }}>
    {formType === "classroom" && <div className="instructor-class-create-backdrop"><form className="role-form instructor-class-create" onSubmit={createClass}><div className="role-form-heading"><h2>Create a class</h2><p>Add a course room to your instructor workspace.</p></div><label className="role-field"><span>Subject</span><select required value={newClass.subjectId} onChange={(event) => setNewClass({ ...newClass, subjectId: event.target.value })}>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.title}</option>)}</select></label><label className="role-field"><span>Year level</span><select value={newClass.yearLevel} onChange={(event) => setNewClass({ ...newClass, yearLevel: event.target.value })}>{[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label><label className="role-field"><span>Section</span><input required value={newClass.section} placeholder={`Year ${newClass.yearLevel} · Section A`} onChange={(event) => setNewClass({ ...newClass, section: event.target.value })} /></label><div className="role-form-actions"><button type="button" className="role-secondary" onClick={() => setFormType("")}>Cancel</button><button className="role-primary" type="submit">Create class</button></div></form></div>}
    {instructors.length > 1 && <label className="role-instructor-select">Viewing instructor<select value={instructor.id} onChange={(event) => { setInstructorId(event.target.value); setClassroomId(""); setYearLevelFilter("all"); setClassTab("Stream"); }} aria-label="Choose demo instructor">{instructors.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></label>}
    {!classrooms.length ? <section className="role-panel role-empty"><strong>No classrooms assigned yet</strong><span>Ask an admin to assign a classroom to this instructor.</span><a href="/admin">Open Admin workspace →</a></section> : <>
      {page === "Overview" && <>
        <div className="instructor-overview-switch" role="group" aria-label="Dashboard content"><button type="button" aria-pressed={overviewView === "overview"} onClick={() => setOverviewView("overview")}>Overview</button><button type="button" aria-pressed={overviewView === "news"} onClick={() => setOverviewView("news")}>News &amp; announcements</button></div>
        {overviewView === "overview" ? <><div className="instructor-overview">
        <section className="instructor-hero">
          <div className="instructor-hero-copy">
            <span className="instructor-hero-kicker"><i /> YOUR TEACHING SPACE</span>
            <h2>Good morning, {instructor.firstName}.</h2>
            <p>Your classrooms are ready. Keep feedback moving and help students stay on track.</p>
            <button type="button" onClick={() => openReviewQueue()}>Review student work <ArrowRight size={15} /></button>
          </div>
          <div className="instructor-hero-art" aria-hidden="true">
            <span className="hero-orbit orbit-back" />
            <span className="hero-orbit orbit-front" />
            <span className="hero-art-chip chip-class"><BookOpen size={15} /> {classrooms.length} {classrooms.length === 1 ? "class" : "classes"}</span>
            <span className="hero-art-chip chip-review"><ClipboardCheck size={15} /> {pending} to review</span>
            <span className="hero-art-stamp"><span>WEEK</span><strong>01</strong><small>TEACH · GUIDE · GROW</small></span>
          </div>
        </section>
        <div className="role-stat-grid"><Stat label="Assigned classrooms" value={classrooms.length} note="Ready for your next lesson" /><Stat label="Awaiting review" value={pending} note="Student assessment submissions" /><Stat label="Active assessments" value={exams.length} note="Across your classrooms" /><Stat label="Students reached" value={data.enrollments.filter((item) => item.status === "active" && classrooms.some((room) => room.id === item.classroomId)).length} note="Active enrollments" /></div>
        <section className="instructor-classes-section">
          <div className="instructor-section-heading"><div><span className="eyebrow">YOUR COURSE ROOMS</span><h2>Classes in progress</h2><p>Choose a classroom to prepare materials and coursework.</p></div><button type="button" className="role-link-button" onClick={() => setPage("Classes")}>All classrooms <ArrowRight size={14} /></button></div>
          <YearLevelTabs levels={yearLevels} selected={yearLevelFilter} onSelect={filterYear} />
          <div className="instructor-class-grid">{visibleClassrooms.map((room, index) => <InstructorClassCard key={room.id} room={room} subject={subjectOf(room)} number={index} instructor={instructor} studentCount={data.enrollments.filter((item) => item.classroomId === room.id && item.status === "active").length} learningCount={data.exams.filter((item) => item.classroomId === room.id && item.status !== "inactive").length + data.activities.filter((item) => data.modules.find((module) => module.id === item.moduleId)?.classroomId === room.id && item.status !== "inactive").length} onClick={() => { setClassroomId(room.id); setClassTab("Stream"); setPage("Classes"); }} />)}</div>
        </section>
        <div className={`instructor-dashboard-lower-grid ${submissions.length >= 3 ? "has-review-queue" : ""}`}><section className="instructor-review-panel">
          <div className="instructor-review-heading"><div><span className="eyebrow">TEACHER INBOX</span><h2>Needs your review</h2><p>Give students a useful next step while the work is fresh.</p></div><button type="button" className="role-link-button" onClick={() => openReviewQueue()}>Open review queue <ArrowRight size={14} /></button></div>
          {submissions.length ? <div className="instructor-review-list">{submissions.slice(0, 3).map((item, index) => <SubmissionPreview key={item.id} item={item} index={index} onClick={() => openReviewQueue(item)} />)}</div> : <div className="instructor-all-caught-up"><span><ClipboardCheck size={18} /></span><div><strong>Your review queue is clear</strong><small>New work will appear here after students submit.</small></div><a href="/student">View Student workspace</a></div>}
        </section><InstructorAcademicCalendar events={dashboardCalendarEvents} onAnnouncements={() => setOverviewView("news")} /></div>
      </div></> : <InstructorDashboardNews events={academicEvents} announcements={dashboardAnnouncements} data={data} onOpenClass={openAnnouncementClass} onCalendar={() => setOverviewView("overview")} />}
      </>}
      {page === "Classes" && <>
        <YearLevelTabs levels={yearLevels} selected={yearLevelFilter} onSelect={filterYear} />
        <div className="instructor-class-tabs">{visibleClassrooms.map((room) => <button type="button" className={selected.id === room.id ? "selected" : ""} key={room.id} onClick={() => { setClassroomId(room.id); setClassTab("Stream"); setFormType(""); }}>{subjectOf(room)?.title}<small>Year {yearOf(room)} · {room.section}</small></button>)}</div>
        <InstructorClassroom room={selected} subject={subjectOf(selected)} instructor={instructor} data={data} roomIndex={data.classrooms.findIndex((item) => item.id === selected.id)} students={classStudents} materials={classMaterials} announcements={classAnnouncements} onPublishAnnouncement={publishAnnouncement} activities={classActivities} exams={classExams} submissions={classSubmissions} gradeId={gradeId} grade={grade} setGrade={setGrade} feedback={feedback} setFeedback={setFeedback} onSelectSubmission={(item) => { setGradeId(item.id); setGrade(String(Math.round(item.correct / Math.max(item.questions.length, 1) * item.exam.totalMarks))); setFeedback(""); setError(""); }} onSaveGrade={saveGrade} tab={classTab} onTabChange={setClassTab} onBack={() => { setPage("Overview"); setClassTab("Stream"); setFormType(""); }} onCreate={openCreate} formType={formType} form={form} setForm={setForm} error={error} onSubmit={create} onCancel={() => setFormType("")} />
      </>}
      {page === "Gradebook" && <><div className="gradebook-class-picker"><label>Classroom<select value={selected.id} onChange={(event) => setClassroomId(event.target.value)}>{classrooms.map((room) => <option value={room.id} key={room.id}>{subjectOf(room)?.title} · {room.section}</option>)}</select></label><label>Activity weight<input type="number" min="0" max="100" value={data.gradebookSettings[selected.id]?.activityWeight ?? 40} onChange={(event) => setSetting("activityWeight", event.target.value)} /></label><label>Exam weight<input type="number" min="0" max="100" value={data.gradebookSettings[selected.id]?.examWeight ?? 60} onChange={(event) => setSetting("examWeight", event.target.value)} /></label><label>Passing score<input type="number" min="0" max="100" value={data.gradebookSettings[selected.id]?.passingScore ?? 60} onChange={(event) => setSetting("passingScore", event.target.value)} /></label></div><section className="role-panel"><div className="role-panel-head"><div><h2>{subjectOf(selected)?.title} · weighted progress</h2><p>Only graded work contributes to these illustrative averages.</p></div><span className="role-soft-tag">{activityAverage.length + examAverage.length} graded items</span></div><div className="role-table-wrap"><table className="role-table"><thead><tr><th>Category</th><th>Graded records</th><th>Average</th><th>Weight</th></tr></thead><tbody><tr><td><strong>Activities</strong></td><td>{activityAverage.length}</td><td>{average(activityAverage.map((item) => item.grade / item.maxScore * 100))}</td><td>{data.gradebookSettings[selected.id]?.activityWeight ?? 40}%</td></tr><tr><td><strong>Exams</strong></td><td>{examAverage.length}</td><td>{average(examAverage.map((item) => item.totalScore / (data.exams.find((exam) => exam.id === item.examId)?.totalMarks || 1) * 100))}</td><td>{data.gradebookSettings[selected.id]?.examWeight ?? 60}%</td></tr></tbody></table></div></section></>}
    </>}
  </RoleWorkspace>;
}

function average(values) { return values.length ? `${Math.round(values.reduce((sum, item) => sum + item, 0) / values.length)}%` : "—"; }
function Stat({ label, value, note }) { return <article className="role-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function SubmissionPreview({ item, index, onClick }) { return <button type="button" className="instructor-review-card" onClick={onClick}><span className={`review-avatar review-avatar-${index}`}>{item.student?.firstName?.[0] || "A"}{item.student?.lastName?.[0] || "R"}</span><span className="review-student"><strong>{item.student?.firstName || "Alex"} {item.student?.lastName || "Rivera"}</strong><small>{item.exam.title}</small></span><span className="review-course-tag">{item.kind === "activity" ? "Assignment" : "Assessment"}</span><span className="review-time"><Clock3 size={13} /> Awaiting grade</span><span className="review-open">Review <ArrowRight size={13} /></span></button>; }
function InstructorClassCard({ room, subject, number, instructor, studentCount, learningCount, onClick }) {
  return <button type="button" className={`instructor-class-card card-${number % 4}`} onClick={onClick}>
    <span className="instructor-card-cover"><span>{subject?.title}</span><b aria-hidden="true">{subject?.code?.slice(-2) || "CL"}</b><i /><i /></span>
    <span className="instructor-card-content"><span className="instructor-card-name"><span><strong>{subject?.title}</strong><small>{room.section}</small></span><MoreHorizontal size={18} /></span>
      <span className="instructor-card-teacher"><Avatar name={`${instructor.firstName} ${instructor.lastName}`} tone={number + 2} small />{instructor.firstName} {instructor.lastName}</span>
      <span className="instructor-card-bottom"><span><UsersRound size={14} />{studentCount} students</span><small>Coursework · {learningCount} items</small></span>
    </span>
  </button>;
}
function YearLevelTabs({ levels, selected, onSelect }) {
  return <div className="instructor-year-tabs" aria-label="Filter classrooms by year level"><button type="button" aria-pressed={selected === "all"} className={selected === "all" ? "selected" : ""} onClick={() => onSelect("all")}>All years</button>{levels.map((level) => <button type="button" aria-pressed={Number(selected) === level} className={Number(selected) === level ? "selected" : ""} key={level} onClick={() => onSelect(level)}>Year {level}</button>)}</div>;
}
