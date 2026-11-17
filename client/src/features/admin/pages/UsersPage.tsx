import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogContent } from "../../../shared/ui/Dialog";
import { Field, Input, Select } from "../../../shared/ui/Field";
import { useToast } from "../../../shared/ui/toast/useToast";
import { DataTable, EmptyRow } from "../components/DataTable";
import { FormDialog } from "../components/FormDialog";
import { Pagination } from "../components/Pagination";
import { StatusBadge } from "../components/StatusBadge";
import { Toolbar } from "../components/Toolbar";
import { paginateRecords } from "../data/pagination.js";
import type { AdminUser, UserRole } from "../data/types";
import { useAdmin } from "../hooks/useAdmin";
import { useSearchParam } from "../hooks/useSearchParam";
import { classroomName, fullName, PAGE_SIZE } from "../lib/records";

const roleLabels: Record<UserRole, string> = { student: "Student", instructor: "Instructor", admin: "Administrator" };

export default function UsersPage() {
  const { data, update } = useAdmin();
  const toast = useToast();
  const [roleParam, setRole] = useSearchParam("type");
  const [createParam, setCreate] = useSearchParam("create");
  const role = roleParam ?? "all";
  const creating = createParam === "1";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", role: "student" as UserRole });
  const [error, setError] = useState("");
  const [shown, setShown] = useState<AdminUser | null>(null);

  const filter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.users.filter(
      (user) =>
        (!term || `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLowerCase().includes(term)) &&
        (role === "all" || user.role === role) &&
        (status === "all" || user.status === status),
    );
  }, [data.users, query, role, status]);
  const pagination = paginateRecords(rows, page, PAGE_SIZE);
  const filtered = Boolean(query) || role !== "all" || status !== "all";

  const openCreate = (open: boolean) => {
    if (open) {
      setForm({ name: "", email: "", role: "student" });
      setError("");
    }
    setCreate(open ? "1" : undefined);
  };

  const save = () => {
    const email = form.email.trim().toLowerCase();
    const [firstName, ...rest] = form.name.trim().split(/\s+/);
    if (!firstName) return setError("Please enter a first and last name.");
    if (!email) return setError("Email is required.");
    if (data.users.some((user) => user.email.toLowerCase() === email)) return setError("That email address is already registered.");
    const id = `user-${crypto.randomUUID()}`;
    const lastName = rest.join(" ") || "User";
    update(
      (current) => ({ ...current, users: [...current.users, { id, firstName, lastName, email, role: form.role, status: "active", createdAt: new Date().toISOString() }] }),
      { category: "users", action: "created", target: "User", targetId: id, summary: `${firstName} ${lastName} · ${form.role}` },
    );
    openCreate(false);
    toast.show({ title: "Person added", description: `${firstName} ${lastName} can now be enrolled or assigned.`, tone: "success" });
  };

  const toggle = (user: AdminUser) => {
    const next = user.status === "active" ? "inactive" : "active";
    update(
      (current) => ({ ...current, users: current.users.map((item) => (item.id === user.id ? { ...item, status: next, statusChangedAt: new Date().toISOString() } : item)) }),
      { category: "users", action: next === "inactive" ? "deactivated" : "activated", target: "users", targetId: user.id, summary: `Status changed to ${next}` },
    );
  };

  return (
    <>
      <PageHeader
        title="User management"
        description="People and account access in the shared demo."
        actions={<Button icon={<Plus aria-hidden className="size-4" />} onClick={() => openCreate(true)}>Add person</Button>}
      />
      <Toolbar
        searchLabel="Search users"
        query={query}
        onQuery={(value) => filter(() => setQuery(value))}
        onClear={filtered ? () => filter(() => { setQuery(""); setStatus("all"); setRole(undefined); }) : undefined}
      >
        <Field label="Role">
          <Select value={role} onChange={(event) => filter(() => setRole(event.target.value === "all" ? undefined : event.target.value))}>
            <option value="all">All roles</option>
            <option value="student">Students</option>
            <option value="instructor">Instructors</option>
            <option value="admin">Admins</option>
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
      <p className="m-0 font-sans text-body text-muted">{rows.length} {rows.length === 1 ? "person" : "people"}</p>
      <DataTable label="People" head={<tr><th scope="col">Person</th><th scope="col">Role</th><th scope="col">Email</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>}>
        {pagination.records.length ? (
          (pagination.records as AdminUser[]).map((user) => (
            <tr key={user.id}>
              <td>
                <button type="button" onClick={() => setShown(user)} className="min-h-touch rounded-control border-0 bg-transparent p-0 text-left font-sans text-body font-semibold text-primary-700 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus">
                  {fullName(user)}
                </button>
              </td>
              <td>{roleLabels[user.role]}</td>
              <td className="break-all">{user.email}</td>
              <td><StatusBadge status={user.status} /></td>
              <td className="text-right">
                <Button variant="secondary" aria-label={`${user.status === "active" ? "Deactivate" : "Activate"} ${fullName(user)}`} onClick={() => toggle(user)}>
                  {user.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))
        ) : (
          <EmptyRow columns={5}>No people match. Change the search or filters, or add a person.</EmptyRow>
        )}
      </DataTable>
      <Pagination label="User pages" info={pagination} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />

      <FormDialog open={creating} onOpenChange={openCreate} title="Create new person" description="They are added to the shared demo directory." error={error} onSubmit={save}>
        <Field label="Full name" required>
          <Input autoComplete="off" placeholder="e.g. Jordan Rivera" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Email address" required>
          <Input type="email" autoComplete="off" placeholder="e.g. jordan.rivera@tmcc.edu" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </Field>
        <Field label="User role" required>
          <Select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
      </FormDialog>

      <Dialog open={Boolean(shown)} onOpenChange={(open) => !open && setShown(null)}>
        {shown && (
          <DialogContent title={fullName(shown)} description={`${roleLabels[shown.role]} · ${shown.email}`}>
            <dl className="m-0 grid grid-cols-1 gap-3">
              <div><dt className="text-muted">Status</dt><dd className="m-0"><StatusBadge status={shown.status} /></dd></div>
              {shown.role !== "admin" && (
                <div>
                  <dt className="text-muted">{shown.role === "student" ? "Enrolled classrooms" : "Teaching classrooms"}</dt>
                  <dd className="m-0">
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {(shown.role === "student"
                        ? data.enrollments.filter((item) => item.studentId === shown.id && item.status === "active").map((item) => item.classroomId)
                        : data.classrooms.filter((room) => room.instructorId === shown.id && room.status === "active").map((room) => room.id)
                      ).map((id) => <li key={id}>{classroomName(data, id)}</li>)}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
