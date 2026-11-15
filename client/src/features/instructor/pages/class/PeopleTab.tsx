import { useState } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { Card } from "../../../../shared/ui/Card";
import { ListSearch, type ClassTabProps } from "./shared";

export function PeopleTab({ room, content }: ClassTabProps) {
  const [query, setQuery] = useState("");
  const shown = content.students.filter((item) => `${item.firstName} ${item.lastName} ${item.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Your class community" title="People" count={content.students.length} />
        <ListSearch label="Search students" placeholder="Find a student" value={query} onChange={setQuery} />
      </div>
      <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4"><dt className="text-label font-semibold tracking-wide text-muted uppercase">Class section</dt><dd className="m-0 text-body font-semibold">{room.section}</dd></div>
        <div className="rounded-card border border-line bg-surface p-4"><dt className="text-label font-semibold tracking-wide text-muted uppercase">Enrolled students</dt><dd className="m-0 text-body font-semibold">{content.students.length} students</dd></div>
      </dl>
      <Card className="p-2">
        {shown.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {shown.map((student) => (
              <li key={student.id} className="flex items-center gap-3 rounded-control px-3 py-2">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-100 text-body font-semibold text-primary-700">{student.firstName[0]}{student.lastName[0]}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="truncate text-body font-medium">{student.firstName} {student.lastName}</strong>
                  <span className="truncate text-body text-muted">{student.email}</span>
                </span>
                <span className="text-body text-muted">Student</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 px-3 py-2 text-body text-muted">No students match your search.</p>
        )}
      </Card>
    </div>
  );
}
