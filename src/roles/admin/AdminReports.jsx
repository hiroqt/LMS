import { FileText } from "../../icons";
import { buildReport, serializeCsv } from "./adminDashboardData";
import { buildSystemAdministrationReport } from "../shared/systemAdministrationData";

const reports = [
  ["users", "Export users", "People, roles, and account status"],
  ["courses", "Export courses and classrooms", "Subjects, sections, terms, and instructors"],
  ["roster", "Export course rosters", "Classroom enrollment records"],
  ["activity", "Export submissions and grades", "Available coursework, submissions, and grades"],
  ["terms", "Export academic terms", "Term dates and current, planned, or archived status"],
  ["roles", "Export role matrix", "Demo permissions by role, module, and action"],
  ["audit", "Export audit log", "Timestamped metadata for recorded data changes"],
];

export default function AdminReports({ data }) {
  function downloadReport(type) {
    const report = ["terms", "roles", "audit"].includes(type)
      ? buildSystemAdministrationReport(data, type)
      : buildReport(data, type);
    const content = serializeCsv([report.headers, ...report.rows]);
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = report.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <section className="admin-reports-page">
    <div className="admin-directory-heading"><p>Available reports <span>· Export shared browser demo records as CSV</span></p></div>
    <div className="admin-report-grid">
      {reports.map(([type, title, detail]) => <article className="admin-report-card" key={type}>
        <span><FileText size={18} /></span><div><h2>{title}</h2><p>{detail}</p></div>
        <button type="button" onClick={() => downloadReport(type)}>Download CSV</button>
      </article>)}
    </div>
  </section>;
}
