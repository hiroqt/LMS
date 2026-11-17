import { useMemo, useState } from "react";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Select } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { DataTable, EmptyRow } from "../../components/DataTable";
import { FormDialog } from "../../components/FormDialog";
import { Pagination } from "../../components/Pagination";
import { StatusBadge } from "../../components/StatusBadge";
import { Toolbar } from "../../components/Toolbar";
import { paginateRecords } from "../../data/pagination.js";
import type { Classroom } from "../../data/types";
import { useAdmin } from "../../hooks/useAdmin";
import { activeEnrollmentCount, currentTermName, fullName, PAGE_SIZE, subjectOf } from "../../lib/records";

const emptyForm = { subjectId: "", instructorId: "", yearLevel: "1", section: "", term: "", enrollmentCode: "" };

export function ClassroomsTab({ creating, onCreatingChange }: { creating: boolean; onCreatingChange: (open: boolean) => void }) {
  const { data, update } = useAdmin();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<Classroom | null>(null);
  const term = currentTermName(data);
  const terms = data.systemAdministration.terms.filter((item) => item.status !== "archived");
  const teacherOf = (room: Classroom) => data.users.find((user) => user.id === room.instructorId);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return data.classrooms.filter((room) => {
      const haystack = `${subjectOf(data, room)?.title ?? ""} ${room.section} ${room.enrollmentCode} ${fullName(data.users.find((user) => user.id === room.instructorId))}`;
      return (
        (!text || haystack.toLowerCase().includes(text)) &&
        (year === "all" || String(room.yearLevel) === year) &&
        (status === "all" || room.status === status) &&
        (assignment === "all" || (assignment === "assigned" ? Boolean(room.instructorId) : !room.instructorId))
      );
    });
  }, [data, query, year, status, assignment]);
  const pagination = paginateRecords(rows, page, PAGE_SIZE);
  const filter = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const filtered = Boolean(query) || year !== "all" || status !== "all" || assignment !== "all";

  const openCreate = (open: boolean) => {
    if (open) {
      setForm({ ...emptyForm, term });
      setError("");
    }
    onCreatingChange(open);
  };

  const save = () => {
    const enrollmentCode = form.enrollmentCode.trim().toUpperCase();
    const section = form.section.trim();
    if (!form.subjectId) return setError("Choose a subject.");
    if (!section) return setError("Section name is required.");
    if (!enrollmentCode) return setError("Enrollment code is required.");
    if (data.classrooms.some((room) => room.enrollmentCode.toUpperCase() === enrollmentCode)) return setError("That enrollment code is already taken.");
    const id = `class-${crypto.randomUUID()}`;
    const room: Classroom = { id, subjectId: form.subjectId, instructorId: form.instructorId, section, yearLevel: Number(form.yearLevel) || 1, term: form.term || term, enrollmentCode, status: "active", createdAt: new Date().toISOString() };
    update(
      (current) => ({
        ...current,
        classrooms: [...current.classrooms, room],
        modules: [...current.modules, { id: `module-${crypto.randomUUID()}`, classroomId: id, title: "Getting started & Syllabus", order: 1 }],
      }),
      { category: "courses", action: "created", target: "Classroom", targetId: id, summary: `${section} · ${room.term}` },
    );
    openCreate(false);
    toast.show({ title: "Classroom added", description: `${subjectOf(data, room)?.title ?? "Classroom"} · ${section}`, tone: "success" });
  };

  const toggle = (room: Classroom) => {
    const next = room.status === "active" ? "inactive" : "active";
    update(
      (current) => ({ ...current, classrooms: current.classrooms.map((item) => (item.id === room.id ? { ...item, status: next, statusChangedAt: new Date().toISOString() } : item)) }),
      { category: "courses", action: next === "inactive" ? "deactivated" : "activated", target: "classrooms", targetId: room.id, summary: `Status changed to ${next}` },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar searchLabel="Search classrooms" query={query} onQuery={(value) => filter(() => setQuery(value))} onClear={filtered ? () => filter(() => { setQuery(""); setYear("all"); setStatus("all"); setAssignment("all"); }) : undefined}>
        <Field label="Year">
          <Select value={year} onChange={(event) => filter(() => setYear(event.target.value))}>
            <option value="all">All years</option>
            {[1, 2, 3, 4].map((level) => <option key={level} value={String(level)}>Year {level}</option>)}
          </Select>
        </Field>
        <Field label="Instructor assignment">
          <Select value={assignment} onChange={(event) => filter(() => setAssignment(event.target.value))}>
            <option value="all">All assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(event) => filter(() => setStatus(event.target.value))}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
      </Toolbar>
      <p className="m-0 font-sans text-body text-muted">{rows.length} {rows.length === 1 ? "classroom" : "classrooms"}</p>
      <DataTable label="Classrooms" head={<tr><th scope="col">Classroom</th><th scope="col">Instructor</th><th scope="col">Students</th><th scope="col">Code</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>}>
        {pagination.records.length ? (
          (pagination.records as Classroom[]).map((room) => {
            const teacher = teacherOf(room);
            const name = `${subjectOf(data, room)?.title ?? "Classroom"} · ${room.section}`;
            return (
              <tr key={room.id}>
                <td>
                  <button type="button" onClick={() => setShown(room)} className="flex min-h-touch flex-col items-start justify-center rounded-control border-0 bg-transparent p-0 text-left font-sans focus-visible:outline-3 focus-visible:outline-focus">
                    <span className="text-body font-semibold text-primary-700 underline-offset-4 hover:underline">{subjectOf(data, room)?.title ?? "Classroom"}</span>
                    <span className="text-body text-muted">{room.section}</span>
                  </button>
                </td>
                <td>{teacher ? fullName(teacher) : <Badge tone="warning">Unassigned</Badge>}</td>
                <td className="whitespace-nowrap">{activeEnrollmentCount(data, room.id)} enrolled</td>
                <td className="font-medium whitespace-nowrap tabular-nums">{room.enrollmentCode}</td>
                <td><StatusBadge status={room.status} /></td>
                <td className="text-right">
                  <Button variant="secondary" aria-label={`${room.status === "active" ? "Deactivate" : "Activate"} ${name}`} onClick={() => toggle(room)}>
                    {room.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            );
          })
        ) : (
          <EmptyRow columns={6}>No classrooms match. Change the search or filters, or add a classroom.</EmptyRow>
        )}
      </DataTable>
      <Pagination label="Classroom pages" info={pagination} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />

      <FormDialog open={creating} onOpenChange={openCreate} title="Create new classroom" description="A section of a subject that students enroll in." error={error} onSubmit={save}>
        <Field label="Subject" required>
          <Select
            value={form.subjectId}
            onChange={(event) => {
              const subject = data.subjects.find((item) => item.id === event.target.value);
              setForm({ ...form, subjectId: event.target.value, enrollmentCode: subject ? `TMCC-${subject.code}-F26` : "" });
            }}
          >
            <option value="">Select a subject</option>
            {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subject.title}</option>)}
          </Select>
        </Field>
        <Field label="Assigned instructor">
          <Select value={form.instructorId} onChange={(event) => setForm({ ...form, instructorId: event.target.value })}>
            <option value="">Unassigned</option>
            {data.users.filter((user) => user.role === "instructor" && user.status === "active").map((user) => <option key={user.id} value={user.id}>{fullName(user)} ({user.email})</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Year level">
            <Select value={form.yearLevel} onChange={(event) => setForm({ ...form, yearLevel: event.target.value })}>
              {[1, 2, 3, 4].map((level) => <option key={level} value={String(level)}>Year {level}</option>)}
            </Select>
          </Field>
          <Field label="Term">
            <Select value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })}>
              {(terms.length ? terms : [{ id: "current-term", name: term, status: "current" as const }]).map((item) => (
                <option key={item.id} value={item.name}>{item.name}{item.status === "current" ? " · Current" : " · Planned"}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Section name" required>
          <Input autoComplete="off" placeholder="e.g. BSIT 1-A" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} />
        </Field>
        <Field label="Enrollment code" required hint="Suggested from the subject; students use it to join.">
          <Input autoComplete="off" value={form.enrollmentCode} onChange={(event) => setForm({ ...form, enrollmentCode: event.target.value.toUpperCase() })} />
        </Field>
      </FormDialog>

      <Dialog open={Boolean(shown)} onOpenChange={(open) => !open && setShown(null)}>
        {shown && (
          <DialogContent title={`${subjectOf(data, shown)?.title ?? "Classroom"} · ${shown.section}`} description={`Year ${shown.yearLevel || 1} · ${shown.term} · ${shown.enrollmentCode}`}>
            <dl className="m-0 grid grid-cols-1 gap-3">
              <div><dt className="text-muted">Assigned instructor</dt><dd className="m-0">{teacherOf(shown) ? fullName(teacherOf(shown)) : "Unassigned"}</dd></div>
              <div>
                <dt className="text-muted">Enrolled students ({activeEnrollmentCount(data, shown.id)})</dt>
                <dd className="m-0">
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {data.enrollments.filter((item) => item.classroomId === shown.id && item.status === "active").map((item) => {
                      const student = data.users.find((user) => user.id === item.studentId);
                      return <li key={item.id}>{fullName(student)} <span className="text-muted">({student?.email})</span></li>;
                    })}
                  </ul>
                </dd>
              </div>
            </dl>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
