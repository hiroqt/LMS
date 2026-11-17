import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Field, Input, Select } from "../../../shared/ui/Field";
import { DataTable, EmptyRow } from "../components/DataTable";
import { Pagination } from "../components/Pagination";
import { getAuditLogPage } from "../data/systemAdministrationData.js";
import type { AuditEvent } from "../data/types";
import { useAdmin } from "../hooks/useAdmin";
import { downloadReport } from "../lib/download";
import { PAGE_SIZE } from "../lib/records";

const categories = [
  ["settings", "Settings"],
  ["terms", "Academic terms"],
  ["roles", "Roles"],
  ["users", "Users"],
  ["courses", "Courses"],
  ["activity", "Learning activity"],
] as const;

export default function AuditPage() {
  const { data } = useAdmin();
  const [filters, setFilters] = useState({ category: "all", role: "all", from: "", to: "" });
  const [page, setPage] = useState(1);
  const result = useMemo(() => getAuditLogPage(data, filters, page, PAGE_SIZE) as { records: AuditEvent[]; total: number; page: number; pageCount: number; pageNumbers: number[] }, [data, filters, page]);
  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Who changed what, and when. Metadata only, stored in this browser; answers and submission text are never recorded."
        actions={<Button variant="secondary" icon={<Download aria-hidden className="size-4" />} onClick={() => downloadReport(data, "audit")}>Export audit CSV</Button>}
      />
      <div role="group" aria-label="Filter audit log" className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 @xl:grid-cols-2 @4xl:grid-cols-4">
        <Field label="Category">
          <Select value={filters.category} onChange={(event) => setFilter("category", event.target.value)}>
            <option value="all">All categories</option>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Actor role">
          <Select value={filters.role} onChange={(event) => setFilter("role", event.target.value)}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="instructor">Instructor</option>
            <option value="student">Student</option>
            <option value="unknown">Not recorded</option>
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} />
        </Field>
      </div>
      <DataTable label="Audit events" head={<tr><th scope="col">Date and time</th><th scope="col">Actor</th><th scope="col">Category</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr>}>
        {result.records.length ? (
          result.records.map((event) => (
            <tr key={event.id}>
              <td className="whitespace-nowrap"><time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time></td>
              <td>
                <span className="flex flex-col items-start gap-1">
                  <span>{event.actorName || "Not recorded"}</span>
                  <Badge>{event.actorRole || "unknown"}</Badge>
                </span>
              </td>
              <td>{event.category}</td>
              <td>{event.action}</td>
              <td className="font-semibold">{event.target}</td>
              <td className="text-muted">{event.summary || "—"}</td>
            </tr>
          ))
        ) : (
          <EmptyRow columns={6}>No events match these filters.</EmptyRow>
        )}
      </DataTable>
      <Pagination label="Audit log pages" info={result} total={result.total} pageSize={PAGE_SIZE} onPage={setPage} />
    </>
  );
}
