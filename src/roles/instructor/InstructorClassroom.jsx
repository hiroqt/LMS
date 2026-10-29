import { useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, Download, FileText, GraduationCap, ListChecks, MoreHorizontal, Search, Upload, UsersRound } from "../../icons";
import Avatar from "../../components/shared/Avatar";
import "./instructorClassroom.css";
import "./instructorClasswork.css";
import "./instructorAnnouncements.css";

const tabs = ["Stream", "Classwork", "Announcements", "Materials", "People", "Submissions", "Create content"];
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "No due date";

export default function InstructorClassroom({
  room,
  subject,
  instructor,
  data,
  roomIndex,
  students,
  materials,
  announcements,
  onPublishAnnouncement,
  activities,
  exams,
  submissions,
  gradeId,
  grade,
  setGrade,
  feedback,
  setFeedback,
  onSelectSubmission,
  onSaveGrade,
  tab,
  onTabChange,
  onBack,
  onCreate,
  formType,
  form,
  setForm,
  error,
  onSubmit,
  onCancel,
  onDeleteMaterial,
  onToggleMaterialStatus,
}) {
  const [peopleQuery, setPeopleQuery] = useState("");
  const [workQuery, setWorkQuery] = useState("");
  const [workType, setWorkType] = useState("All");
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [now] = useState(() => Date.now());

  // Materials tab filters and inspection
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialModuleFilter, setMaterialModuleFilter] = useState("all");
  const [materialKindFilter, setMaterialKindFilter] = useState("all");
  const [inspectMaterial, setInspectMaterial] = useState(null);

  const classroomModules = (data.modules || []).filter((item) => item.classroomId === room.id);

  const filteredMaterials = (materials || []).filter((item) => {
    const q = materialQuery.trim().toLowerCase();
    const matchQ =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q) ||
      (item.fileName || "").toLowerCase().includes(q);
    const matchMod = materialModuleFilter === "all" || item.moduleId === materialModuleFilter;
    const matchKind = materialKindFilter === "all" || item.kind === materialKindFilter;
    return matchQ && matchMod && matchKind;
  });

  const work = [
    ...activities.map((item) => ({ ...item, kind: "Assignment", points: item.maxScore })),
    ...exams.map((item) => ({ ...item, kind: "Assessment", points: item.totalMarks })),
  ].filter((item) => item.status !== "inactive").sort((a, b) => (a.dueAt || "9999").localeCompare(b.dueAt || "9999"));

  const upcoming = work.filter((item) => item.dueAt && new Date(item.dueAt).getTime() >= now).slice(0, 4);
  const filteredWork = work.filter((item) => (workType === "All" || item.kind === workType) && `${item.title} ${item.kind}`.toLowerCase().includes(workQuery.toLowerCase()));
  const filteredStudents = students.filter((item) => `${item.firstName} ${item.lastName} ${item.email}`.toLowerCase().includes(peopleQuery.toLowerCase()));
  const roomCount = students.length;
  const description = subject?.description || "Course information and resources for this classroom.";
  const displayName = `${instructor.firstName} ${instructor.lastName}`;

  return (
    <div className="instructor-classroom">
      <section className={`instructor-class-hero hero-${roomIndex % 4}`}>
        <div className="instructor-class-hero-copy">
          <div className="instructor-class-crumb"><button type="button" onClick={onBack}>My classes</button><span>›</span>{room.section}</div>
          <small>{subject?.code} · YEAR {room.yearLevel || room.section.match(/Year\s+(\d+)/i)?.[1] || 1}</small>
          <h1>{subject?.title || "Classroom"}</h1>
          <p>{room.section}<span> · </span>{room.term}</p>
          <div className="instructor-class-byline"><Avatar name={displayName} tone={2} small /> With {displayName}<span><UsersRound size={14} />{roomCount} students</span></div>
        </div>
        <div className="instructor-class-hero-art" aria-hidden="true"><i /><b>{subject?.code?.slice(-2) || "CL"}</b><span>✦</span></div>
      </section>

      <div className="instructor-detail-tabs" role="tablist" aria-label="Classroom sections">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            onClick={() => { if (item !== tab) onCancel(); onTabChange(item); }}
          >
            {item}
            {item === "Classwork" && <em>{work.length}</em>}
            {item === "Materials" && <em>{materials.length}</em>}
            {item === "Announcements" && <em>{announcements.length}</em>}
            {item === "Submissions" && <em>{submissions.length}</em>}
          </button>
        ))}
      </div>

      {tab === "Stream" && (
        <div className="instructor-stream-layout">
          <div className="instructor-stream-main">
            <article className="instructor-announcement">
              <div className="instructor-announcement-head">
                <Avatar name={displayName} tone={2} />
                <span><strong>{displayName}</strong><small>Class announcement · Instructor workspace</small></span>
                <MoreHorizontal size={18} />
              </div>
              <div className="instructor-announcement-body">
                <small>WELCOME TO {subject?.code || "YOUR CLASS"}</small>
                <h2>{subject?.title} is ready for the term</h2>
                <p>{description} Use the class tabs to share resources, organize coursework, and keep track of student progress.</p>
                <button type="button" className="instructor-text-link" onClick={() => onTabChange("Create content")}>
                  Post class content <ArrowRight size={14} />
                </button>
              </div>
              <div className="instructor-announcement-footer">{room.section}<span>{room.term}</span></div>
            </article>

            {work.slice(0, 3).map((item) => (
              <article className="instructor-stream-update" key={item.id}>
                <span className={`instructor-update-icon ${item.kind === "Assignment" ? "assignment" : ""}`}>
                  {item.kind === "Assignment" ? <ClipboardCheck size={17} /> : <FileText size={17} />}
                </span>
                <div>
                  <strong>{item.kind} · {item.title}</strong>
                  <small>{displayName} · {item.dueAt ? `Due ${dateLabel(item.dueAt)}` : "No due date set"}</small>
                  <p>{item.instructions || `${item.points || 0} points · Available to enrolled students.`}</p>
                  <button className="instructor-text-link" type="button" onClick={() => onTabChange("Classwork")}>
                    View classwork <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}

            {materials.slice(0, 2).map((item) => (
              <article className="instructor-stream-update" key={item.id}>
                <span className="instructor-update-icon"><BookOpen size={17} /></span>
                <div>
                  <strong>New material · {item.title}</strong>
                  <small>{displayName} · Shared with this class</small>
                  <p>{item.description || item.kind || "Class resource"}</p>
                  <button className="instructor-text-link" type="button" onClick={() => onTabChange("Materials")}>
                    View materials <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}

            {!work.length && !materials.length && (
              <div className="instructor-class-empty">Your class stream will show shared materials, assignments, and assessments.</div>
            )}
          </div>

          <aside className="instructor-stream-aside">
            <section className="instructor-aside-card">
              <div className="instructor-aside-heading"><span className="calendar"><CalendarDays size={16} /></span><strong>Upcoming</strong></div>
              {upcoming.length ? upcoming.map((item) => (
                <button type="button" className="instructor-upcoming-row" key={item.id} onClick={() => onTabChange("Classwork")}>
                  <span><strong>{item.title}</strong><small>{item.kind}</small></span>
                  <time>{dateLabel(item.dueAt)}</time>
                </button>
              )) : <p>No upcoming work. Add an assignment or assessment when you’re ready.</p>}
              <button type="button" className="instructor-aside-link" onClick={() => onTabChange("Classwork")}>
                View classwork <ArrowRight size={13} />
              </button>
            </section>
            <section className="instructor-aside-card">
              <div className="instructor-aside-heading"><span className="book"><BookOpen size={16} /></span><strong>About this class</strong></div>
              <p>{description}</p>
              <small><UsersRound size={14} />{roomCount} enrolled students</small>
              <small><GraduationCap size={14} />Year {room.yearLevel || room.section.match(/Year\s+(\d+)/i)?.[1] || 1} · {room.term}</small>
              <small><ClipboardCheck size={14} />Code {room.enrollmentCode}</small>
            </section>
          </aside>
        </div>
      )}

      {tab === "Classwork" && (
        <section className="instructor-class-panel instructor-classwork">
          <div className="instructor-classwork-head">
            <div><h2>Classwork <em>{work.length}</em></h2><p>Assignments and assessments</p></div>
            <label className="instructor-class-search">
              <Search size={15} />
              <input aria-label="Search classwork" placeholder="Search classwork" value={workQuery} onChange={(event) => setWorkQuery(event.target.value)} />
            </label>
            <button type="button" className="role-primary" onClick={() => onTabChange("Create content")}>+ Create</button>
          </div>
          <div className="instructor-classwork-filters" aria-label="Filter classwork">
            {["All", "Assignment", "Assessment"].map((type) => (
              <button
                type="button"
                key={type}
                aria-pressed={workType === type}
                className={workType === type ? "selected" : ""}
                onClick={() => setWorkType(type)}
              >
                {type === "All" ? "All work" : `${type}s`}
                <span>{type === "All" ? work.length : work.filter((item) => item.kind === type).length}</span>
              </button>
            ))}
          </div>
          <div className="instructor-classwork-list">
            {filteredWork.length ? filteredWork.map((item) => (
              <article className="instructor-classwork-row" key={`${item.kind}-${item.id}`}>
                <span className={`instructor-classwork-icon ${item.kind === "Assessment" ? "assessment" : ""}`}>
                  {item.kind === "Assignment" ? <ListChecks size={18} /> : <GraduationCap size={18} />}
                </span>
                <div className="instructor-classwork-title"><small>{item.kind}</small><strong>{item.title}</strong></div>
                <div className="instructor-classwork-due"><small>Due</small><strong>{dateLabel(item.dueAt)}</strong></div>
                <span className="instructor-classwork-points">{item.points || 0} pts</span>
                <span className={`instructor-classwork-status ${item.status === "active" ? "published" : ""}`}>
                  {item.status === "active" ? "Published" : item.status}
                </span>
              </article>
            )) : (
              <div className="instructor-classwork-empty">
                {work.length ? "No matching work." : "No classwork yet."}
                <button type="button" onClick={() => onTabChange("Create content")}>Create the first item <ArrowRight size={13} /></button>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "Materials" && (
        <section className="instructor-class-panel">
          <div className="instructor-class-page-heading">
            <div>
              <small>{room.section.toUpperCase()}</small>
              <h2>Class materials <em>{filteredMaterials.length}</em></h2>
              <p>Syllabus readings, lecture slides, worksheets, and downloadable references for {room.section}.</p>
            </div>
            <button type="button" className="role-primary" onClick={() => onCreate("material")}>
              + Upload material
            </button>
          </div>

          <div className="instructor-material-toolbar">
            <label className="instructor-class-search">
              <Search size={15} />
              <input
                aria-label="Search materials"
                placeholder="Search materials or files..."
                value={materialQuery}
                onChange={(e) => setMaterialQuery(e.target.value)}
              />
            </label>

            <label className="instructor-material-select-wrap">
              <span>Unit / Module</span>
              <select
                value={materialModuleFilter}
                onChange={(e) => setMaterialModuleFilter(e.target.value)}
              >
                <option value="all">All units & modules</option>
                {classroomModules.map((mod) => (
                  <option key={mod.id} value={mod.id}>{mod.title}</option>
                ))}
              </select>
            </label>

            <label className="instructor-material-select-wrap">
              <span>Resource Type</span>
              <select
                value={materialKindFilter}
                onChange={(e) => setMaterialKindFilter(e.target.value)}
              >
                <option value="all">All resource types</option>
                <option value="Study guide">Study guide</option>
                <option value="Lecture Slides">Lecture Slides</option>
                <option value="Lab Manual">Lab Manual</option>
                <option value="Reading">Reading</option>
                <option value="Practice set">Practice set</option>
                <option value="Reference sheet">Reference sheet</option>
              </select>
            </label>

            {(materialQuery || materialModuleFilter !== "all" || materialKindFilter !== "all") && (
              <button
                type="button"
                className="role-link-button"
                style={{ fontSize: 11, cursor: "pointer", border: 0, background: "transparent", color: "#367c65" }}
                onClick={() => {
                  setMaterialQuery("");
                  setMaterialModuleFilter("all");
                  setMaterialKindFilter("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredMaterials.length ? (
            <div className="instructor-material-grid">
              {filteredMaterials.map((item, index) => {
                const mod = classroomModules.find((m) => m.id === item.moduleId);
                const fn = item.fileName || `${item.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.${item.fileType || "pdf"}`;
                return (
                  <article className="instructor-material-card" key={item.id}>
                    <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <span className={`resource-icon resource-${index % 3}`}>
                        <FileText size={20} />
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span className="role-pill" style={{ textTransform: "uppercase", fontSize: 9 }}>
                          {item.fileType || "pdf"}
                        </span>
                        {mod && (
                          <span className="role-soft-tag" style={{ fontSize: 9 }}>
                            {mod.title.split("·")[0]?.trim() || "Unit"}
                          </span>
                        )}
                      </div>
                    </div>

                    <small>{item.kind || "Class material"}</small>
                    <strong
                      style={{ cursor: "pointer", color: "#284436" }}
                      onClick={() => setInspectMaterial(item)}
                      title="Click to view details"
                    >
                      {item.title}
                    </strong>
                    <p>{item.description || "Classroom learning reference and study material."}</p>

                    <div className="instructor-material-meta">
                      <span>{item.fileSize || "1.8 MB"}</span>
                      <span>·</span>
                      <span>{item.downloads || 0} downloads</span>
                    </div>

                    <div className="instructor-material-actions">
                      <button
                        type="button"
                        className="role-secondary"
                        onClick={() => {
                          const content = `TMCC LEARNING MATERIAL\n=====================================\nClassroom: ${room.section}\nSubject: ${subject?.title || ""}\nUnit: ${mod?.title || ""}\nTitle: ${item.title}\nType: ${item.kind || "Study Material"}\nFormat: ${(item.fileType || "pdf").toUpperCase()}\nFile Size: ${item.fileSize || "1.8 MB"}\nUploaded By: ${item.uploadedBy || "Instructor"}\n\nDescription:\n${item.description || ""}`;
                          const b = new Blob([content], { type: "text/plain;charset=utf-8" });
                          const u = URL.createObjectURL(b);
                          const a = document.createElement("a");
                          a.href = u;
                          a.download = fn;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(u);
                        }}
                      >
                        <Download size={13} /> Download
                      </button>
                      <button
                        type="button"
                        className="role-secondary"
                        onClick={() => setInspectMaterial(item)}
                      >
                        Inspect
                      </button>
                      {onToggleMaterialStatus && (
                        <button
                          type="button"
                          className="role-secondary"
                          onClick={() => onToggleMaterialStatus(item.id)}
                          title={item.status === "archived" ? "Restore material" : "Archive material"}
                        >
                          {item.status === "archived" ? "Restore" : "Archive"}
                        </button>
                      )}
                      {onDeleteMaterial && (
                        <button
                          type="button"
                          className="role-secondary"
                          style={{ color: "#a84545" }}
                          onClick={() => onDeleteMaterial(item.id)}
                          title="Remove material"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="instructor-class-empty">
              {materials.length ? "No materials match your current filters." : "No materials have been added yet."}
              <div style={{ marginTop: 10 }}>
                <button type="button" className="role-primary" onClick={() => onCreate("material")}>
                  + Upload the first material
                </button>
              </div>
            </div>
          )}

          {inspectMaterial && (
            <div className="instructor-modal-backdrop" onClick={() => setInspectMaterial(null)}>
              <div className="instructor-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="instructor-modal-head">
                  <div>
                    <span className="role-pill" style={{ textTransform: "uppercase", fontSize: 10 }}>
                      {inspectMaterial.fileType || "pdf"}
                    </span>
                    <h3>{inspectMaterial.title}</h3>
                  </div>
                  <button type="button" className="instructor-modal-close" onClick={() => setInspectMaterial(null)}>
                    ✕
                  </button>
                </div>
                <div className="instructor-modal-body">
                  <div className="instructor-modal-grid">
                    <div>
                      <small>Resource Type</small>
                      <strong>{inspectMaterial.kind || "Class material"}</strong>
                    </div>
                    <div>
                      <small>Curriculum Module</small>
                      <strong>{classroomModules.find((m) => m.id === inspectMaterial.moduleId)?.title || "General"}</strong>
                    </div>
                    <div>
                      <small>File Name</small>
                      <strong>{inspectMaterial.fileName || `${inspectMaterial.title}.pdf`}</strong>
                    </div>
                    <div>
                      <small>File Size</small>
                      <strong>{inspectMaterial.fileSize || "1.8 MB"}</strong>
                    </div>
                    <div>
                      <small>Uploaded By</small>
                      <strong>{inspectMaterial.uploadedBy || displayName}</strong>
                    </div>
                    <div>
                      <small>Downloads</small>
                      <strong>{inspectMaterial.downloads || 0} times</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <small style={{ color: "#77877f", fontSize: 10, fontWeight: 650 }}>DESCRIPTION & SYLLABUS NOTES</small>
                    <p style={{ margin: "6px 0 0", color: "#37463f", fontSize: 12, lineHeight: 1.6 }}>
                      {inspectMaterial.description || "Official course material shared with enrolled students."}
                    </p>
                  </div>
                </div>
                <div className="instructor-modal-foot">
                  <button
                    type="button"
                    className="role-primary"
                    onClick={() => {
                      const fn = inspectMaterial.fileName || `${inspectMaterial.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.${inspectMaterial.fileType || "pdf"}`;
                      const b = new Blob([`TMCC LEARNING MATERIAL\nTitle: ${inspectMaterial.title}\nDescription: ${inspectMaterial.description || ""}`], { type: "text/plain;charset=utf-8" });
                      const u = URL.createObjectURL(b);
                      const a = document.createElement("a");
                      a.href = u;
                      a.download = fn;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(u);
                    }}
                  >
                    <Download size={14} /> Download File
                  </button>
                  <button type="button" className="role-secondary" onClick={() => setInspectMaterial(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "Announcements" && (
        <section className="instructor-class-panel">
          <div className="instructor-class-page-heading">
            <div>
              <small>{room.section.toUpperCase()}</small>
              <h2>Announcements <em>{announcements.length}</em></h2>
              <p>Updates shared with students in this class.</p>
            </div>
            <button type="button" className="role-primary" onClick={() => setAnnouncementOpen((open) => !open)}>
              {announcementOpen ? "Close" : "+ New announcement"}
            </button>
          </div>
          {announcementOpen && (
            <form
              className="instructor-announcement-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!announcementTitle.trim() || !announcementMessage.trim()) return;
                onPublishAnnouncement({ title: announcementTitle, message: announcementMessage });
                setAnnouncementTitle("");
                setAnnouncementMessage("");
                setAnnouncementOpen(false);
              }}
            >
              <label>
                <span>Title</span>
                <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} maxLength={120} placeholder="Announcement title" required />
              </label>
              <label>
                <span>Message</span>
                <textarea value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} rows="4" maxLength={1200} placeholder="Write an update for your students" required />
              </label>
              <div>
                <button type="button" className="role-secondary" onClick={() => setAnnouncementOpen(false)}>Cancel</button>
                <button type="submit" className="role-primary">Post announcement</button>
              </div>
            </form>
          )}
          <div className="instructor-announcement-list">
            {[...announcements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((item) => {
              const author = data.users.find((user) => user.id === item.instructorId);
              return (
                <article className="instructor-announcement-card" key={item.id}>
                  <header>
                    <Avatar name={author ? `${author.firstName} ${author.lastName}` : displayName} tone={2} />
                    <span><strong>{author ? `${author.firstName} ${author.lastName}` : displayName}</strong><small>{dateLabel(item.createdAt)}</small></span>
                  </header>
                  <div>
                    <small>CLASS ANNOUNCEMENT</small>
                    <h3>{item.title}</h3>
                    <p>{item.message}</p>
                  </div>
                </article>
              );
            })}
            {!announcements.length && !announcementOpen && <div className="instructor-class-empty">No announcements yet.</div>}
          </div>
        </section>
      )}

      {tab === "People" && (
        <section className="instructor-class-panel">
          <div className="instructor-class-page-heading">
            <div>
              <small>YOUR CLASS COMMUNITY</small>
              <h2>People <em>{roomCount}</em></h2>
              <p>Students enrolled in {subject?.title}.</p>
            </div>
            <label className="instructor-class-search">
              <Search size={15} />
              <input aria-label="Search students" placeholder="Find a student" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} />
            </label>
          </div>
          <div className="instructor-roster-summary">
            <UsersRound size={19} />
            <span><small>CLASS SECTION</small><strong>{room.section}</strong></span>
            <i />
            <span><small>ENROLLED STUDENTS</small><strong>{roomCount} students</strong></span>
            <b>{subject?.code}</b>
          </div>
          <div className="instructor-roster">
            {filteredStudents.map((student, index) => (
              <div className="instructor-roster-row" key={student.id}>
                <Avatar name={`${student.firstName} ${student.lastName}`} tone={index + 1} />
                <span><strong>{student.firstName} {student.lastName}</strong><small>{student.email}</small></span>
                <em>Student</em>
              </div>
            ))}
            {!filteredStudents.length && <div className="instructor-class-empty">No students match your search.</div>}
          </div>
        </section>
      )}

      {tab === "Submissions" && (
        <section className="instructor-class-panel">
          <div className="instructor-class-page-heading">
            <div>
              <small>{room.section.toUpperCase()}</small>
              <h2>Submissions <em>{submissions.length}</em></h2>
              <p>Review and grade work from this class.</p>
            </div>
          </div>
          {submissions.length ? (
            <div className="instructor-class-submission-layout">
              <div className="instructor-class-submission-list">
                {submissions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`instructor-class-submission-row ${gradeId === item.id ? "selected" : ""}`}
                    onClick={() => onSelectSubmission(item)}
                  >
                    <Avatar name={`${item.student?.firstName || "A"} ${item.student?.lastName || "R"}`} tone={1} />
                    <span><strong>{item.student?.firstName} {item.student?.lastName}</strong><small>{item.exam.title}</small></span>
                    <em>{item.kind === "activity" ? "Assignment" : "Assessment"}</em>
                  </button>
                ))}
              </div>
              {gradeId && submissions.some((item) => item.id === gradeId) && (
                <form className="instructor-class-grade" onSubmit={onSaveGrade}>
                  {(() => {
                    const item = submissions.find((submission) => submission.id === gradeId);
                    return (
                      <>
                        <small className="eyebrow">{item.kind === "activity" ? "ASSIGNMENT" : "ASSESSMENT"}</small>
                        <h3>{item.exam.title}</h3>
                        <p>{item.student?.firstName} {item.student?.lastName}</p>
                        {item.kind === "activity" ? (
                          <div className="instructor-class-submission-note">
                            <strong>Attachment</strong>
                            <span>{item.existing.fileAttachmentUrl || "No filename provided"}</span>
                            <strong>Student note</strong>
                            <span>{item.existing.submissionText || "No comment"}</span>
                          </div>
                        ) : (
                          <div className="instructor-class-auto-score">
                            Auto score <strong>{item.correct} / {item.questions.length}</strong>
                          </div>
                        )}
                        <label className="role-field">
                          <span>Final score · max {item.exam.totalMarks}</span>
                          <input type="number" min="0" max={item.exam.totalMarks} value={grade} onChange={(event) => setGrade(event.target.value)} required />
                        </label>
                        <label className="role-field">
                          <span>Feedback</span>
                          <textarea rows="3" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional feedback" />
                        </label>
                        {error && <p className="role-form-error" role="alert">{error}</p>}
                        <button className="role-primary" type="submit">Save grade</button>
                      </>
                    );
                  })()}
                </form>
              )}
            </div>
          ) : (
            <div className="instructor-class-empty">No submissions are waiting for review in this class.</div>
          )}
        </section>
      )}

      {tab === "Create content" && (
        <section className="instructor-class-panel instructor-create-panel">
          <div className="instructor-class-page-heading">
            <div>
              <small>CLASS CONTENT</small>
              <h2>Create and organize</h2>
              <p>Choose what you want to share with this class.</p>
            </div>
          </div>
          <div className="instructor-create-categories">
            {[
              { type: "material", title: "Materials", note: "Readings, guides, lecture slides, and files", icon: <BookOpen size={18} />, count: materials.length },
              { type: "activity", title: "Assignments", note: "Collect student work and provide feedback", icon: <ListChecks size={18} />, count: activities.length },
              { type: "exam", title: "Assessments", note: "Build and publish a quiz or exam", icon: <GraduationCap size={18} />, count: exams.length },
            ].map((group) => (
              <section className="instructor-create-category" key={group.type}>
                <header>
                  <span>{group.icon}</span>
                  <div><strong>{group.title}</strong><small>{group.note}</small></div>
                  <em>{group.count}</em>
                  <button type="button" className="role-secondary" onClick={() => onCreate(group.type)}>+ Create</button>
                </header>
                {(group.type === "material" ? materials : group.type === "activity" ? activities : exams).length ? (
                  <ul>
                    {(group.type === "material" ? materials : group.type === "activity" ? activities : exams).map((item) => (
                      <li key={item.id}>
                        <span>{item.title}</span>
                        <small>{item.kind || item.status || group.title.slice(0, -1)}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No {group.title.toLowerCase()} added yet.</p>
                )}
              </section>
            ))}
          </div>
          {formType && (
            <ContentForm
              type={formType}
              data={data}
              room={room}
              form={form}
              setForm={setForm}
              error={error}
              onSubmit={onSubmit}
              onCancel={onCancel}
            />
          )}
        </section>
      )}
    </div>
  );
}

function ContentForm({ type, data, room, form, setForm, error, onSubmit, onCancel }) {
  const modules = data.modules.filter((item) => item.classroomId === room.id);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const category = type === "material" ? "Material" : type === "activity" ? "Assignment" : "Assessment";

  return (
    <form className="instructor-content-form" onSubmit={onSubmit}>
      <div>
        <span className="eyebrow">{category.toUpperCase()}</span>
        <h3>{type === "material" ? "Upload class material" : type === "activity" ? "Create an assignment" : "Create an assessment"}</h3>
        <p>This content will be shared with {room.section}.</p>
      </div>

      <label>
        <span>Curriculum Unit / Module</span>
        <select value={form.moduleId} onChange={(event) => setField("moduleId", event.target.value)}>
          {modules.map((item) => (
            <option value={item.id} key={item.id}>{item.title}</option>
          ))}
        </select>
      </label>

      <Field
        label={`${category} title`}
        value={form.title || ""}
        onChange={(value) => setField("title", value)}
        required
      />

      {type === "material" ? (
        <>
          <label>
            <span>Resource type</span>
            <select value={form.kind || "Study guide"} onChange={(event) => setField("kind", event.target.value)}>
              <option value="Study guide">Study guide</option>
              <option value="Lecture Slides">Lecture Slides</option>
              <option value="Lab Manual">Lab Manual</option>
              <option value="Reading">Reading</option>
              <option value="Practice set">Practice set</option>
              <option value="Reference sheet">Reference sheet</option>
            </select>
          </label>

          <Field
            label="Description & Learning Objectives"
            value={form.description || ""}
            onChange={(value) => setField("description", value)}
          />

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "grid", gap: 6, color: "#63736a", fontSize: 10, fontWeight: 600 }}>
              <span>Attach file / document</span>
              <div className="instructor-upload-dropzone">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
                  style={{ display: "none" }}
                  id="instructor-file-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const ext = f.name.split(".").pop().toLowerCase() || "pdf";
                      const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
                      setField("fileName", f.name);
                      setField("fileType", ext);
                      setField("fileSize", `${Number(sizeMb) > 0 ? sizeMb : "0.5"} MB`);
                      if (!form.title) {
                        setField("title", f.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
                <label
                  htmlFor="instructor-file-input"
                  style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                >
                  <Upload size={22} color="#367c65" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#2d4437" }}>
                    {form.fileName ? "Choose a different document" : "Click to select or drop a course document"}
                  </span>
                  <small style={{ fontSize: 10, color: "#8a9790" }}>Supported formats: PDF, DOCX, PPTX, TXT, ZIP</small>
                </label>
              </div>

              {form.fileName && (
                <div className="instructor-selected-file">
                  <FileText size={15} />
                  <span>{form.fileName} ({form.fileSize || "1.8 MB"})</span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("fileName", "");
                      setField("fileSize", "");
                      setField("fileType", "pdf");
                    }}
                    style={{ border: 0, background: "transparent", cursor: "pointer", color: "#8a9790", padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </label>
          </div>
        </>
      ) : (
        <>
          <Field label="Instructions" value={form.instructions || ""} onChange={(value) => setField("instructions", value)} />
          <div className="instructor-form-grid">
            <Field label="Due date" type="datetime-local" value={form.dueAt || ""} onChange={(value) => setField("dueAt", value)} />
            <Field label="Points" type="number" value={form.points || "10"} onChange={(value) => setField("points", value)} required />
          </div>
          {type === "activity" ? (
            <>
              <label className="instructor-check">
                <input type="checkbox" checked={form.allowLate || false} onChange={(event) => setField("allowLate", event.target.checked)} />
                Accept late work
              </label>
              <label className="instructor-check">
                <input type="checkbox" checked={form.allowResubmission || false} onChange={(event) => setField("allowResubmission", event.target.checked)} />
                Allow resubmission
              </label>
            </>
          ) : (
            <>
              <Field label="Time limit (minutes, 0 for none)" type="number" value={form.timeLimit || "0"} onChange={(value) => setField("timeLimit", value)} />
              <Field label="Question" value={form.prompt || ""} onChange={(value) => setField("prompt", value)} required />
              <div className="instructor-form-grid">
                {[1, 2, 3, 4].map((number) => (
                  <Field key={number} label={`Answer choice ${number}`} value={form[`option${number}`] || ""} onChange={(value) => setField(`option${number}`, value)} required />
                ))}
              </div>
              <label>
                <span>Correct answer</span>
                <select value={form.correctIndex ?? "0"} onChange={(event) => setField("correctIndex", event.target.value)}>
                  {[1, 2, 3, 4].map((number) => (
                    <option key={number} value={number - 1}>Answer choice {number}</option>
                  ))}
                </select>
              </label>
            </>
          )}
        </>
      )}

      {error && <p className="role-form-error" role="alert">{error}</p>}
      <div className="instructor-form-actions">
        <button type="button" className="role-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="role-primary">Save and publish</button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label>
      <span>{label}{required ? " · required" : ""}</span>
      <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
