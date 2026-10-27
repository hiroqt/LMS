import React, { useMemo, useState } from "react";
import { Search, X } from "../../icons";

export default function AdminDirectory({
  page,
  data,
  update,
  formOpen,
  setFormOpen,
  form,
  setForm,
  notice,
  setNotice,
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [activeItem, setActiveItem] = useState(null);

  // Filtered rows
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (page === "Users") {
      return data.users.filter((item) => {
        const matchesTerm =
          !term ||
          `${item.firstName} ${item.lastName} ${item.email} ${item.role}`
            .toLowerCase()
            .includes(term);
        const matchesRole = roleFilter === "all" || item.role === roleFilter;
        const matchesStatus =
          statusFilter === "all" || item.status === statusFilter;
        return matchesTerm && matchesRole && matchesStatus;
      });
    }

    if (page === "Subjects") {
      return data.subjects.filter((item) => {
        return (
          !term ||
          `${item.code} ${item.title} ${item.description || ""}`
            .toLowerCase()
            .includes(term)
        );
      });
    }

    if (page === "Classrooms") {
      return data.classrooms.filter((item) => {
        const subject = data.subjects.find((s) => s.id === item.subjectId);
        const teacher = data.users.find((u) => u.id === item.instructorId);
        const matchesTerm =
          !term ||
          `${subject?.title || ""} ${item.section} ${item.enrollmentCode} ${
            teacher ? `${teacher.firstName} ${teacher.lastName}` : ""
          }`
            .toLowerCase()
            .includes(term);
        const matchesYear =
          yearFilter === "all" || String(item.yearLevel) === String(yearFilter);
        const matchesStatus =
          statusFilter === "all" || item.status === statusFilter;
        return matchesTerm && matchesYear && matchesStatus;
      });
    }

    // Enrollments
    return data.enrollments.filter((item) => {
      const student = data.users.find((u) => u.id === item.studentId);
      const room = data.classrooms.find((c) => c.id === item.classroomId);
      const subject = data.subjects.find((s) => s.id === room?.subjectId);
      const matchesTerm =
        !term ||
        `${student?.firstName || ""} ${student?.lastName || ""} ${
          subject?.title || ""
        } ${room?.section || ""}`
          .toLowerCase()
          .includes(term);
      const matchesRoom =
        classroomFilter === "all" || item.classroomId === classroomFilter;
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesTerm && matchesRoom && matchesStatus;
    });
  }, [
    data,
    page,
    query,
    roleFilter,
    statusFilter,
    yearFilter,
    classroomFilter,
  ]);

  function handleSave(event) {
    event.preventDefault();
    setNotice("");

    if (page === "Users") {
      const email = form.email?.trim().toLowerCase();
      if (!email) return setNotice("Email is required.");
      if (data.users.some((item) => item.email.toLowerCase() === email)) {
        return setNotice("That email address is already registered.");
      }
      const [firstName, ...last] = (form.name || "").trim().split(/\s+/);
      if (!firstName) return setNotice("Please enter a first and last name.");
      update((current) => ({
        ...current,
        users: [
          ...current.users,
          {
            id: `user-${crypto.randomUUID()}`,
            firstName,
            lastName: last.join(" ") || "User",
            email,
            role: form.role || "student",
            status: "active",
          },
        ],
      }));
    } else if (page === "Subjects") {
      const code = form.code?.trim().toUpperCase();
      if (!code) return setNotice("Subject code is required.");
      if (
        data.subjects.some((item) => item.code.toUpperCase() === code)
      ) {
        return setNotice("That subject code already exists in catalog.");
      }
      update((current) => ({
        ...current,
        subjects: [
          ...current.subjects,
          {
            id: `subject-${crypto.randomUUID()}`,
            code,
            title: (form.title || "").trim(),
            description: (form.description || "").trim(),
          },
        ],
      }));
    } else if (page === "Classrooms") {
      const enrollmentCode = form.enrollmentCode?.trim().toUpperCase();
      if (!enrollmentCode) return setNotice("Enrollment code is required.");
      if (
        data.classrooms.some(
          (item) => item.enrollmentCode.toUpperCase() === enrollmentCode
        )
      ) {
        return setNotice("That enrollment code is already taken.");
      }
      const classroomId = `class-${crypto.randomUUID()}`;
      update((current) => ({
        ...current,
        classrooms: [
          ...current.classrooms,
          {
            id: classroomId,
            subjectId: form.subjectId,
            instructorId: form.instructorId || "",
            section: (form.section || "Section A").trim(),
            yearLevel: Number(form.yearLevel) || 1,
            term: (form.term || "Fall 2026").trim(),
            enrollmentCode,
            status: "active",
          },
        ],
        modules: [
          ...current.modules,
          {
            id: `module-${crypto.randomUUID()}`,
            classroomId,
            title: "Getting started & Syllabus",
            order: 1,
          },
        ],
      }));
    } else {
      // Enrollments
      if (!form.classroomId || !form.studentId) {
        return setNotice("Please select both a classroom and a student.");
      }
      const exists = data.enrollments.some(
        (item) =>
          item.classroomId === form.classroomId &&
          item.studentId === form.studentId &&
          item.status === "active"
      );
      if (exists) {
        return setNotice("Student is already enrolled in this classroom.");
      }
      update((current) => ({
        ...current,
        enrollments: [
          ...current.enrollments,
          {
            id: `enrollment-${crypto.randomUUID()}`,
            classroomId: form.classroomId,
            studentId: form.studentId,
            status: "active",
          },
        ],
      }));
    }

    setFormOpen(false);
  }

  function handleToggleStatus(kind, item) {
    const nextStatus = item.status === "active" ? "inactive" : "active";
    update((current) => ({
      ...current,
      [kind]: current[kind].map((record) =>
        record.id === item.id ? { ...record, status: nextStatus } : record
      ),
    }));
    if (activeItem?.id === item.id) {
      setActiveItem((curr) => (curr ? { ...curr, status: nextStatus } : null));
    }
  }

  function handleDelete(kind, id) {
    if (!window.confirm("Are you sure you want to permanently delete this record?")) return;
    update((current) => ({
      ...current,
      [kind]: current[kind].filter((record) => record.id !== id),
    }));
    setActiveItem(null);
  }

  return (
    <section className="role-panel">
      {/* Directory Heading */}
      <div className="role-panel-head">
        <div>
          <h2>{page} Management</h2>
          <p>
            {rows.length} {rows.length === 1 ? "record" : "records"} found · All changes reflect in the shared demo environment.
          </p>
        </div>
        <button
          type="button"
          className="role-primary"
          onClick={() => {
            setForm({});
            setNotice("");
            setFormOpen(true);
          }}
        >
          + Add {page === "Users" ? "person" : page === "Subjects" ? "subject" : page === "Classrooms" ? "classroom" : "enrollment"}
        </button>
      </div>

      {/* Directory Filter & Search Bar */}
      <div className="admin-filter-bar">
        {page === "Users" && (
          <div className="admin-role-pills">
            {["all", "student", "instructor", "admin"].map((role) => (
              <button
                key={role}
                type="button"
                className={`admin-role-pill ${roleFilter === role ? "active" : ""}`}
                onClick={() => setRoleFilter(role)}
              >
                {role === "all" ? "All roles" : role.charAt(0).toUpperCase() + role.slice(1) + "s"}
              </button>
            ))}
          </div>
        )}

        {page === "Classrooms" && (
          <div className="admin-role-pills">
            {["all", "1", "2", "3", "4"].map((year) => (
              <button
                key={year}
                type="button"
                className={`admin-role-pill ${yearFilter === year ? "active" : ""}`}
                onClick={() => setYearFilter(year)}
              >
                {year === "all" ? "All Years" : `Year ${year}`}
              </button>
            ))}
          </div>
        )}

        {page === "Enrollments" && (
          <div className="admin-role-pills">
            <select
              style={{
                height: "32px",
                border: "1px solid #d9e6e0",
                borderRadius: "8px",
                padding: "0 8px",
                fontSize: "11px",
                background: "#fff",
                color: "#35473e",
              }}
              value={classroomFilter}
              onChange={(e) => setClassroomFilter(e.target.value)}
            >
              <option value="all">All Classrooms</option>
              {data.classrooms.map((room) => {
                const sub = data.subjects.find((s) => s.id === room.subjectId);
                return (
                  <option key={room.id} value={room.id}>
                    {sub?.title || "Class"} · {room.section}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {page !== "Subjects" && (
          <div className="admin-role-pills">
            {["all", "active", "inactive"].map((status) => (
              <button
                key={status}
                type="button"
                className={`admin-role-pill ${statusFilter === status ? "active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all" ? "All status" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        )}

        <label className="role-search">
          <Search size={14} />
          <input
            placeholder={`Search ${page.toLowerCase()}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {/* Creation Modal / Form */}
      {formOpen && (
        <form className="role-form" onSubmit={handleSave}>
          <div className="role-form-heading">
            <div>
              <h3>
                Create New {page === "Users" ? "Person" : page === "Subjects" ? "Subject" : page === "Classrooms" ? "Classroom" : "Enrollment"}
              </h3>
              <p>Configure details for the TMCC LMS catalog.</p>
            </div>
            <button
              type="button"
              className="role-close"
              onClick={() => setFormOpen(false)}
              aria-label="Close form"
            >
              ×
            </button>
          </div>

          {page === "Users" && (
            <>
              <label className="role-field">
                <span>Full Name · required</span>
                <input
                  required
                  placeholder="e.g. Jordan Rivera"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="role-field">
                <span>Email Address · required</span>
                <input
                  type="email"
                  required
                  placeholder="e.g. jordan.rivera@tmcc.edu"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="role-field">
                <span>User Role · required</span>
                <select
                  value={form.role || "student"}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
            </>
          )}

          {page === "Subjects" && (
            <>
              <label className="role-field">
                <span>Subject Code · required</span>
                <input
                  required
                  placeholder="e.g. CS201"
                  value={form.code || ""}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label className="role-field">
                <span>Subject Title · required</span>
                <input
                  required
                  placeholder="e.g. Data Structures & Algorithms"
                  value={form.title || ""}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="role-field" style={{ gridColumn: "1 / -1" }}>
                <span>Subject Description</span>
                <textarea
                  rows="3"
                  placeholder="Overview of topics and course objectives"
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
            </>
          )}

          {page === "Classrooms" && (
            <>
              <label className="role-field">
                <span>Subject · required</span>
                <select
                  required
                  value={form.subjectId || ""}
                  onChange={(e) => {
                    const sub = data.subjects.find((s) => s.id === e.target.value);
                    const suggestedCode = sub
                      ? `TMCC-${sub.code}-F26`
                      : "TMCC-NEW-F26";
                    setForm({
                      ...form,
                      subjectId: e.target.value,
                      enrollmentCode: suggestedCode,
                    });
                  }}
                >
                  <option value="">Select a subject</option>
                  {data.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} · {sub.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="role-field">
                <span>Assigned Instructor</span>
                <select
                  value={form.instructorId || ""}
                  onChange={(e) =>
                    setForm({ ...form, instructorId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {data.users
                    .filter((u) => u.role === "instructor" && u.status === "active")
                    .map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.firstName} {inst.lastName} ({inst.email})
                      </option>
                    ))}
                </select>
              </label>
              <label className="role-field">
                <span>Year Level</span>
                <select
                  value={form.yearLevel || "1"}
                  onChange={(e) =>
                    setForm({ ...form, yearLevel: e.target.value })
                  }
                >
                  <option value="1">Year 1</option>
                  <option value="2">Year 2</option>
                  <option value="3">Year 3</option>
                  <option value="4">Year 4</option>
                </select>
              </label>
              <label className="role-field">
                <span>Section Name · required</span>
                <input
                  required
                  placeholder="e.g. BSIT 1-A"
                  value={form.section || ""}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                />
              </label>
              <label className="role-field">
                <span>Term</span>
                <input
                  placeholder="Fall 2026"
                  value={form.term || "Fall 2026"}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                />
              </label>
              <label className="role-field">
                <span>Enrollment Code · required</span>
                <input
                  required
                  placeholder="e.g. TMCC-IT101-01"
                  value={form.enrollmentCode || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      enrollmentCode: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
            </>
          )}

          {page === "Enrollments" && (
            <>
              <label className="role-field">
                <span>Target Classroom · required</span>
                <select
                  required
                  value={form.classroomId || ""}
                  onChange={(e) =>
                    setForm({ ...form, classroomId: e.target.value })
                  }
                >
                  <option value="">Select a classroom</option>
                  {data.classrooms
                    .filter((c) => c.status === "active")
                    .map((room) => {
                      const sub = data.subjects.find((s) => s.id === room.subjectId);
                      return (
                        <option key={room.id} value={room.id}>
                          {sub?.code} · {sub?.title} ({room.section})
                        </option>
                      );
                    })}
                </select>
              </label>
              <label className="role-field">
                <span>Student · required</span>
                <select
                  required
                  value={form.studentId || ""}
                  onChange={(e) =>
                    setForm({ ...form, studentId: e.target.value })
                  }
                >
                  <option value="">Select a student</option>
                  {data.users
                    .filter((u) => u.role === "student" && u.status === "active")
                    .map((stu) => (
                      <option key={stu.id} value={stu.id}>
                        {stu.firstName} {stu.lastName} ({stu.email})
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}

          {notice && <p className="role-form-error">{notice}</p>}

          <div className="role-form-actions">
            <button
              type="button"
              className="role-secondary"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="role-primary">
              Save Record
            </button>
          </div>
        </form>
      )}

      {/* Directory Table */}
      {!rows.length ? (
        <div className="role-empty">
          <strong>No {page.toLowerCase()} found</strong>
          <span>Try adjusting your search terms or add a new entry.</span>
        </div>
      ) : (
        <div className="role-table-wrap">
          <table className="role-table">
            <thead>
              <tr>
                {page === "Users" && (
                  <>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </>
                )}
                {page === "Subjects" && (
                  <>
                    <th>Code</th>
                    <th>Subject Name</th>
                    <th>Sections</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </>
                )}
                {page === "Classrooms" && (
                  <>
                    <th>Classroom / Section</th>
                    <th>Instructor</th>
                    <th>Students</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </>
                )}
                {page === "Enrollments" && (
                  <>
                    <th>Student</th>
                    <th>Classroom</th>
                    <th>Term</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                if (page === "Users") {
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong
                          style={{ cursor: "pointer", color: "#2c5949" }}
                          onClick={() => setActiveItem({ ...item, kind: "user" })}
                        >
                          {item.firstName} {item.lastName}
                        </strong>
                      </td>
                      <td>
                        <span className="role-pill">{item.role}</span>
                      </td>
                      <td>{item.email}</td>
                      <td>
                        <span
                          className={`role-status ${
                            item.status === "active" ? "is-active" : ""
                          }`}
                        >
                          {item.status || "active"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="role-row-action"
                          onClick={() => handleToggleStatus("users", item)}
                        >
                          {item.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                }

                if (page === "Subjects") {
                  const linkedClassrooms = data.classrooms.filter(
                    (c) => c.subjectId === item.id
                  );
                  return (
                    <tr key={item.id}>
                      <td>
                        <span
                          className="role-soft-tag"
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setActiveItem({
                              ...item,
                              kind: "subject",
                              linkedClassrooms,
                            })
                          }
                        >
                          {item.code}
                        </span>
                      </td>
                      <td>
                        <strong>{item.title}</strong>
                      </td>
                      <td>{linkedClassrooms.length} sections</td>
                      <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.description || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {linkedClassrooms.length === 0 ? (
                          <button
                            type="button"
                            className="role-row-action"
                            onClick={() => handleDelete("subjects", item.id)}
                          >
                            Delete
                          </button>
                        ) : (
                          <span style={{ fontSize: "10px", color: "#95a39c" }}>
                            In use
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (page === "Classrooms") {
                  const sub = data.subjects.find((s) => s.id === item.subjectId);
                  const teacher = data.users.find((u) => u.id === item.instructorId);
                  const enrolledCount = (data.enrollments || []).filter(
                    (e) => e.classroomId === item.id && e.status === "active"
                  ).length;
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong
                          style={{ cursor: "pointer", color: "#2c5949" }}
                          onClick={() =>
                            setActiveItem({
                              ...item,
                              kind: "classroom",
                              subject: sub,
                              teacher,
                              enrolledCount,
                            })
                          }
                        >
                          {sub?.title || "Classroom"}
                        </strong>
                        <small>
                          Year {item.yearLevel || 1} · {item.section}
                        </small>
                      </td>
                      <td>
                        {teacher ? (
                          `${teacher.firstName} ${teacher.lastName}`
                        ) : (
                          <span style={{ color: "#ad5c19" }}>Unassigned</span>
                        )}
                      </td>
                      <td>{enrolledCount} enrolled</td>
                      <td>
                        <code>{item.enrollmentCode}</code>
                      </td>
                      <td>
                        <span
                          className={`role-status ${
                            item.status === "active" ? "is-active" : ""
                          }`}
                        >
                          {item.status || "active"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="role-row-action"
                          onClick={() =>
                            handleToggleStatus("classrooms", item)
                          }
                        >
                          {item.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                }

                // Enrollments
                const student = data.users.find((u) => u.id === item.studentId);
                const room = data.classrooms.find((c) => c.id === item.classroomId);
                const sub = data.subjects.find((s) => s.id === room?.subjectId);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {student
                          ? `${student.firstName} ${student.lastName}`
                          : "Unknown"}
                      </strong>
                      <small>{student?.email}</small>
                    </td>
                    <td>
                      <strong>{sub?.title || "Class"}</strong>
                      <small>{room?.section}</small>
                    </td>
                    <td>{room?.term || "Fall 2026"}</td>
                    <td>
                      <span
                        className={`role-status ${
                          item.status === "active" ? "is-active" : ""
                        }`}
                      >
                        {item.status || "active"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="role-row-action"
                        onClick={() =>
                          handleToggleStatus("enrollments", item)
                        }
                      >
                        {item.status === "active" ? "Remove" : "Restore"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Slide-out Modal */}
      {activeItem && (
        <div className="admin-modal-backdrop" onClick={() => setActiveItem(null)}>
          <div
            className="admin-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-head">
              <div>
                <h3>
                  {activeItem.kind === "user"
                    ? `${activeItem.firstName} ${activeItem.lastName}`
                    : activeItem.kind === "classroom"
                    ? `${activeItem.subject?.title} · ${activeItem.section}`
                    : `${activeItem.code} · ${activeItem.title}`}
                </h3>
                <p>
                  Record Details · TMCC LMS Mock Data
                </p>
              </div>
              <button
                type="button"
                className="role-close"
                onClick={() => setActiveItem(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="admin-modal-details">
              {activeItem.kind === "user" && (
                <>
                  <div className="admin-detail-item">
                    <span>Email</span>
                    <strong>{activeItem.email}</strong>
                  </div>
                  <div className="admin-detail-item">
                    <span>Role</span>
                    <strong style={{ textTransform: "capitalize" }}>
                      {activeItem.role}
                    </strong>
                  </div>
                  <div className="admin-detail-item">
                    <span>Status</span>
                    <span
                      className={`role-status ${
                        activeItem.status === "active" ? "is-active" : ""
                      }`}
                    >
                      {activeItem.status || "active"}
                    </span>
                  </div>
                  {activeItem.role === "student" && (
                    <div style={{ marginTop: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#54675e" }}>
                        Enrolled Classrooms:
                      </span>
                      <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                        {data.enrollments
                          .filter(
                            (e) =>
                              e.studentId === activeItem.id &&
                              e.status === "active"
                          )
                          .map((enr) => {
                            const c = data.classrooms.find(
                              (room) => room.id === enr.classroomId
                            );
                            const s = data.subjects.find(
                              (sub) => sub.id === c?.subjectId
                            );
                            return (
                              <li key={enr.id} style={{ marginBottom: "4px" }}>
                                {s?.title || "Class"} ({c?.section})
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}
                  {activeItem.role === "instructor" && (
                    <div style={{ marginTop: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#54675e" }}>
                        Teaching Classrooms:
                      </span>
                      <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                        {data.classrooms
                          .filter(
                            (c) =>
                              c.instructorId === activeItem.id &&
                              c.status === "active"
                          )
                          .map((c) => {
                            const s = data.subjects.find(
                              (sub) => sub.id === c.subjectId
                            );
                            return (
                              <li key={c.id} style={{ marginBottom: "4px" }}>
                                {s?.title || "Class"} · {c.section} (
                                {c.enrollmentCode})
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {activeItem.kind === "classroom" && (
                <>
                  <div className="admin-detail-item">
                    <span>Enrollment Code</span>
                    <strong>{activeItem.enrollmentCode}</strong>
                  </div>
                  <div className="admin-detail-item">
                    <span>Assigned Instructor</span>
                    <strong>
                      {activeItem.teacher
                        ? `${activeItem.teacher.firstName} ${activeItem.teacher.lastName}`
                        : "Unassigned"}
                    </strong>
                  </div>
                  <div className="admin-detail-item">
                    <span>Year & Term</span>
                    <strong>
                      Year {activeItem.yearLevel || 1} · {activeItem.term}
                    </strong>
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#54675e" }}>
                      Enrolled Students ({activeItem.enrolledCount}):
                    </span>
                    <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                      {data.enrollments
                        .filter(
                          (e) =>
                            e.classroomId === activeItem.id &&
                            e.status === "active"
                        )
                        .map((enr) => {
                          const stu = data.users.find(
                            (u) => u.id === enr.studentId
                          );
                          return (
                            <li key={enr.id} style={{ marginBottom: "4px" }}>
                              {stu ? `${stu.firstName} ${stu.lastName}` : "Student"} ({stu?.email})
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                </>
              )}

              {activeItem.kind === "subject" && (
                <>
                  <div className="admin-detail-item">
                    <span>Subject Code</span>
                    <strong>{activeItem.code}</strong>
                  </div>
                  <div className="admin-detail-item">
                    <span>Title</span>
                    <strong>{activeItem.title}</strong>
                  </div>
                  <div className="admin-detail-item">
                    <span>Description</span>
                    <strong style={{ fontWeight: "normal" }}>
                      {activeItem.description || "None provided"}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="role-primary"
                onClick={() => setActiveItem(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
