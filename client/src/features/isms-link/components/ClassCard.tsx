import { ChevronUp, Users } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import { meetingLabel } from "../api/format";
import type { IsmsClass } from "../api/types";
import { ClassRoster } from "./ClassRoster";

/** One ISMS class schedule; the roster is a disclosure that loads on first open. */
export function ClassCard({ item }: { item: IsmsClass }) {
  const [open, setOpen] = useState(false);
  const rosterId = useId();
  const code = item.subjectCode ?? "No code";
  const section = item.sectionName ?? `Section ${item.sectionId}`;
  const label = `${code} ${section}`;

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4 font-sans text-ink">
      <div className="flex flex-col gap-0.5">
        <h3 className="m-0 text-card-title font-semibold text-ink">{item.subjectName}</h3>
        <p className="m-0 text-body text-muted">{code} · {section}</p>
      </div>
      <dl className="m-0 flex flex-col gap-2 text-body">
        <div className="flex flex-col">
          <dt className="text-muted">Instructor</dt>
          <dd className="m-0">{item.instructorName}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted">Schedule</dt>
          <dd className="m-0">
            {item.meetings.length === 0 ? (
              "No meetings scheduled"
            ) : (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {item.meetings.map((meeting) => (
                  <li key={`${meeting.day}-${meeting.timeFrom}-${meeting.roomId}`} className="tabular-nums">
                    {meetingLabel(meeting)} <span className="text-muted">· room ID {meeting.roomId}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
      <Button
        variant="secondary"
        // Visible text first, so the name still contains the label (WCAG 2.5.3).
        aria-label={`${open ? "Hide" : "Show"} students for ${label}`}
        aria-expanded={open}
        aria-controls={open ? rosterId : undefined}
        onClick={() => setOpen((value) => !value)}
        icon={open ? <ChevronUp aria-hidden className="size-4" /> : <Users aria-hidden className="size-4" />}
        className="max-w-full shrink self-start whitespace-normal"
      >
        {open ? "Hide students" : "Show students"}
      </Button>
      {open && <ClassRoster id={rosterId} classId={item.id} className={label} />}
    </li>
  );
}
