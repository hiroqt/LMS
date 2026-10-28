import { useMemo, useState } from "react";
import { getAuditLogPage } from "../shared/systemAdministrationData";
import { buildSystemAdministrationReport } from "../shared/systemAdministrationData";
import { serializeCsv } from "./adminDashboardData";

const PAGE_SIZE = 8;

export default function AdminAuditLogs({ data }) {
  const [filters, setFilters] = useState({ category: "all", role: "all", from: "", to: "" });
  const [page, setPage] = useState(1);
  const result = useMemo(() => getAuditLogPage(data, filters, page, PAGE_SIZE), [data, filters, page]);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function exportCsv() {
    const report = buildSystemAdministrationReport(data, "audit");
    const csv = serializeCsv([report.headers, ...report.rows]);
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = report.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <section className="admin-audit-page">
    <div className="admin-directory-heading"><p>Activity history <span>· Metadata only, stored in this browser</span></p><button type="button" className="role-primary" onClick={exportCsv}>Export audit CSV</button></div>
    <div className="admin-audit-filters" aria-label="Filter audit log">
      <label>Category<select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}><option value="all">All categories</option><option value="settings">Settings</option><option value="terms">Academic terms</option><option value="roles">Roles</option><option value="users">Users</option><option value="courses">Courses</option><option value="activity">Learning activity</option></select></label>
      <label>Actor role<select value={filters.role} onChange={(event) => updateFilter("role", event.target.value)}><option value="all">All roles</option><option value="admin">Admin</option><option value="instructor">Instructor</option><option value="student">Student</option><option value="unknown">Not recorded</option></select></label>
      <label>From<input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} /></label>
      <label>To<input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} /></label>
    </div>
    <div className="admin-record-card admin-audit-table"><div className="role-table-wrap"><table className="role-table"><thead><tr><th>Date and time</th><th>Actor</th><th>Role</th><th>Category</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>
      {result.records.length ? result.records.map((event) => <tr key={event.id}><td><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time></td><td>{event.actorName || "Not recorded"}</td><td><span className="role-pill">{event.actorRole || "unknown"}</span></td><td>{event.category}</td><td>{event.action}</td><td><strong>{event.target}</strong></td><td>{event.summary || "—"}</td></tr>) : <tr><td colSpan="7" className="admin-audit-empty">No timestamped events match these filters.</td></tr>}
    </tbody></table></div></div>
    <div className="admin-audit-pagination"><span>{result.total ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, result.total)} of ${result.total} events` : "0 events"}</span><div><button type="button" className="role-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="role-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button></div></div>
    <p className="admin-system-boundary">Historical entries appear only when the source record had a timestamp. New changes record the actor, action, target, and a short summary; submission contents are excluded.</p>
  </section>;
}
