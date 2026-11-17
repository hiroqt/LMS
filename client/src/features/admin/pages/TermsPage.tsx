import { useState, type FormEvent } from "react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Field, Input } from "../../../shared/ui/Field";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { setCurrentAcademicTerm } from "../data/systemAdministrationData.js";
import type { AcademicTerm, AdminData } from "../data/types";
import { useAdmin } from "../hooks/useAdmin";

const emptyForm = { name: "", startDate: "", endDate: "" };

export default function TermsPage() {
  const { data, update } = useAdmin();
  const terms = data.systemAdministration.terms;
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const editing = terms.find((term) => term.id === editingId);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const datesRequired = !editing || Boolean(editing.startDate) || Boolean(editing.endDate);
    if (!name) return setNotice({ text: "Enter a term name.", error: true });
    if (datesRequired && (!form.startDate || !form.endDate)) return setNotice({ text: "Enter a start date and an end date.", error: true });
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate)) return setNotice({ text: "The end date must be after the start date.", error: true });
    if (terms.some((term) => term.id !== editingId && term.name.toLowerCase() === name.toLowerCase())) return setNotice({ text: "That academic term already exists.", error: true });
    const id = editingId || `term-${crypto.randomUUID()}`;
    const saved: AcademicTerm = { id, name, startDate: form.startDate, endDate: form.endDate, status: editing?.status ?? "planned" };
    update(
      (current) => ({
        ...current,
        systemAdministration: { ...current.systemAdministration, terms: editing ? current.systemAdministration.terms.map((term) => (term.id === id ? saved : term)) : [...current.systemAdministration.terms, saved] },
        // Renaming a term renames it on its classrooms; nothing else moves.
        classrooms: editing && editing.name !== name ? current.classrooms.map((room) => (room.term === editing.name ? { ...room, term: name } : room)) : current.classrooms,
      }),
      { category: "terms", action: editing ? "updated" : "created", target: "Academic term", targetId: id, summary: name },
    );
    setForm(emptyForm);
    setEditingId("");
    setNotice({ text: editing ? "Academic term updated." : "Academic term added as planned.", error: false });
  };

  const makeCurrent = (term: AcademicTerm) => {
    update((current) => setCurrentAcademicTerm(current, term.id) as AdminData, { category: "terms", action: "made current", target: "Academic term", targetId: term.id, summary: term.name });
    setNotice({ text: `${term.name} is now the default for new classrooms.`, error: false });
  };

  const archive = (term: AcademicTerm) => {
    update(
      (current) => ({ ...current, systemAdministration: { ...current.systemAdministration, terms: current.systemAdministration.terms.map((item) => (item.id === term.id ? { ...item, status: "archived" } : item)) } }),
      { category: "terms", action: "archived", target: "Academic term", targetId: term.id, summary: term.name },
    );
    setNotice({ text: `${term.name} archived. Existing classroom assignments remain unchanged.`, error: false });
  };

  const edit = (term: AcademicTerm) => {
    setEditingId(term.id);
    setForm({ name: term.name, startDate: term.startDate, endDate: term.endDate });
    setNotice(null);
  };

  return (
    <>
      <PageHeader title="Academic terms" description="The current term is the default for new classrooms. Switching terms never moves existing classrooms." />
      <Card className="p-5">
        <form noValidate onSubmit={save} aria-labelledby="term-form-title" className="flex flex-col gap-4">
          <h2 id="term-form-title" className="m-0 font-sans text-section font-semibold">{editing ? `Edit ${editing.name}` : "Add academic term"}</h2>
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-3">
            <Field label="Term name" required>
              <Input maxLength={60} placeholder="e.g. Spring 2027" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Start date" required={!editing || Boolean(editing.startDate)}>
              <Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
            </Field>
            <Field label="End date" required={!editing || Boolean(editing.endDate)}>
              <Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{editing ? "Save term" : "Add term"}</Button>
            {(editing || form.name || form.startDate || form.endDate) && (
              <Button variant="secondary" onClick={() => { setEditingId(""); setForm(emptyForm); setNotice(null); }}>Clear</Button>
            )}
          </div>
          <p role="status" className={notice?.error ? "m-0 font-medium text-danger" : "m-0 text-success"}>{notice?.text}</p>
        </form>
      </Card>
      <DataTable label="Academic terms" head={<tr><th scope="col">Term</th><th scope="col">Dates</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr>}>
        {terms.map((term) => (
          <tr key={term.id}>
            <td className="font-semibold">{term.name}</td>
            <td className="whitespace-nowrap">{term.startDate && term.endDate ? `${term.startDate} – ${term.endDate}` : <span className="text-muted">Dates not recorded</span>}</td>
            <td><StatusBadge status={term.status} /></td>
            <td>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" aria-label={`Edit ${term.name}`} onClick={() => edit(term)}>Edit</Button>
                {term.status !== "current" && <Button variant="secondary" aria-label={`Make current: ${term.name}`} onClick={() => makeCurrent(term)}>Make current</Button>}
                {term.status === "planned" && <Button variant="secondary" aria-label={`Archive ${term.name}`} onClick={() => archive(term)}>Archive</Button>}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
