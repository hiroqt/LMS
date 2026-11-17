import { Download, FileText } from "lucide-react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Button } from "../../../shared/ui/Button";
import { useAdmin } from "../hooks/useAdmin";
import { downloadReport, type ReportType } from "../lib/download";

const reports: [ReportType, string, string][] = [
  ["users", "Export users", "People, roles, and account status"],
  ["courses", "Export courses and classrooms", "Subjects, sections, terms, and instructors"],
  ["roster", "Export course rosters", "Classroom enrollment records"],
  ["activity", "Export submissions and grades", "Available coursework, submissions, and grades"],
  ["terms", "Export academic terms", "Term dates and current, planned, or archived status"],
  ["roles", "Export role matrix", "Demo permissions by role, module, and action"],
  ["audit", "Export audit log", "Timestamped metadata for recorded data changes"],
];

export default function ReportsPage() {
  const { data } = useAdmin();
  return (
    <>
      <PageHeader title="System reports" description="Download the shared demo records as CSV files that open in any spreadsheet app." />
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-3 p-0 sm:gap-4">
        {reports.map(([type, title, detail]) => (
          <li key={type} className="flex">
            <article aria-labelledby={`report-${type}`} className="flex w-full flex-col gap-3 rounded-card border border-line bg-surface p-4 font-sans text-ink sm:p-5">
              <span aria-hidden className="grid size-10 place-items-center rounded-control bg-primary-100 text-primary-700"><FileText className="size-5" /></span>
              <div className="flex flex-1 flex-col gap-1">
                <h2 id={`report-${type}`} className="m-0 text-card-title font-semibold">{title}</h2>
                <p className="m-0 text-body text-muted">{detail}</p>
              </div>
              <Button variant="secondary" className="self-start" icon={<Download aria-hidden className="size-4" />} onClick={() => downloadReport(data, type)}>
                Download CSV<span className="sr-only">: {title.replace(/^Export /, "")}</span>
              </Button>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
