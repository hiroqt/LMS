import { useState } from "react";
import { setCurrentAcademicTerm } from "../shared/systemAdministrationData";

const actor = { actorId: "admin-1", actorName: "Taylor Morgan", actorRole: "admin", category: "terms" };

export default function AdminAcademicTerms({ data, update }) {
  const terms = data.systemAdministration.terms;
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const editingTerm = terms.find((term) => term.id === editingId);

  function saveTerm(event) {
    event.preventDefault();
    setNotice("");
    const name = form.name.trim();
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate)) {
      setNotice("The end date must be after the start date.");
      return;
    }
    if (terms.some((term) => term.id !== editingId && term.name.toLowerCase() === name.toLowerCase())) {
      setNotice("That academic term already exists.");
      return;
    }
    const editing = terms.find((term) => term.id === editingId);
    const termId = editingId || `term-${crypto.randomUUID()}`;
    const saved = { id: termId, name, startDate: form.startDate, endDate: form.endDate, status: editing?.status || "planned" };
    update((current) => ({
      ...current,
      systemAdministration: { ...current.systemAdministration, terms: editing ? current.systemAdministration.terms.map((term) => term.id === termId ? saved : term) : [...current.systemAdministration.terms, saved] },
      classrooms: editing && editing.name !== name ? current.classrooms.map((room) => room.term === editing.name ? { ...room, term: name } : room) : current.classrooms,
    }), { ...actor, action: editing ? "updated" : "created", target: "Academic term", targetId: termId, summary: name });
    setForm({ name: "", startDate: "", endDate: "" });
    setEditingId("");
    setNotice(editing ? "Academic term updated." : "Academic term added as planned.");
  }

  function editTerm(term) {
    setEditingId(term.id);
    setForm({ name: term.name, startDate: term.startDate, endDate: term.endDate });
    setNotice("");
  }

  function makeCurrent(term) {
    update((current) => setCurrentAcademicTerm(current, term.id), { ...actor, action: "made current", target: "Academic term", targetId: term.id, summary: term.name });
    setNotice(`${term.name} is now the default for new classrooms.`);
  }

  function archiveTerm(term) {
    if (term.status === "current") return;
    update((current) => ({ ...current, systemAdministration: { ...current.systemAdministration, terms: current.systemAdministration.terms.map((item) => item.id === term.id ? { ...item, status: "archived" } : item) } }), { ...actor, action: "archived", target: "Academic term", targetId: term.id, summary: term.name });
    setNotice(`${term.name} archived. Existing classroom assignments remain unchanged.`);
  }

  return <section className="admin-system-page">
    <form className="role-form admin-system-form" onSubmit={saveTerm}>
      <div className="role-form-heading"><div><h3>{editingId ? "Edit academic term" : "Add academic term"}</h3><p>Choose dates for newly configured terms. Existing classroom terms stay as assigned.</p></div></div>
      <label className="role-field"><span>Term name</span><input required maxLength={60} placeholder="e.g. Spring 2027" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label className="role-field"><span>Start date</span><input required={!editingId || Boolean(editingTerm?.startDate)} type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
      <label className="role-field"><span>End date</span><input required={!editingId || Boolean(editingTerm?.endDate)} type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
      <div className="role-form-actions"><button type="button" className="role-secondary" onClick={() => { setEditingId(""); setForm({ name: "", startDate: "", endDate: "" }); }}>Clear</button><button className="role-primary admin-primary-action" type="submit">{editingId ? "Save term" : "Add term"}</button></div>
      {notice && <p className="admin-settings-notice" role="status">{notice}</p>}
    </form>
    <div className="admin-record-card admin-term-table"><div className="role-table-wrap"><table className="role-table"><thead><tr><th>Academic term</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {terms.map((term) => <tr key={term.id}><td><strong>{term.name}</strong></td><td>{term.startDate && term.endDate ? `${term.startDate} – ${term.endDate}` : <small>Dates not recorded</small>}</td><td><span className={`role-status ${term.status === "current" ? "is-active" : ""}`}>{term.status}</span></td><td className="admin-term-actions"><button type="button" className="role-row-action" onClick={() => editTerm(term)}>Edit</button>{term.status !== "current" && <><button type="button" className="role-row-action" onClick={() => makeCurrent(term)}>Make current</button>{term.status !== "archived" && <button type="button" className="role-row-action" onClick={() => archiveTerm(term)}>Archive</button>}</>}</td></tr>)}
    </tbody></table></div></div>
    <p className="admin-system-boundary">The current term is the default for new classrooms. Switching terms never moves existing classrooms.</p>
  </section>;
}
