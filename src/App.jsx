import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  X,
} from "./icons";
import {
  assessments,
  academicEvents,
  courses,
  featuredAnnouncements,
  materials,
  questionsByAssessment,
  students,
} from "./data";
import { readRoleData, saveRoleData } from "./roles/shared/storage";
import { createInitialData } from "./roles/shared/lmsData";
import { appendAuditEvent } from "./roles/shared/systemAdministrationData";
import Avatar from "./components/shared/Avatar";
import Breadcrumbs from "./components/shared/Breadcrumbs";
import GlobalSearch from "./components/shared/GlobalSearch";
import NotificationMenu from "./components/shared/NotificationMenu";
import "./App.css";
import "./Details.css";

const KEY = "gclass-student-workspace-v1";
const categories = ["All work", "Quiz", "Long Quiz", "Exam", "Materials"];
const formatDueDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
const formatLocalDateTime = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const readProgress = () => {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { answers: data.answers || {}, completed: data.completed || [] };
  } catch {
    return { answers: {}, completed: [] };
  }
};

function App() {
  const [page, setPage] = useState("today");
  const [courseId, setCourseId] = useState("biology");
  const [tab, setTab] = useState("Stream");
  const [assessmentId, setAssessmentId] = useState("biology-0");
  const [materialId, setMaterialId] = useState("biology-material-0");
  const [category, setCategory] = useState("All work");
  const [taskCategory, setTaskCategory] = useState("Due soon");
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [menu, setMenu] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [classesExpanded, setClassesExpanded] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarWeekOf, setCalendarWeekOf] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timers, setTimers] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [progress, setProgress] = useState(readProgress);
  const roleData = readRoleData();
  const [, setRoleDataRefresh] = useState(0);
  const activityCompleted = (roleData?.activitySubmissions || []).filter((item) => item.studentId === "s0").map((item) => item.activityId);
  const completedWork = [...new Set([...progress.completed, ...activityCompleted])];
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [, setActivityRefresh] = useState(0);

  const course = courses.find((item) => item.id === courseId) || courses[0];
  const assessment =
    assessments.find((item) => item.id === assessmentId) || assessments[0];
  const material =
    materials.find((item) => item.id === materialId) || materials[0];
  const questionSet =
    questionsByAssessment[assessmentId] || questionsByAssessment["biology-0"];
  const seconds = timers[questionIndex] ?? 60;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* Keep working in memory when storage is unavailable. */
    }
  }, [progress]);

  useEffect(() => {
    const refreshRoleData = () => setRoleDataRefresh((current) => current + 1);
    window.addEventListener("tmcc-lms-data", refreshRoleData);
    window.addEventListener("storage", refreshRoleData);
    return () => {
      window.removeEventListener("tmcc-lms-data", refreshRoleData);
      window.removeEventListener("storage", refreshRoleData);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mobileMenu) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenu]);

  useEffect(() => {
    if (page !== "quiz") return undefined;
    const interval = window.setInterval(
      () =>
        setTimers((prev) =>
          prev.map((time, index) =>
            index === questionIndex ? Math.max(time - 1, 0) : time,
          ),
        ),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [page, questionIndex]);

  useEffect(() => {
    if (page === "quiz" && seconds === 0) nextQuestion();
    // A question advances automatically when its independent timer expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, page]);

  const classAssessments = useMemo(
    () => assessments.filter((item) => item.courseId === courseId),
    [courseId],
  );
  const filteredAssessments = classAssessments.filter(
    (item) =>
      (category === "All work" || item.type === category) &&
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  const classMaterials = materials.filter(
    (item) =>
      item.courseId === courseId &&
      `${item.title} ${item.kind}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const classAnnouncements = (roleData?.announcements || []).filter((item) => item.classroomId === courseId && item.status !== "inactive").map((item) => {
    const author = roleData.users?.find((user) => user.id === item.instructorId);
    return { ...item, author: author ? `${author.firstName} ${author.lastName}` : course.teacher };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const classmates = students.filter((item) =>
    `${item.name} ${item.email}`
      .toLowerCase()
      .includes(peopleSearch.toLowerCase()),
  );
  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return [
      ...courses
        .filter((item) =>
          `${item.name} ${item.section}`.toLowerCase().includes(q),
        )
        .map((item) => ({ kind: "Class", title: item.name, id: item.id })),
      ...assessments
        .filter((item) =>
          `${item.title} ${item.type}`.toLowerCase().includes(q),
        )
        .map((item) => ({ kind: item.type, title: item.title, id: item.id })),
      ...materials
        .filter((item) => item.title.toLowerCase().includes(q))
        .map((item) => ({ kind: "Material", title: item.title, id: item.id })),
    ].slice(0, 6);
  }, [search]);

  function openClass(id, nextTab = "Stream") {
    setCourseId(id);
    setTab(nextTab);
    setCategory("All work");
    setFilter("");
    setPage("class");
    setMobileMenu(false);
  }
  function openAssessment(id) {
    const item = assessments.find((entry) => entry.id === id);
    if (!item) return;
    setAssessmentId(id);
    setCourseId(item.courseId);
    setPage("assessment");
    setSearchOpen(false);
  }
  function startQuiz(id = assessmentId) {
    const item = assessments.find((entry) => entry.id === id);
    setAssessmentId(id);
    setCourseId(item.courseId);
    setQuestionIndex(0);
    setTimers(Array(questionsByAssessment[id].length).fill(60));
    setPage("quiz");
  }
  function submit() {
    const roleData = readRoleData() || createInitialData();
    const existing = (roleData.examSubmissions || []).find((item) => item.examId === assessmentId && item.studentId === "s0");
    if (existing?.status !== "graded" && (roleData.exams || []).some((item) => item.id === assessmentId && item.status !== "inactive")) {
      const submission = {
        id: existing?.id || `exam-submission-${assessmentId}-s0`,
        examId: assessmentId,
        classroomId: assessment.courseId,
        studentId: "s0",
        status: "submitted",
        answers: savedAnswers,
        submittedAt: new Date().toISOString(),
      };
      const updated = { ...roleData, examSubmissions: [...(roleData.examSubmissions || []).filter((item) => item.id !== existing?.id), submission] };
      saveRoleData(appendAuditEvent(updated, { actorId: "s0", actorName: "Alex Rivera", actorRole: "student", category: "activity", action: "submitted", target: "Assessment", targetId: assessmentId, summary: assessment.title }, new Date(submission.submittedAt)));
    }
    setProgress((current) => ({
      ...current,
      completed: [...new Set([...current.completed, assessmentId])],
    }));
    setConfirmSubmit(false);
    setPage("result");
  }
  function submitActivity({ fileName, comment }) {
    const roleData = readRoleData();
    if (!roleData || !assessment?.kind) return;
    const submission = { id: `activity-submission-${assessment.id}-s0`, activityId: assessment.id, classroomId: assessment.courseId, studentId: "s0", submissionText: comment.trim(), fileAttachmentUrl: fileName.trim(), status: "submitted", submittedAt: new Date().toISOString(), grade: null, feedback: "" };
    const updated = { ...roleData, activitySubmissions: [...(roleData.activitySubmissions || []).filter((item) => !(item.activityId === assessment.id && item.studentId === "s0")), submission] };
    saveRoleData(appendAuditEvent(updated, { actorId: "s0", actorName: "Alex Rivera", actorRole: "student", category: "activity", action: "submitted", target: "Assignment", targetId: assessment.id, summary: assessment.title }, new Date(submission.submittedAt)));
    setActivityRefresh((value) => value + 1);
    setProgress((current) => ({ ...current, completed: [...new Set([...current.completed, assessment.id])] }));
  }
  function nextQuestion() {
    if (questionIndex < questionSet.length - 1)
      setQuestionIndex((index) => index + 1);
    else submit();
  }
  function answer(index) {
    setProgress((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [assessmentId]: {
          ...(current.answers[assessmentId] || {}),
          [questionIndex]: index,
        },
      },
    }));
  }
  function openMaterial(id) {
    const item = materials.find((entry) => entry.id === id);
    if (!item) return;
    setMaterialId(id);
    setCourseId(item.courseId);
    setPage("material");
  }
  function chooseSearchResult(item) {
    if (item.kind === "Class") openClass(item.id);
    else if (item.kind === "Material") openMaterial(item.id);
    else openAssessment(item.id);
    setSearch("");
  }
  function resetDemo() {
    localStorage.removeItem(KEY);
    setProgress({ answers: {}, completed: [] });
    setTimers([]);
    setReviewed([]);
    setPage("today");
    setMenu("");
  }

  const savedAnswers = progress.answers[assessmentId] || {};
  const activitySubmission = roleData?.activitySubmissions?.find((item) => item.activityId === assessmentId && item.studentId === "s0");
  const score = questionSet.reduce(
    (total, item, index) =>
      total + (savedAnswers[index] === item.correct ? 1 : 0),
    0,
  );
  const instructorGrade = roleData?.examSubmissions?.find(
    (item) => item.examId === assessmentId && item.studentId === "s0" && item.status === "graded",
  );
  const dueSoon = assessments
    .filter(
      (item) =>
        !completedWork.includes(item.id) &&
        new Date(item.dueAt).getTime() >= now,
    )
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 3);
  const today = new Date(now);
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const dueThisWeekCount = assessments.filter((item) =>
    !completedWork.includes(item.id) &&
    new Date(item.dueAt).getTime() >= now &&
    new Date(item.dueAt) < weekEnd,
  ).length;
  const weekSchoolEventItems = academicEvents.filter((item) => {
    const date = new Date(`${item.date}T00:00:00`);
    return date >= weekStart && date < weekEnd;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className={`shell ${sidebarCollapsed ? "shell-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`} id="workspace-sidebar">
        <button
          className="brand"
          type="button"
          onClick={() => setPage("today")}
        >
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>
          <span>
            TMCC LMS<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="sidebar-heading">
          <span className="nav-caption">WORKSPACE</span>
          <button
            className="sidebar-collapse"
            type="button"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${page === "today" ? "active" : ""}`}
            aria-label="Today"
            title="Today"
            onClick={() => {
              setPage("today");
              setMobileMenu(false);
            }}
            type="button"
          >
            <LayoutDashboard size={18} />
            <span>Today</span>
          </button>
          <button
            className={`nav-item ${page === "tasks" ? "active" : ""}`}
            aria-label="Tasks"
            title="Tasks"
            onClick={() => {
              setPage("tasks");
              setMobileMenu(false);
            }}
            type="button"
          >
            <ListChecks size={18} />
            <span>Tasks</span>
          </button>
        </nav>
        <div className="workspace-classes">
          <button
            className={`nav-item classes-toggle ${page === "class" ? "active" : ""}`}
            aria-expanded={classesExpanded}
            aria-controls="workspace-course-list"
            onClick={() => setClassesExpanded((expanded) => !expanded)}
            title="My classes"
            type="button"
          >
            <BookOpen size={18} />
            <span>My classes</span>
            <span className="nav-count">{courses.length}</span>
            <ChevronDown className={`classes-chevron ${classesExpanded ? "" : "classes-chevron-collapsed"}`} size={16} />
          </button>
          <nav className="course-nav" id="workspace-course-list" aria-label="My classes" hidden={!classesExpanded}>
            {courses.map((item, index) => (
              <button
                key={item.id}
                className={`course-nav-item card-${index} ${page === "class" && course.id === item.id ? "selected" : ""}`}
                data-symbol={item.symbol}
                aria-label={item.name}
                title={item.name}
                onClick={() => openClass(item.id)}
                type="button"
              >
                <span className="course-nav-symbol" aria-hidden="true">{item.symbol}</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.section}</small>
                </span>
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-spacer" />
        <div className="help-card">
          <span className="help-bubble">?</span>
          <span>
            <strong>Need a hand?</strong>
            <small>Visit the help center</small>
          </span>
          <ChevronRight size={15} />
        </div>
        <div className="sidebar-bottom">
          <ShieldCheck size={14} />
          Student workspace
          <span className="status-dot" />
        </div>
      </aside>
      {mobileMenu && <button className="mobile-menu-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}

      <div className="main-column">
        <header className="topbar">
          <div className="top-left">
            <button
              type="button"
              className="mobile-toggle"
              aria-label={mobileMenu ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileMenu}
              aria-controls="workspace-sidebar"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="mobile-wordmark">
              TMCC LMS<span className="brand-dot">.</span>
            </span>
            <Breadcrumbs className="crumb" onHome={() => setPage("today")} current={page === "today"
                  ? "Today"
                  : page === "class"
                    ? course.name
                    : page === "tasks"
                      ? "Tasks"
                      : page === "calendar"
                        ? "Academic calendar"
                      : page === "assessment"
                        ? "Assessment details"
                        : page === "material"
                          ? "Learning material"
                          : page === "quiz"
                            ? "Assessment"
                          : "Your result"} />
          </div>
          <div className="top-actions">
            <GlobalSearch value={search} onChange={setSearch} open={searchOpen} onOpen={() => setSearchOpen(true)} items={results} onSelect={chooseSearchResult} label="Search classes, work, and materials" placeholder="Search classes, work..." />
            <button
              className="top-icon"
              type="button"
              aria-label="Academic calendar"
              title="Academic calendar"
              onClick={() => {
                setMenu("");
                setCalendarWeekOf(null);
                setPage("calendar");
                setMobileMenu(false);
              }}
            >
              <CalendarDays size={18} />
            </button>
            <NotificationMenu open={menu === "notifications"} onToggle={() => setMenu(menu === "notifications" ? "" : "notifications")} items={dueSoon.map((item) => ({ id: item.id, title: item.title, detail: formatDueDate(item.dueAt) }))} title="Coming up" onSelect={(item) => { setMenu(""); openAssessment(item.id); }} />
            <div className="popover-holder">
              <button
                className="profile-button"
                type="button"
                onClick={() => setMenu(menu === "profile" ? "" : "profile")}
              >
                <Avatar name="Alex Rivera" tone={1} small />
                <span>Alex Rivera</span>
                <ChevronDown size={14} />
              </button>
              {menu === "profile" && (
                <div className="popover profile-menu">
                  <div className="profile-head">
                    <Avatar name="Alex Rivera" tone={1} />
                    <span>
                      <strong>Alex Rivera</strong>
                      <small>BS Information Technology · Student</small>
                    </span>
                  </div>
                  <button type="button" onClick={resetDemo}>
                    <Settings size={15} />
                    Reset demo data
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {searchOpen && search && (
          <button
            aria-label="Close search"
            className="dismiss-search"
            type="button"
            onClick={() => setSearchOpen(false)}
          />
        )}
        <main className="content">
          {page === "today" && (
            <TodayPage
              onClass={openClass}
              onAssessment={openAssessment}
              onMaterial={openMaterial}
              onDueThisWeek={() => {
                setTaskCategory("Due this week");
                setPage("tasks");
              }}
              onAssessmentsDone={() => {
                setTaskCategory("Done");
                setPage("tasks");
              }}
              onWeekActivities={() => {
                setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setCalendarWeekOf(today);
                setPage("calendar");
              }}
              dueThisWeekCount={dueThisWeekCount}
              dueSoon={dueSoon}
              completed={completedWork}
              weekSchoolEventItems={weekSchoolEventItems}
              assessments={assessments}
              academicEvents={academicEvents}
              now={now}
              onCalendar={() => {
                setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setCalendarWeekOf(null);
                setPage("calendar");
              }}
            />
          )}
          {page === "tasks" && (
            <TasksPage
              assessments={assessments}
              completed={completedWork}
              now={now}
              weekEnd={weekEnd}
              category={taskCategory}
              setCategory={setTaskCategory}
              onAssessment={openAssessment}
            />
          )}
          {page === "calendar" && (
            <CalendarPage
              assessments={assessments}
              academicEvents={academicEvents}
              completed={completedWork}
              now={now}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              weekOf={calendarWeekOf}
              onMonthNavigate={() => setCalendarWeekOf(null)}
              onAssessment={openAssessment}
            />
          )}
          {page === "class" && (
            <ClassPage
              course={course}
              tab={tab}
              setTab={setTab}
              category={category}
              setCategory={setCategory}
              filter={filter}
              setFilter={setFilter}
              assessments={filteredAssessments}
              allAssessments={classAssessments}
              materials={classMaterials}
              announcements={classAnnouncements}
              students={classmates}
              peopleSearch={peopleSearch}
              setPeopleSearch={setPeopleSearch}
              completed={completedWork}
              onAssessment={openAssessment}
              onMaterial={openMaterial}
              onMyClasses={() => setPage("today")}
            />
          )}
          {page === "assessment" && (
            <AssessmentPage
              assessment={assessment}
              course={course}
              now={now}
              completed={completedWork.includes(assessmentId) || Boolean(activitySubmission)}
              activitySubmission={activitySubmission}
              onSubmitActivity={submitActivity}
              onBack={() => openClass(courseId, "Classwork")}
              onCourseBreadcrumb={() => openClass(courseId, "Classwork")}
              onStart={() => startQuiz()}
            />
          )}
          {page === "material" && (
            <MaterialPage
              material={material}
              course={course}
              reviewed={reviewed.includes(material.id)}
              onBack={() => openClass(courseId, "Materials")}
              onReviewed={() =>
                setReviewed((list) =>
                  list.includes(material.id)
                    ? list.filter((id) => id !== material.id)
                    : [...list, material.id],
                )
              }
            />
          )}
          {page === "quiz" && (
            <QuizPage
              assessment={assessment}
              course={course}
              questions={questionSet}
              index={questionIndex}
              setIndex={setQuestionIndex}
              seconds={seconds}
              answers={savedAnswers}
              onAnswer={answer}
              onNext={nextQuestion}
              onSubmit={() => setConfirmSubmit(true)}
              onExit={() => setPage("assessment")}
            />
          )}
          {page === "result" && (
            <ResultPage
              assessment={assessment}
              course={course}
              questions={questionSet}
              answers={savedAnswers}
              score={score}
              instructorGrade={instructorGrade}
              onBack={() => openClass(courseId, "Classwork")}
              onRetake={() => startQuiz()}
            />
          )}
        </main>
        <footer className="footer">
          <span>© 2026 TMCC LMS</span>
          <span>Learning together, one class at a time</span>
        </footer>
      </div>
      {confirmSubmit && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setConfirmSubmit(false)}
        >
          <section
            className="submit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span>
              <ClipboardCheck size={20} />
            </span>
            <h2 id="submit-title">Submit this assessment?</h2>
            <p>
              You answered {Object.keys(savedAnswers).length} of{" "}
              {questionSet.length} questions. Unanswered questions will be
              submitted blank.
            </p>
            <div>
              <button
                className="button-quiet"
                type="button"
                onClick={() => setConfirmSubmit(false)}
              >
                Keep working
              </button>
              <button className="button-primary" type="button" onClick={submit}>
                Submit now <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CalendarPage({ assessments: items, academicEvents: schoolEvents, completed, now, month, onMonthChange, weekOf, onMonthNavigate, onAssessment }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const allEvents = [
    ...items.map((item) => ({
      ...item,
      calendarDate: new Date(item.dueAt),
      assessmentId: item.id,
    })),
    ...schoolEvents.map((item) => ({
      ...item,
      calendarDate: new Date(`${item.date}T12:00:00`),
    })),
  ];
  const monthEvents = allEvents
    .filter((item) => item.calendarDate.getFullYear() === year && item.calendarDate.getMonth() === monthIndex)
    .sort((a, b) => a.calendarDate - b.calendarDate);
  const weekStart = weekOf && new Date(weekOf.getFullYear(), weekOf.getMonth(), weekOf.getDate() - weekOf.getDay());
  const weekEnd = weekStart && new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const agendaEvents = weekOf
    ? allEvents.filter((item) => item.calendarDate >= weekStart && item.calendarDate < weekEnd).sort((a, b) => a.calendarDate - b.calendarDate)
    : monthEvents;
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(month);
  const today = new Date(now);

  return (
    <div className="calendar-page">
      <div className="calendar-heading">
        <div>
          <span className="eyebrow"><i /> ACADEMIC SCHEDULE</span>
          <h1>Academic calendar</h1>
          <p>Term dates, school events, and assessment deadlines in one view.</p>
        </div>
        <div className="calendar-month-controls" aria-label="Calendar month navigation">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => { onMonthNavigate(); onMonthChange(new Date(year, monthIndex - 1, 1)); }}
          ><ChevronLeft size={18} /></button>
          <strong aria-live="polite">{monthLabel}</strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => { onMonthNavigate(); onMonthChange(new Date(year, monthIndex + 1, 1)); }}
          ><ChevronRight size={18} /></button>
        </div>
      </div>
      <p className="calendar-data-note">
        Mock academic schedule for demonstration. Replace these sample term dates and events with the official school calendar.
      </p>
      <div className="calendar-layout">
        <section className="calendar-month" aria-label={`${monthLabel} calendar`}>
          <table className="calendar-table">
            <thead>
              <tr>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <th key={day} scope="col">{day}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, week) => (
                <tr key={week}>
                  {days.slice(week * 7, week * 7 + 7).map((day, weekday) => {
                    const dateEvents = day === null ? [] : monthEvents.filter((item) => item.calendarDate.getDate() === day);
                    const isToday = day === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear();
                    return (
                      <td key={weekday} className={`${day === null ? "calendar-outside" : ""} ${isToday ? "calendar-today" : ""}`}>
                        {day !== null && <>
                          <time dateTime={`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`}>{day}</time>
                          {dateEvents.length > 0 && (
                            <span className="calendar-day-events" aria-label={`${dateEvents.length} scheduled ${dateEvents.length === 1 ? "event" : "events"}`}>
                              <span className="calendar-day-count">{dateEvents.length} {dateEvents.length === 1 ? "event" : "events"}</span>
                              <span className="calendar-event-dots" aria-hidden="true">
                                {[...new Set(dateEvents.map((item) => item.courseId ? `course-${courses.findIndex((courseItem) => courseItem.id === item.courseId)}` : "academic"))].map((kind) => (
                                  <i className={`calendar-event-dot ${kind}`} key={kind} />
                                ))}
                              </span>
                            </span>
                          )}
                        </>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="calendar-agenda" aria-labelledby="calendar-agenda-title">
          <div className="calendar-agenda-heading">
            <div>
              <h2 id="calendar-agenda-title">{weekOf ? "This week" : monthLabel}</h2>
              <p>{agendaEvents.length} scheduled {agendaEvents.length === 1 ? "item" : "items"}</p>
            </div>
            <CalendarDays size={20} />
          </div>
          {agendaEvents.length ? (
            <div className="calendar-event-list">
              {agendaEvents.map((item) => {
                const eventDate = item.calendarDate;
                const courseIndex = courses.findIndex((courseItem) => courseItem.id === item.courseId);
                const isComplete = item.assessmentId && completed.includes(item.assessmentId);
                const isPast = eventDate.getTime() < now;
                const content = <>
                    <time dateTime={item.assessmentId ? formatLocalDateTime(eventDate) : item.date}>
                      <strong>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(eventDate)}</strong>
                      <span>{item.assessmentId ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(eventDate) : "All day"}</span>
                    </time>
                    <span className="calendar-event-info">
                      <strong>{item.title}</strong>
                      <small>{item.assessmentId ? `${courses[courseIndex]?.name ?? "Class"} · ${item.type}` : `Academic calendar · ${item.category}`}</small>
                    </span>
                    <span className={`calendar-event-status ${isComplete ? "complete" : isPast && item.assessmentId ? "past" : "upcoming"}`}>
                      {isComplete ? "Done" : isPast && item.assessmentId ? "Past due" : item.assessmentId ? "Upcoming" : "Scheduled"}
                    </span>
                  </>;
                return item.assessmentId ? (
                  <button className={`calendar-event card-${Math.max(courseIndex, 0)}`} type="button" key={item.id} onClick={() => onAssessment(item.assessmentId)}>{content}</button>
                ) : (
                  <article className="calendar-event calendar-event-academic" key={item.id}>{content}</article>
                );
              })}
            </div>
          ) : <p className="calendar-empty">No dates are scheduled {weekOf ? "this week" : "this month"}.</p>}
        </section>
      </div>
    </div>
  );
}

function TodayPage({ onClass, onAssessment, onMaterial, onDueThisWeek, onAssessmentsDone, onWeekActivities, dueThisWeekCount, dueSoon, completed, weekSchoolEventItems, assessments: calendarAssessments, academicEvents, now, onCalendar }) {
  const [dashboardView, setDashboardView] = useState("overview");
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [carouselHovered, setCarouselHovered] = useState(false);
  const [carouselFocused, setCarouselFocused] = useState(false);
  const [motionAllowed] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const reviewMonth = new Date(now);
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(reviewMonth);
  const monthDates = [
    ...academicEvents.map((item) => ({ ...item, date: new Date(`${item.date}T12:00:00`) })),
    ...calendarAssessments.map((item) => ({ ...item, date: new Date(item.dueAt) })),
  ].filter((item) => item.date.getFullYear() === reviewMonth.getFullYear() && item.date.getMonth() === reviewMonth.getMonth())
    .sort((a, b) => a.date - b.date);
  const academicDateCount = monthDates.filter((item) => !item.dueAt).length;
  const assessmentDateCount = monthDates.length - academicDateCount;
  const firstWeekday = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
  const weekEventNote = weekSchoolEventItems.length
    ? weekSchoolEventItems.slice(0, 2).map((item) => `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${item.date}T00:00:00`))} · ${item.title}`).join("; ")
    : "No school events this week";
  const upcomingSchoolEvents = academicEvents
    .map((item) => ({ ...item, eventDate: new Date(`${item.date}T00:00:00`) }))
    .filter((item) => item.eventDate >= new Date(reviewMonth.getFullYear(), reviewMonth.getMonth(), reviewMonth.getDate()))
    .sort((a, b) => a.eventDate - b.eventDate);
  const announcements = featuredAnnouncements.flatMap((announcement) => {
    const event = upcomingSchoolEvents.find((item) => item.id === announcement.eventId);
    return event ? [{ ...event, ...announcement }] : [];
  });
  const activeAnnouncement = announcements[announcementIndex % announcements.length];

  useEffect(() => {
    if (!motionAllowed || carouselHovered || carouselFocused || announcements.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setAnnouncementIndex((current) => (current + 1) % announcements.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [motionAllowed, carouselHovered, carouselFocused, announcements.length]);

  return (
    <div className="today-page">
      <div className="welcome">
        <div>
          <span className="eyebrow">
            <i /> FRIDAY, OCTOBER 23, 2026
          </span>
          <h1>
            Good morning, Alex <span>✦</span>
          </h1>
          <p>Ready to make today a great learning day?</p>
        </div>
        <div className="dashboard-view-switch" role="group" aria-label="Dashboard content">
          <button type="button" aria-pressed={dashboardView === "overview"} onClick={() => setDashboardView("overview")}>Overview</button>
          <button type="button" aria-pressed={dashboardView === "news"} onClick={() => setDashboardView("news")}>News &amp; announcements</button>
        </div>
      </div>
      {dashboardView === "news" ? (
        <section className="dashboard-news" aria-labelledby="dashboard-news-title">
          <div className="page-heading">
            <div>
              <small>NEWS &amp; ANNOUNCEMENTS</small>
              <h2 id="dashboard-news-title">Class updates</h2>
              <p>Updates from your teachers and across the school.</p>
            </div>
          </div>
          {activeAnnouncement && <section
            className="announcement-carousel"
            aria-label="Featured school announcements"
            aria-roledescription="carousel"
            onMouseEnter={() => setCarouselHovered(true)}
            onMouseLeave={() => setCarouselHovered(false)}
            onFocusCapture={() => setCarouselFocused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCarouselFocused(false); }}
          >
            <article
              key={activeAnnouncement.id}
              className="next-school-event announcement-slide"
              style={{ backgroundImage: `linear-gradient(90deg, rgba(17, 57, 44, 0.94), rgba(17, 57, 44, 0.78) 48%, rgba(17, 57, 44, 0.12) 100%), url("${activeAnnouncement.image}")` }}
              aria-roledescription="slide"
              aria-label={`${announcementIndex + 1} of ${announcements.length}`}
            >
              <span className="next-school-event-icon"><CalendarDays size={22} /></span>
              <div>
                <small>FEATURED ANNOUNCEMENT · {activeAnnouncement.category}</small>
                <h2>{activeAnnouncement.title}</h2>
                <p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(activeAnnouncement.eventDate)}</p>
                <p className="announcement-summary">{activeAnnouncement.summary}</p>
              </div>
              <button type="button" onClick={onCalendar}>View calendar <ArrowRight size={15} /></button>
            </article>
            <div className="announcement-carousel-controls">
              <div className="announcement-pagination" aria-label="Choose announcement">
                {announcements.map((announcement, index) => <button
                  key={announcement.id}
                  type="button"
                  aria-label={`Show announcement ${index + 1}: ${announcement.title}`}
                  aria-current={index === announcementIndex ? "true" : undefined}
                  onClick={() => setAnnouncementIndex(index)}
                />)}
              </div>
              <span className="announcement-count">{String((announcementIndex % announcements.length) + 1).padStart(2, "0")} / {String(announcements.length).padStart(2, "0")}</span>
              <button type="button" aria-label="Previous announcement" onClick={() => setAnnouncementIndex((current) => (current - 1 + announcements.length) % announcements.length)}><ChevronLeft size={16} /></button>
              <button type="button" aria-label="Next announcement" onClick={() => setAnnouncementIndex((current) => (current + 1) % announcements.length)}><ChevronRight size={16} /></button>
            </div>
          </section>}
          <section className="news-section" aria-labelledby="teacher-announcements-title">
            <div className="news-section-heading">
              <div><small>YOUR CLASSES</small><h2 id="teacher-announcements-title">Teacher announcements</h2></div>
            </div>
            <Stream
              course={courses[0]}
              onClasswork={() => onClass(courses[0].id, "Classwork")}
              onMaterial={onMaterial}
            />
          </section>
          <section className="news-section school-news" aria-labelledby="school-announcements-title">
            <div className="news-section-heading">
              <div><small>TMCC LMS</small><h2 id="school-announcements-title">School announcements</h2></div>
              <span>{upcomingSchoolEvents.length} upcoming</span>
            </div>
            <div className="school-announcement-list">
              {upcomingSchoolEvents.length ? upcomingSchoolEvents.map((item) => (
                <article className="school-announcement" key={item.id}>
                  <time dateTime={item.date}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(item.eventDate)}</time>
                  <span><strong>{item.title}</strong><small>{item.category} · Academic calendar</small></span>
                </article>
              )) : <p className="empty-state">No upcoming school announcements.</p>}
            </div>
          </section>
        </section>
      ) : <>
      <div className="stats-grid">
        <Stat
          icon={<BookOpen size={17} />}
          color="mint"
          value={courses.length}
          label="Active classes"
          note="This term"
        />
        <Stat
          icon={<AlarmClock size={17} />}
          color="amber"
          value={dueThisWeekCount}
          label="Due this week"
          note="Keep going"
          onClick={onDueThisWeek}
        />
        <Stat
          icon={<ClipboardCheck size={17} />}
          color="lilac"
          value={completed.length}
          label="Assessments done"
          note="Great progress"
          onClick={onAssessmentsDone}
        />
        <Stat
          icon={<CalendarDays size={17} />}
          color="mint"
          value={weekSchoolEventItems.length}
          label="Academic events"
          note={weekEventNote}
          onClick={onWeekActivities}
        />
      </div>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <small>YOUR LEARNING SPACE</small>
            <h2>
              Your classes <em>{courses.length}</em>
            </h2>
          </div>
          <button
            className="link-button"
            onClick={() => courses[0] && onClass(courses[0].id)}
            disabled={!courses.length}
            type="button"
          >
            Open {courses[0]?.name || "a class"} <ArrowRight size={15} />
          </button>
        </div>
        <div className="class-grid">
          {courses.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`class-card card-${index}`}
              onClick={() => onClass(item.id)}
            >
              <div className="class-cover">
                <span>{item.subject}</span>
                <b aria-hidden="true">{item.symbol}</b>
                <i />
                <i />
              </div>
              <div className="class-card-content">
                <div className="class-name">
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.section}</small>
                  </span>
                  <MoreHorizontal size={18} />
                </div>
                <div className="teacher">
                  <Avatar name={item.teacher} tone={index + 2} small />
                  {item.teacher}
                </div>
                <div className="class-card-bottom">
                  <span>
                    <UsersRound size={14} />
                    {item.count} students
                  </span>
                  <small>Next class · {item.next}</small>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      <div className="lower-grid">
        <section className="panel upcoming">
          <div className="panel-title">
            <div>
              <small>STAY ON TRACK</small>
              <h2>
                Coming up <em>{dueSoon.length}</em>
              </h2>
            </div>
            <MoreHorizontal size={19} />
          </div>
          <div className="upcoming-list">
            {dueSoon.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAssessment(item.id)}
              >
                <span className={`up-icon up-${index}`}>
                  <ClipboardCheck size={17} />
                </span>
                <span className="up-copy">
                  <strong>{item.title}</strong>
                  <small>
                    {courses.find((entry) => entry.id === item.courseId)?.name}{" "}
                    <i>·</i> {item.type}
                  </small>
                </span>
                <span className="due-pill">{formatDueDate(item.dueAt)}</span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
          <button
            className="panel-link"
            type="button"
            onClick={() => onClass(courses[0].id)}
          >
            See all classwork <ArrowRight size={14} />
          </button>
        </section>
        <section className="month-review" aria-labelledby="month-review-title">
          <div className="focus-top">
            <span><i /> MONTH REVIEW</span>
            <small>{monthLabel}</small>
          </div>
          <h2 id="month-review-title">Academic calendar</h2>
          <p>{academicDateCount} academic dates · {assessmentDateCount} assessment deadlines</p>
          <table className="month-review-calendar" aria-label={`${monthLabel} academic calendar`}>
            <thead><tr>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <th key={day} scope="col">{day}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: calendarDays.length / 7 }, (_, week) => (
                <tr key={week}>{calendarDays.slice(week * 7, week * 7 + 7).map((day, weekday) => {
                  const dayEvents = day === null ? [] : monthDates.filter((item) => item.date.getDate() === day);
                  const isToday = day === reviewMonth.getDate();
                  return <td key={weekday}>{day !== null && <time className={`${isToday ? "today" : ""} ${dayEvents.length ? "has-events" : ""}`} dateTime={`${reviewMonth.getFullYear()}-${String(reviewMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`} aria-label={`${monthLabel} ${day}${dayEvents.length ? `, ${dayEvents.map((item) => item.title).join(", ")}` : ""}`} title={dayEvents.map((item) => item.title).join(", ")}>{day}{[...new Set(dayEvents.map((item) => item.dueAt ? `assessment-${Math.max(courses.findIndex((courseItem) => courseItem.id === item.courseId), 0)}` : "academic"))].map((kind) => <i className={kind} key={kind} />)}</time>}</td>;
                })}</tr>
              ))}
            </tbody>
          </table>
          <button className="month-review-link" type="button" onClick={onCalendar}>Open calendar <ArrowRight size={14} /></button>
        </section>
      </div>
      </>}
    </div>
  );
}

function TasksPage({ assessments: items, completed, now, weekEnd, category, setCategory, onAssessment }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const groups = [
    {
      title: "Due soon",
      description: "Work with a future due date",
      items: items.filter(
        (item) =>
          !completed.includes(item.id) && new Date(item.dueAt).getTime() >= now,
      ),
    },
    {
      title: "Due this week",
      description: "Unfinished work due before the week ends",
      items: items.filter(
        (item) =>
          !completed.includes(item.id) &&
          new Date(item.dueAt).getTime() >= now &&
          new Date(item.dueAt) < weekEnd,
      ),
    },
    {
      title: "Missing",
      description: "Work past its due date that has not been submitted",
      items: items.filter(
        (item) =>
          !completed.includes(item.id) && new Date(item.dueAt).getTime() < now,
      ),
    },
    {
      title: "Done",
      description: "Assessments you have submitted",
      items: items.filter((item) => completed.includes(item.id)),
    },
  ];
  const group = groups.find((item) => item.title === category);
  const CategoryIcon =
    category === "Missing" ? AlarmClock : category === "Done" ? Check : CalendarDays;

  useEffect(() => {
    function closeFilter(event) {
      if (!filterRef.current?.open) return;
      if (event.key === "Escape") {
        filterRef.current.open = false;
        setFilterOpen(false);
        filterRef.current.querySelector("summary")?.focus();
      } else if (!filterRef.current?.contains(event.target)) {
        filterRef.current.open = false;
        setFilterOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeFilter);
    document.addEventListener("keydown", closeFilter);
    return () => {
      document.removeEventListener("pointerdown", closeFilter);
      document.removeEventListener("keydown", closeFilter);
    };
  }, []);

  return (
    <div className="classwork-page tasks-page">
      <div className="page-heading">
        <div>
          <small>YOUR WORK</small>
          <h2>Tasks</h2>
          <p>See due dates, missing work, and completed assessments.</p>
        </div>
        <div className="task-filter-wrap" ref={filterRef}>
          <span className="task-filter-caption">FILTER BY STATUS</span>
          <details
            className="task-filter"
            onToggle={(event) => setFilterOpen(event.currentTarget.open)}
          >
            <summary aria-expanded={filterOpen} aria-controls="task-status-options">
              <span className={`task-filter-icon task-filter-${category.toLowerCase().replace(" ", "-")}`}>
                <CategoryIcon size={17} aria-hidden="true" />
              </span>
              <span className="task-filter-current">
                <strong>{category}</strong>
                <small>{group.items.length} {group.items.length === 1 ? "task" : "tasks"}</small>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div id="task-status-options" className="task-filter-menu" role="group" aria-label="Task status">
              {groups.map((option) => {
                const OptionIcon =
                  option.title === "Missing" ? AlarmClock : option.title === "Done" ? Check : CalendarDays;
                const selected = option.title === category;
                return (
                  <button
                    className={`task-filter-option ${selected ? "selected" : ""}`}
                    type="button"
                    key={option.title}
                    aria-pressed={selected}
                    onClick={() => {
                      setCategory(option.title);
                      filterRef.current.open = false;
                      setFilterOpen(false);
                    }}
                  >
                    <span className={`task-filter-icon task-filter-${option.title.toLowerCase().replace(" ", "-")}`}>
                      <OptionIcon size={16} aria-hidden="true" />
                    </span>
                    <span className="task-filter-option-copy">
                      <strong>{option.title}</strong>
                      <small>{option.description}</small>
                    </span>
                    <em>{option.items.length}</em>
                    {selected && <Check size={15} className="task-filter-check" />}
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      </div>
      <section className="work-group" key={group.title}>
          <div className="group-title">
            <span className="group-mark">
              <ClipboardCheck size={17} />
            </span>
            <span>
              <strong>{group.title}</strong>
              <small>{group.description}</small>
            </span>
            <em>{group.items.length}</em>
          </div>
          <div className="assessment-list">
            {group.items
              .slice()
              .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
              .map((item) => (
                <AssessmentRow
                  key={item.id}
                  item={item}
                  completed={completed.includes(item.id)}
                  status={group.title === "Missing" ? "missing" : ""}
                  onClick={() => onAssessment(item.id)}
                />
              ))}
            {!group.items.length && (
              <div className="empty-state">No {group.title.toLowerCase()} work.</div>
            )}
          </div>
      </section>
    </div>
  );
}

function Stat({ icon, color, value, label, note, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`stat-card${onClick ? " stat-card-button" : ""}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <span className={`stat-icon ${color}`}>{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      <small title={onClick ? note : undefined}>{note}</small>
    </Tag>
  );
}

function ClassPage({
  course,
  tab,
  setTab,
  category,
  setCategory,
  filter,
  setFilter,
  assessments: shownAssessments,
  allAssessments,
  materials: shownMaterials,
  announcements,
  students: shownStudents,
  peopleSearch,
  setPeopleSearch,
  completed,
  onAssessment,
  onMaterial,
  onMyClasses,
}) {
  const tabs = ["Stream", "Classwork", "Materials", "People"];
  return (
    <div className="class-page">
      <section
        className={`course-hero hero-${courses.findIndex((item) => item.id === course.id)} ${course.id === "biology" ? "hero-live-class" : ""}`}
      >
        <div className="hero-copy">
          <div className="hero-crumb">
            <button type="button" onClick={onMyClasses}>
              My classes
            </button>
            <ChevronRight size={13} /> {course.section}
          </div>
          <small>{course.subject}</small>
          <h1>{course.name}</h1>
          <p>
            {course.section}
            <span> · </span>
            {course.room}
          </p>
          <div className="hero-teacher">
            <Avatar name={course.teacher} tone={2} small />
            With {course.teacher}
            <span>
              <UsersRound size={14} />
              {course.count} students
            </span>
          </div>
          {course.id === "biology" && (
            <a
              className="discord-class-link"
              href="https://discord.com/app"
              target="_blank"
              rel="noreferrer"
            >
              Join live class on Discord <ArrowRight size={14} />
            </a>
          )}
        </div>
        <div className="hero-art">
          <i />
          <b>{course.symbol}</b>
          <span>✦</span>
        </div>
      </section>
      <div className="class-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "tab-active" : ""}
            type="button"
            onClick={() => {
              setTab(item);
              setFilter("");
            }}
          >
            {item}
            {item === "Classwork" && <em>{allAssessments.length}</em>}
          </button>
        ))}
      </div>
      {tab === "Stream" && (
        <Stream
          course={course}
          announcements={announcements}
          onClasswork={() => setTab("Classwork")}
          onMaterial={onMaterial}
        />
      )}
      {tab === "Classwork" && (
        <Classwork
          course={course}
          category={category}
          setCategory={setCategory}
          filter={filter}
          setFilter={setFilter}
          assessments={shownAssessments}
          materials={shownMaterials}
          completed={completed}
          onAssessment={onAssessment}
          onMaterial={onMaterial}
        />
      )}
      {tab === "Materials" && (
        <MaterialsTab
          course={course}
          materials={shownMaterials}
          filter={filter}
          setFilter={setFilter}
          onMaterial={onMaterial}
        />
      )}
      {tab === "People" && (
        <PeopleTab
          course={course}
          students={shownStudents}
          query={peopleSearch}
          setQuery={setPeopleSearch}
        />
      )}
    </div>
  );
}

function Stream({ course, announcements, onClasswork, onMaterial }) {
  const resource = materials.find((item) => item.courseId === course.id);
  return (
    <div className="stream-layout">
      <div className="stream-main">
        {announcements.length ? announcements.map((item) => <article className="announcement" key={item.id}>
          <div className="announcement-head"><Avatar name={item.author} tone={2} /><span><strong>{item.author}</strong><small>Class announcement · {formatDueDate(item.createdAt)}</small></span><MoreHorizontal size={19} /></div>
          <div className="announcement-body"><small>ANNOUNCEMENT · {course.subject.toUpperCase()}</small><h2>{item.title}</h2><p className="shared-announcement-message">{item.message}</p></div>
          <div className="announcement-footer"><span>{course.section}</span><span>Shared with this class</span></div>
        </article>) : <article className="announcement">
          <div className="announcement-head">
            <Avatar name={course.teacher} tone={2} />
            <span>
              <strong>{course.teacher}</strong>
              <small>Posted an announcement · 2 hours ago</small>
            </span>
            <MoreHorizontal size={19} />
          </div>
          <div className="announcement-body">
            <small>THIS WEEK IN {course.subject.toUpperCase()}</small>
            <h2>Welcome to another week of learning!</h2>
            <p>
              We’re building on what we learned last week. Check the classwork
              tab for this week’s activities and take a look at the study notes
              before our next class.
            </p>
            <button type="button" className="inline-link" onClick={onClasswork}>
              Explore this week’s work <ArrowRight size={14} />
            </button>
          </div>
          <div className="announcement-footer">
            <span>✦ &nbsp;8</span>
            <span>💬 &nbsp;3 comments</span>
            <span>Comments are read-only in this demo</span>
          </div>
        </article>}
        <article className="stream-update">
          <span className="update-icon">
            <FileText size={17} />
          </span>
          <div>
            <strong>New material: {resource?.title}</strong>
            <small>{course.teacher} · Yesterday</small>
            <p>A helpful resource has been added to your class materials.</p>
            <button
              className="inline-link"
              type="button"
              onClick={() => resource && onMaterial(resource.id)}
            >
              Open material <ArrowRight size={14} />
            </button>
          </div>
        </article>
        <article className="stream-update">
          <span className="update-icon assignment">
            <ClipboardCheck size={17} />
          </span>
          <div>
            <strong>New assignment posted</strong>
            <small>{course.teacher} · Monday</small>
            <p>
              Remember to review the instructions and submit your work before
              the due date.
            </p>
            <button className="inline-link" type="button" onClick={onClasswork}>
              View classwork <ArrowRight size={14} />
            </button>
          </div>
        </article>
      </div>
      <aside className="stream-aside">
        <div className="aside-card">
          <div>
            <span className="aside-icon">
              <CalendarDays size={16} />
            </span>
            <strong>Upcoming</strong>
          </div>
          <p>No work due today. Enjoy your focus time!</p>
          <button type="button" onClick={onClasswork}>
            View all <ArrowRight size={13} />
          </button>
        </div>
        <div className="aside-card">
          <div>
            <span className="aside-icon book">
              <BookOpen size={16} />
            </span>
            <strong>About this class</strong>
          </div>
          <p>{course.about}</p>
          <small>
            <UsersRound size={14} />
            {course.count} students
          </small>
          <small>
            <GraduationCap size={14} />
            {course.room}
          </small>
          <button type="button" onClick={onClasswork}>
            Explore classwork <ArrowRight size={13} />
          </button>
        </div>
      </aside>
    </div>
  );
}

function Classwork({
  course,
  category,
  setCategory,
  filter,
  setFilter,
  assessments: items,
  materials: resources,
  completed,
  onAssessment,
  onMaterial,
}) {
  const count = (type) =>
    assessments.filter(
      (item) => item.courseId === course.id && item.type === type,
    ).length;
  const showAssessments = category !== "Materials";
  const showMaterials = category === "All work" || category === "Materials";
  return (
    <div className="classwork-page">
      <div className="page-heading">
        <div>
          <small>{course.section.toUpperCase()}</small>
          <h2>Classwork</h2>
          <p>Everything you need for this class, all in one place.</p>
        </div>
        <div className="work-actions">
          <label className="list-search">
            <Search size={15} />
            <input
              aria-label="Search classwork"
              placeholder="Find classwork"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          <span className="sort-label">Newest first</span>
        </div>
      </div>
      <div className="category-tabs">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? "category-active" : ""}
            type="button"
            onClick={() => setCategory(item)}
          >
            {item}
            {["Quiz", "Long Quiz", "Exam"].includes(item) && (
              <span>{count(item)}</span>
            )}
          </button>
        ))}
      </div>
      {showAssessments && (
        <section className="work-group">
          <div className="group-title">
            <span className="group-mark">
              <ClipboardCheck size={17} />
            </span>
            <span>
              <strong>
                {category === "All work" ? "Assessments" : category}
              </strong>
              <small>Quizzes, long quizzes and exams</small>
            </span>
            <em>{items.length}</em>
          </div>
          <div className="assessment-list">
            {items.map((item) => (
              <AssessmentRow
                key={item.id}
                item={item}
                completed={completed.includes(item.id)}
                onClick={() => onAssessment(item.id)}
              />
            ))}
            {!items.length && (
              <div className="empty-state">
                No work in this category matches your search.
              </div>
            )}
          </div>
        </section>
      )}
      {showMaterials && (
        <section className="work-group">
          <div className="group-title">
            <span className="group-mark material-mark">
              <BookOpen size={17} />
            </span>
            <span>
              <strong>Learning materials</strong>
              <small>Notes and resources for this class</small>
            </span>
            <em>{resources.length}</em>
          </div>
          <div className="materials-list">
            {resources.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onMaterial(item.id)}
              >
                <span className="material-file-icon">
                  <FileText size={17} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.kind} · {item.readTime} read
                  </small>
                </span>
                <small className="resource-added">{item.added}</small>
                <ChevronRight size={16} />
              </button>
            ))}
            {!resources.length && (
              <div className="empty-state">No materials match your search.</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function AssessmentRow({ item, completed, status = "", onClick }) {
  const Icon =
    item.type === "Exam"
      ? GraduationCap
      : item.type === "Long Quiz"
        ? ListChecks
        : CircleHelp;
  const tone =
    item.type === "Exam" ? "exam" : item.type === "Long Quiz" ? "long" : "quiz";
  return (
    <button className="assessment-row" type="button" onClick={onClick}>
      <span className={`assessment-type-icon ${tone}`}>
        <Icon size={18} />
      </span>
      <span className="assessment-copy">
        <strong>{item.title}</strong>
        <small>{item.description}</small>
        <span>
          {item.type}
          <i>·</i>
          {item.questionCount} questions<i>·</i>
          {item.points} points
        </span>
      </span>
      <span className="assessment-due">
        <small>Due</small>
        <strong>{formatDueDate(item.dueAt)}</strong>
      </span>
      {status === "missing" && <span className="task-status">Missing</span>}
      {completed && (
        <span className="submitted">
          <Check size={12} />
          Submitted
        </span>
      )}
      <ChevronRight size={16} className="row-arrow" />
    </button>
  );
}

function MaterialsTab({
  course,
  materials: resources,
  filter,
  setFilter,
  onMaterial,
}) {
  return (
    <div className="materials-page">
      <div className="page-heading">
        <div>
          <small>{course.section.toUpperCase()}</small>
          <h2>Class materials</h2>
          <p>Read, revisit, and keep your learning resources close.</p>
        </div>
        <label className="list-search">
          <Search size={15} />
          <input
            aria-label="Search materials"
            placeholder="Search materials"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </div>
      <div className="resource-grid">
        {resources.map((item, index) => (
          <button
            className="resource-card"
            type="button"
            key={item.id}
            onClick={() => onMaterial(item.id)}
          >
            <span className={`resource-icon resource-${index % 3}`}>
              <FileText size={21} />
            </span>
            <small>{item.kind}</small>
            <strong>{item.title}</strong>
            <p>{item.summary}</p>
            <span className="resource-card-foot">
              <span>
                <Clock3 size={13} />
                {item.readTime}
              </span>
              {item.added}
              <ArrowRight size={14} />
            </span>
          </button>
        ))}
        {!resources.length && (
          <div className="empty-state">No materials found.</div>
        )}
      </div>
    </div>
  );
}

function PeopleTab({ course, students: roster, query, setQuery }) {
  return (
    <div className="people-page">
      <div className="page-heading">
        <div>
          <small>YOUR CLASS COMMUNITY</small>
          <h2>
            People <em>{course.count}</em>
          </h2>
          <p>Get to know the classmates learning alongside you.</p>
        </div>
        <label className="list-search">
          <Search size={15} />
          <input
            placeholder="Find a student"
            aria-label="Find a student"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="section-summary">
        <span>
          <UsersRound size={19} />
        </span>
        <div>
          <small>CLASS SECTION</small>
          <strong>{course.section}</strong>
        </div>
        <i />
        <div>
          <small>ENROLLED STUDENTS</small>
          <strong>{course.count} students</strong>
        </div>
        <b>{course.subject}</b>
      </div>
      <div className="roster-title">
        <strong>Classmates</strong>
        <span>{roster.length} shown</span>
        <span className="sort-label">Name A–Z</span>
      </div>
      <div className="roster">
        {roster.map((student, index) => (
          <div className="roster-row" key={student.id}>
            <Avatar name={student.name} tone={index + 1} />
            <span>
              <strong>{student.name}</strong>
              <small>{student.email}</small>
            </span>
            <em>{student.role}</em>
            <MoreHorizontal size={18} />
          </div>
        ))}
        {!roster.length && (
          <div className="empty-state">No classmates match your search.</div>
        )}
      </div>
      <div className="teacher-row">
        <span>
          <GraduationCap size={18} />
        </span>
        <small>YOUR TEACHER</small>
        <strong>{course.teacher}</strong>
        <em>Class teacher</em>
      </div>
    </div>
  );
}

function AssessmentPage({
  assessment,
  course,
  now,
  completed,
  activitySubmission,
  onBack,
  onCourseBreadcrumb,
  onStart,
  onSubmitActivity,
}) {
  const [fileName, setFileName] = useState("");
  const [comment, setComment] = useState("");
  const isActivity = assessment.kind === "activity";
  const isLate = assessment.dueAt && new Date(assessment.dueAt).getTime() < now;
  const isClosed = isActivity && isLate && !assessment.allowLate;
  const TypeIcon =
    assessment.type === "Exam"
      ? GraduationCap
      : assessment.type === "Long Quiz"
        ? ListChecks
        : CircleHelp;
  return (
    <div className="detail-page">
      <button className="back-link" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to classwork
      </button>
      <div className="detail-layout">
        <article className="detail-main">
          <div className="detail-breadcrumb">
            <span
              className={`assessment-type-icon ${assessment.type === "Exam" ? "exam" : assessment.type === "Long Quiz" ? "long" : "quiz"}`}
            >
              <TypeIcon size={17} />
            </span>
            <button
              className="breadcrumb-link"
              type="button"
              onClick={onCourseBreadcrumb}
            >
              {course.name}
            </button>
            <ChevronRight size={13} />
            {assessment.type}
          </div>
          <h1>{assessment.title}</h1>
          <p className="detail-subtitle">{assessment.description}</p>
          <div className="detail-author">
            <Avatar name={course.teacher} tone={2} small />
            <span>
              <strong>{course.teacher}</strong>
              <small>Posted Oct 20, 2026</small>
            </span>
          </div>
          <hr />
          <div className="instruction-card">
            <span>
              <FileText size={17} />
            </span>
            <strong>Instructions</strong>
            <p>{assessment.instructions}</p>
            <p>{isActivity ? "Attach the filename for your work and leave a note for your instructor. This demo stores the filename only." : "Choose the best answer for every question. You may revisit questions before submitting."}</p>
          </div>
          {!isActivity && <div className="detail-note">
            <span>
              <AlarmClock size={16} />
            </span>
            <span>
              <strong>One minute per question</strong>
              <small>
                Your timer is individual to each question. Time pauses while you
                review other questions.
              </small>
            </span>
          </div>}
          {completed && !isActivity && (
            <div className="complete-note">
              <Check size={15} />
              You have submitted this assessment. You can view your result or
              practice again.
            </div>
          )}
          {activitySubmission && <div className="complete-note"><Check size={15} />Submitted · {activitySubmission.grade === null ? "Waiting for instructor review" : `${activitySubmission.grade} / ${assessment.points} points`}{activitySubmission.feedback && <span> · {activitySubmission.feedback}</span>}</div>}
          {isActivity && (!completed || assessment.allowResubmission) && <form className="activity-submit-form" onSubmit={(event) => { event.preventDefault(); onSubmitActivity({ fileName, comment }); setFileName(""); setComment(""); }}><h2>{activitySubmission ? "Submit a new version" : "Turn in your work"}</h2><p>{isClosed ? "The due date has passed and late submissions are turned off." : "Use the filename of the document you prepared for this classroom."}</p><label>Attachment filename<input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="research-notes.pdf" required disabled={isClosed} /></label><label>Comment for instructor<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows="3" placeholder="Add a note about your work" disabled={isClosed} /></label><button className="button-primary" type="submit" disabled={isClosed}>{activitySubmission ? "Resubmit work" : "Submit work"}<ArrowRight size={15} /></button></form>}
        </article>
        <aside className="assessment-summary">
          <div className="summary-head">
            <strong>ASSESSMENT DETAILS</strong>
            <span>
              <i />
              Open
            </span>
          </div>
          <div className="summary-type">
            <span>
              <TypeIcon size={20} />
            </span>
            <small>
              ASSESSMENT TYPE<strong>{assessment.type}</strong>
            </small>
          </div>
          <div className="detail-facts">
            {[
              [isActivity ? "Submission" : "Questions", isActivity ? "File + comment" : assessment.questionCount, ListChecks],
              ["Time limit", isActivity ? "—" : assessment.timeLimit, Clock3],
              ["Points", `${assessment.points} pts`, ClipboardCheck],
              ["Due date", assessment.due || formatDueDate(assessment.dueAt), CalendarDays],
            ].map(([label, value, Icon]) => (
              <div key={label}>
                <span>
                  <Icon size={15} />
                </span>
                <small>
                  {label}
                  <strong>{value}</strong>
                </small>
              </div>
            ))}
          </div>
          <div className="summary-progress">
            <span>Your progress</span>
            <strong>{completed ? "Submitted" : "Not started"}</strong>
            <div>
              <i style={{ width: completed ? "100%" : "0%" }} />
            </div>
          </div>
          {!isActivity && <button
            className="button-primary start-button"
            type="button"
            onClick={onStart}
          >
            {completed ? "Practice again" : "Start assessment"}
            <ArrowRight size={16} />
          </button>}
          <small className="summary-safe">
            <ShieldCheck size={13} />
            Your answers save as you go
          </small>
        </aside>
      </div>
    </div>
  );
}

function MaterialPage({ material, course, reviewed, onBack, onReviewed }) {
  return (
    <div className="material-detail">
      <button className="back-link" type="button" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to {course.name}
      </button>
      <div className="material-detail-card">
        <div className="material-banner">
          <span>
            <FileText size={25} />
          </span>
          <div>
            <small>
              {course.name} · {material.kind}
            </small>
            <h1>{material.title}</h1>
            <p>
              Added {material.added} by {course.teacher}
            </p>
          </div>
          <b>✳</b>
        </div>
        <div className="material-detail-body">
          <article>
            <div className="reading-toolbar">
              <span>
                <Clock3 size={14} />
                {material.readTime} read
              </span>
              <MoreHorizontal size={18} />
            </div>
            <h2>{material.title}</h2>
            <p className="reading-intro">{material.summary}</p>
            <div className="learning-goal">
              <BookOpen size={17} />
              <span>
                <strong>Learning goal</strong>
                <small>{material.goal}</small>
              </span>
            </div>
            <h3>Key ideas</h3>
            {material.points.map((point, index) => (
              <div className="material-point" key={point}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{point}</p>
              </div>
            ))}
            <button
              className={reviewed ? "button-reviewed" : "button-primary"}
              type="button"
              onClick={onReviewed}
            >
              {reviewed ? (
                <>
                  <Check size={15} />
                  Reviewed
                </>
              ) : (
                <>
                  Mark as reviewed <Check size={15} />
                </>
              )}
            </button>
          </article>
          <aside>
            <span>
              <FileText size={19} />
            </span>
            <strong>Study resource</strong>
            <p>
              This class material is ready whenever you need it. Your review
              status stays on this device.
            </p>
            <div>
              <small>Class</small>
              <strong>{course.section}</strong>
            </div>
            <div>
              <small>Format</small>
              <strong>{material.kind}</strong>
            </div>
            <div>
              <small>Reading time</small>
              <strong>{material.readTime}</strong>
            </div>
            <button
              type="button"
              className="button-primary"
              style={{ marginTop: 16, width: "100%", justifyContent: "center", gap: 8 }}
              onClick={() => {
                const fn = `${material.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.pdf`;
                const blob = new Blob([`TMCC LEARNING MATERIAL\nTitle: ${material.title}\nCourse: ${course.name}\n\nSummary:\n${material.summary}\n\nLearning Goal:\n${material.goal}\n\nKey Ideas:\n${material.points.join("\n")}`], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fn;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={15} />
              Download material (.pdf)
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function QuizPage({
  assessment,
  course,
  questions,
  index,
  setIndex,
  seconds,
  answers,
  onAnswer,
  onNext,
  onSubmit,
  onExit,
}) {
  const question = questions[index];
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="quiz-page">
      <div className="quiz-top">
        <button type="button" className="back-link" onClick={onExit}>
          <ArrowLeft size={15} />
          Exit assessment
        </button>
        <span>
          <i className="course-dot dot-0" />
          {course.name}
        </span>
        <small>
          <ShieldCheck size={14} />
          Your work saves automatically
        </small>
      </div>
      <div className="quiz-layout">
        <div className="quiz-main">
          <div className="quiz-heading">
            <div>
              <span className="assessment-pill">{assessment.type}</span>
              <h1>{assessment.title}</h1>
              <p>
                {course.section} <i>·</i> {assessment.points} points
              </p>
            </div>
            <div className={`timer ${seconds <= 15 ? "timer-warning" : ""}`}>
              <span>
                <Clock3 size={18} />
              </span>
              <div>
                <small>TIME LEFT</small>
                <strong>{time}</strong>
                <em>for this question</em>
              </div>
            </div>
          </div>
          <div className="quiz-progress">
            <div>
              <span>
                Question <strong>{String(index + 1).padStart(2, "0")}</strong>
                <small> of {String(questions.length).padStart(2, "0")}</small>
              </span>
              <small>{Object.keys(answers).length} answered</small>
            </div>
            <i>
              <span
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </i>
          </div>
          <section className="question-card">
            <div className="question-label">
              <span>QUESTION {String(index + 1).padStart(2, "0")}</span>
              <small>{question.points} points</small>
            </div>
            <h2>{question.prompt}</h2>
            {question.context && (
              <p className="question-context">{question.context}</p>
            )}
            <div
              className="options"
              role="radiogroup"
              aria-label="Choose an answer"
            >
              {question.options.map((option, optionIndex) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={answers[index] === optionIndex}
                  className={
                    answers[index] === optionIndex
                      ? "option selected"
                      : "option"
                  }
                  onClick={() => onAnswer(optionIndex)}
                >
                  <span>{String.fromCharCode(65 + optionIndex)}</span>
                  <strong>{option}</strong>
                  <i>
                    <Check size={14} />
                  </i>
                </button>
              ))}
            </div>
            <div className="question-help">
              <span>
                <CircleHelp size={14} />
                Select one answer
              </span>
              <small>Each question has its own timer</small>
            </div>
          </section>
          <div className="quiz-controls">
            <button
              className="button-quiet"
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(value - 1, 0))}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <div>
              <small>Progress saves automatically</small>
              <button type="button" onClick={onSubmit} className="text-submit">
                Submit assessment
              </button>
            </div>
            {index === questions.length - 1 ? (
              <button
                className="button-primary"
                type="button"
                onClick={onSubmit}
              >
                Review & submit <ArrowRight size={16} />
              </button>
            ) : (
              <button className="button-primary" type="button" onClick={onNext}>
                Next question <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
        <aside className="question-aside">
          <div className="question-aside-title">
            <span>
              <strong>Your questions</strong>
              <small>{questions.length} total</small>
            </span>
            <MoreHorizontal size={18} />
          </div>
          <div className="question-grid">
            {questions.map((item, qIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Go to question ${qIndex + 1}`}
                aria-current={index === qIndex ? "step" : undefined}
                className={`${index === qIndex ? "current" : ""} ${answers[qIndex] !== undefined ? "answered" : ""}`}
                onClick={() => setIndex(qIndex)}
              >
                {String(qIndex + 1).padStart(2, "0")}
                {answers[qIndex] !== undefined && <Check size={11} />}
              </button>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="legend-current" />
              Current
            </span>
            <span>
              <i className="legend-answered" />
              Answered
            </span>
            <span>
              <i className="legend-open" />
              Not answered
            </span>
          </div>
          <div className="timer-hint">
            <AlarmClock size={15} />
            <span>
              <strong>Time per question</strong>
              <small>
                Each question has 60 seconds. Remaining time stays with it when
                you move around.
              </small>
            </span>
          </div>
          <div className="saved-hint">
            <ShieldCheck size={14} />
            Saved in this browser
          </div>
        </aside>
      </div>
    </div>
  );
}

function ResultPage({
  assessment,
  course,
  questions,
  answers,
  score,
  instructorGrade,
  onBack,
  onRetake,
}) {
  const percent = Math.round((score / questions.length) * 100);
  return (
    <div className="result-page">
      <section className="result-card">
        <span className="result-mark">
          <ClipboardCheck size={28} />
        </span>
        <small>ASSESSMENT SUBMITTED</small>
        <h1>You did it, Alex!</h1>
        <p>
          Your {assessment.type.toLowerCase()} for {course.name} has been
          submitted.
        </p>
        <div className="result-score">
          <div>
            <strong>
              {percent}
              <small>%</small>
            </strong>
            <span>score</span>
          </div>
          <span>
            <small>YOUR RESULT</small>
            <strong>
              {score} <i>/ {questions.length} correct</i>
            </strong>
            <p>
              {percent >= 80
                ? "Excellent work. You’ve got a strong grasp of this topic."
                : percent >= 50
                  ? "Nice work. Review the questions below to keep building your understanding."
                  : "Keep practicing. Revisit the class materials and try again."}
            </p>
          </span>
        </div>
        {instructorGrade && <div className="teacher-feedback"><span>Instructor feedback</span><strong>{instructorGrade.totalScore} / {assessment.points} points</strong>{instructorGrade.feedback && <p>{instructorGrade.feedback}</p>}</div>}
        <div className="answer-review">
          <div>
            <strong>Answer review</strong>
            <small>{questions.length} questions</small>
          </div>
          {questions.map((item, index) => {
            const correct = answers[index] === item.correct;
            return (
              <div className="review-row" key={item.id}>
                <span className={correct ? "correct" : "incorrect"}>
                  {correct ? <Check size={13} /> : <X size={13} />}
                </span>
                <span>
                  <strong>Question {index + 1}</strong>
                  <small>{item.prompt}</small>
                </span>
                <em>{correct ? "Correct" : "Review"}</em>
              </div>
            );
          })}
        </div>
        <div className="result-actions">
          <button className="button-quiet" type="button" onClick={onBack}>
            <ArrowLeft size={15} />
            Back to classwork
          </button>
          <button className="button-primary" type="button" onClick={onRetake}>
            Practice again <ArrowRight size={15} />
          </button>
        </div>
      </section>
      <small className="result-saved">
        <ShieldCheck size={14} />
        Your result is saved in this browser for the demo.
      </small>
    </div>
  );
}

export default App;
