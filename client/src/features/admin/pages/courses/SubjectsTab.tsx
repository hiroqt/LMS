import { useMemo, useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DataTable, EmptyRow } from "../../components/DataTable";
import { FormDialog } from "../../components/FormDialog";
import { Pagination } from "../../components/Pagination";
import { Toolbar } from "../../components/Toolbar";
import { paginateRecords } from "../../data/pagination.js";
import type { Subject } from "../../data/types";
import { useAdmin } from "../../hooks/useAdmin";
import { PAGE_SIZE } from "../../lib/records";

export function SubjectsTab({ creating, onCreatingChange }: { creating: boolean; onCreatingChange: (open: boolean) => void }) {
  const { data, update } = useAdmin();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ code: "", title: "", description: "" });
  const [error, setError] = useState("");
  const [shown, setShown] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const sections = (subject: Subject) => data.classrooms.filter((room) => room.subjectId === subject.id).length;
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.subjects.filter((subject) => {
      const inUse = data.classrooms.some((room) => room.subjectId === subject.id);
      return (!term || `${subject.code} ${subject.title} ${subject.description ?? ""}`.toLowerCase().includes(term)) && (usage === "all" || (usage === "in-use" ? inUse : !inUse));
    });
  }, [data.subjects, data.classrooms, query, usage]);
  const pagination = paginateRecords(rows, page, PAGE_SIZE);
  const filter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  const openCreate = (open: boolean) => {
    if (open) {
      setForm({ code: "", title: "", description: "" });
      setError("");
    }
    onCreatingChange(open);
  };

  const save = () => {
    const code = form.code.trim().toUpperCase();
    const title = form.title.trim();
    if (!code) return setError("Subject code is required.");
    if (data.subjects.some((subject) => subject.code.toUpperCase() === code)) return setError("That subject code already exists in catalog.");
    if (!title) return setError("Subject title is required.");
    const id = `subject-${crypto.randomUUID()}`;
    update(
      (current) => ({ ...current, subjects: [...current.subjects, { id, code, title, description: form.description.trim(), createdAt: new Date().toISOString() }] }),
      { category: "courses", action: "created", target: "Subject", targetId: id, summary: `${code} · ${title}` },
    );
    openCreate(false);
    toast.show({ title: "Subject added", description: `${code} · ${title}`, tone: "success" });
  };

  const remove = (subject: Subject) => {
    update(
      (current) => ({ ...current, subjects: current.subjects.filter((item) => item.id !== subject.id) }),
      { category: "courses", action: "deleted", target: "subjects", targetId: subject.id, summary: "Record permanently deleted" },
    );
    toast.show({ title: "Subject deleted", description: `${subject.code} · ${subject.title}`, tone: "success" });
  };

  return (
    <div className="flex flex-col gap-4">
      <Toolbar searchLabel="Search subjects" query={query} onQuery={(value) => filter(() => setQuery(value))} onClear={query || usage !== "all" ? () => filter(() => { setQuery(""); setUsage("all"); }) : undefined}>
        <Field label="Classroom use">
          <Select value={usage} onChange={(event) => filter(() => setUsage(event.target.value))}>
            <option value="all">All subjects</option>
            <option value="in-use">In use</option>
            <option value="unused">No classrooms</option>
          </Select>
        </Field>
      </Toolbar>
      <p className="m-0 font-sans text-body text-muted">{rows.length} {rows.length === 1 ? "subject" : "subjects"}</p>
      <DataTable label="Subjects" head={<tr><th scope="col">Code</th><th scope="col">Subject</th><th scope="col">Classrooms</th><th scope="col">Description</th><th scope="col"><span className="sr-only">Actions</span></th></tr>}>
        {pagination.records.length ? (
          (pagination.records as Subject[]).map((subject) => {
            const count = sections(subject);
            return (
              <tr key={subject.id}>
                <td className="font-semibold tabular-nums">{subject.code}</td>
                <td>
                  <button type="button" onClick={() => setShown(subject)} className="min-h-touch rounded-control border-0 bg-transparent p-0 text-left font-sans text-body font-semibold text-primary-700 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-focus">
                    {subject.title}
                  </button>
                </td>
                <td className="whitespace-nowrap">{count} {count === 1 ? "section" : "sections"}</td>
                <td className="max-w-80 text-muted"><span className="line-clamp-2">{subject.description || "—"}</span></td>
                <td className="text-right">
                  {count === 0 ? (
                    <Button variant="secondary" aria-label={`Delete ${subject.code}`} onClick={() => setDeleting(subject)}>Delete</Button>
                  ) : (
                    <span className="text-muted">In use</span>
                  )}
                </td>
              </tr>
            );
          })
        ) : (
          <EmptyRow columns={5}>No subjects match. Change the search or filter, or add a subject.</EmptyRow>
        )}
      </DataTable>
      <Pagination label="Subject pages" info={pagination} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} />

      <FormDialog open={creating} onOpenChange={openCreate} title="Create new subject" description="Subjects are offered as classroom sections." error={error} onSubmit={save}>
        <Field label="Subject code" required>
          <Input autoComplete="off" placeholder="e.g. CS201" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} />
        </Field>
        <Field label="Subject title" required>
          <Input autoComplete="off" placeholder="e.g. Data Structures and Algorithms" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </Field>
        <Field label="Subject description">
          <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.code ?? "subject"}?`}
        description={`${deleting?.title ?? "This subject"} has no classrooms. Deleting it cannot be undone.`}
        confirmLabel="Delete subject"
        onConfirm={() => deleting && remove(deleting)}
      />

      <Dialog open={Boolean(shown)} onOpenChange={(open) => !open && setShown(null)}>
        {shown && (
          <DialogContent title={`${shown.code} · ${shown.title}`} description={`${sections(shown)} classroom sections`}>
            <p className="m-0">{shown.description || "No description provided."}</p>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
