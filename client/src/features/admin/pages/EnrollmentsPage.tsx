import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { Field, Select } from "../../../shared/ui/Field";
import { useToast } from "../../../shared/ui/toast/useToast";
import { DataTable, EmptyRow } from "../components/DataTable";
import { FormDialog } from "../components/FormDialog";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { Toolbar } from "../components/Toolbar";
import { paginateRecords } from "../data/pagination.js";
import type { Enrollment } from "../data/types";
import { useAdmin } from "../hooks/useAdmin";
import { useSearchParam } from "../hooks/useSearchParam";
import { classroomName, fullName, PAGE_SIZE, subjectOf } from "../lib/records";

export default function EnrollmentsPage() {
  const { data, update } = useAdmin();
  const toast = useToast();
  const [createParam, setCreate] = useSearchParam("create");
  const [query, setQuery] = useState("");
  const [classroom, setClassroom] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ classroomId: "", studentId: "" });
  const [error, setError] = useState("");
  const filter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.enrollments.filter((item) => {
      const student = data.users.find((user) => user.id === item.studentId);
      const haystack = `${fullName(student)} ${classroomName(data, item.classroomId)}`.toLowerCase();
      return (!term || haystack.includes(term)) && (classroom === "all" || item.classroomId === classroom) && (status === "all" || item.status === status);
    });
  }, [data, query, classroom, status]);
  const pagination = paginateRecords(rows, page, PAGE_SIZE);
  const filtered = Boolean(query) || classroom !== "all" || status !== "all";

  const openCreate = (open: boolean) => {
    if (open) {
      setForm({ classroomId: "", studentId: "" });
      setError("");
    }
    setCreate(open ? "1" : undefined);
  };

  const save = () => {
    if (!form.classroomId || !form.studentId) return setError("Please select both a classroom and a student.");
    if (data.enrollments.some((item) => item.classroomId === form.classroomId && item.studentId === form.studentId && item.status === "active")) {
      return setError("Student is already enrolled in this classroom.");
    }
    const id = `enrollment-${crypto.randomUUID()}`;
    update(
      (current) => ({ ...current, enrollments: [...current.enrollments, { id, classroomId: form.classroomId, studentId: form.studentId, status: "active", createdAt: new Date().toISOString() }] }),
      { category: "courses", action: "enrolled", target: "Enrollment", targetId: id, summary: "Student enrolled in classroom" },
    );
    openCreate(false);
    toast.show({ title: "Student enrolled", description: classroomName(data, form.classroomId), tone: "success" });
  };

  const toggle = (item: Enrollment) => {
    const next = item.status === "active" ? "inactive" : "active";
    update(
      (current) => ({ ...current, enrollments: current.enrollments.map((entry) => (entry.id === item.id ? { ...entry, status: next, statusChangedAt: new Date().toISOString() } : entry)) }),
      { category: "courses", action: next === "inactive" ? "deactivated" : "activated", target: "enrollments", targetId: item.id, summary: `Status changed to ${next}` },
    );
  };

  return (
    <>
      <PageHeader
        title="Enrollments"
        description="Which students are in which classroom."
        actions={<Button icon={<Plus aria-hidden className="size-4" />} onClick={() => openCreate(true)}>Add enrollment</Button>}
      />
      <Toolbar searchLabel="Search enrollments" query={query} onQuery={(value) => filter(() => setQuery(value))} onClear={filtered ? () => filter(() => { setQuery(""); setClassroom("all"); setStatus("all"); }) : undefined}>
        <Field label="Classroom">
          <Select value={classroom} onChange={(event) => filter(() => setClassroom(event.target.value))}>
            <option value="all">All classrooms</option>
            {data.classrooms.map((room) => <option key={room.id} value={room.id}>{classroomName(data, room.id)}</option>)}
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
      <p className="m-0 font-sans text-body text-muted">{rows.length} {rows.length === 1 ? "enrollment" : "enrollments"}</p>
      <DataTable label="Enrollments" head={<tr><th scope="col">Student</th><th scope="col">Classroom</th><th scope="col">Term</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>}>
        {pagination.records.length ? (
          (pagination.records as Enrollment[]).map((item) => {
            const student = data.users.find((user) => user.id === item.studentId);
            const room = data.classrooms.find((entry) => entry.id === item.classroomId);
            return (
              <tr key={item.id}>
                <td>
                  <span className="flex flex-col">
                    <span className="font-semibold">{fullName(student)}</span>
                    <span className="break-all text-muted">{student?.email}</span>
                  </span>
                </td>
                <td>
                  <span className="flex flex-col">
                    <span className="font-semibold">{subjectOf(data, room)?.title ?? "Class"}</span>
                    <span className="text-muted">{room?.section}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap">{room?.term ?? "Fall 2026"}</td>
                <td><StatusBadge status={item.status} /></td>
                <td className="text-right">
                  <Button variant="secondary" aria-label={`${item.status === "active" ? "Remove" : "Restore"} ${fullName(student)} from ${classroomName(data, item.classroomId)}`} onClick={() => toggle(item)}>
                    {item.status === "active" ? "Remove" : "Restore"}
                  </Button>
                </td>
              </tr>
            );
          })
        ) : (
          <EmptyRow columns={5}>No enrollments match. Change the search or filters, or enroll a student.</EmptyRow>
        )}
      </DataTable>
      <Pagination label="Enrollment pages" info={pagination} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />

      <FormDialog open={createParam === "1"} onOpenChange={openCreate} title="Create new enrollment" description="Adds an active student to an active classroom." error={error} onSubmit={save}>
        <Field label="Target classroom" required>
          <Select value={form.classroomId} onChange={(event) => setForm({ ...form, classroomId: event.target.value })}>
            <option value="">Select a classroom</option>
            {data.classrooms.filter((room) => room.status === "active").map((room) => {
              const subject = subjectOf(data, room);
              return <option key={room.id} value={room.id}>{subject?.code} · {subject?.title} ({room.section})</option>;
            })}
          </Select>
        </Field>
        <Field label="Student" required>
          <Select value={form.studentId} onChange={(event) => setForm({ ...form, studentId: event.target.value })}>
            <option value="">Select a student</option>
            {data.users.filter((user) => user.role === "student" && user.status === "active").map((user) => <option key={user.id} value={user.id}>{fullName(user)} ({user.email})</option>)}
          </Select>
        </Field>
      </FormDialog>
    </>
  );
}
