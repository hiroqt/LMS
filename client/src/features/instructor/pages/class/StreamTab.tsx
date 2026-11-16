import { ArrowRight, BookOpen, CalendarDays, ClipboardList, FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { classWork } from "../../api/selectors";
import { dueLabel } from "./classUtils";
import type { ClassTabProps } from "./shared";

export function StreamTab({ room, subject, instructor, content, goTab }: ClassTabProps) {
  const [now] = useState(Date.now);
  const work = classWork(content);
  const upcoming = work.filter((item) => item.dueAt && new Date(item.dueAt).getTime() >= now).slice(0, 4);
  const name = `${instructor.firstName} ${instructor.lastName}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2 p-5">
          <p className="m-0 text-body text-muted">{name} · Class announcement</p>
          <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">Welcome to {subject?.code ?? "class"}</p>
          <h2 className="m-0 font-sans text-section font-semibold">{subject?.title ?? "This class"} is ready for the term</h2>
          <p className="m-0 text-body">{subject?.description ?? "Course information and resources for this classroom."} Use the class tabs to share resources, organize coursework, and keep track of student progress.</p>
          <Button className="mt-1 self-start" onClick={() => goTab("Create content")}>Post class content<ArrowRight aria-hidden className="size-4" /></Button>
        </Card>
        {work.slice(0, 3).map((item) => (
          <Card key={item.id} className="flex items-start gap-3 p-4">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-100 text-accent-700"><ClipboardList className="size-5" /></span>
            <div className="flex flex-1 flex-col gap-1">
              <strong className="text-body font-semibold">{item.kind} · {item.title}</strong>
              <span className="text-body text-muted">{dueLabel(item.dueAt)} · {item.points} points</span>
              <Button variant="ghost" className="-ml-4 self-start" onClick={() => goTab("Classwork")}>View classwork<ArrowRight aria-hidden className="size-4" /></Button>
            </div>
          </Card>
        ))}
        {content.materials.slice(0, 2).map((item) => (
          <Card key={item.id} className="flex items-start gap-3 p-4">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-info-soft text-info"><FileText className="size-5" /></span>
            <div className="flex flex-1 flex-col gap-1">
              <strong className="text-body font-semibold">Material · {item.title}</strong>
              <span className="text-body text-muted">{item.kind ?? "Class material"}</span>
              <Button variant="ghost" className="-ml-4 self-start" onClick={() => goTab("Materials")}>View materials<ArrowRight aria-hidden className="size-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
      <aside aria-label="Class information" className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><CalendarDays aria-hidden className="size-4 text-primary-700" />Upcoming</h2>
          {upcoming.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {upcoming.map((item) => (
                <li key={item.id} className="flex flex-col rounded-control px-2 py-1.5">
                  <span className="text-body font-medium">{item.title}</span>
                  <span className="text-body text-muted">Due {dueLabel(item.dueAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-body text-muted">Nothing due soon.</p>
          )}
          <Button variant="ghost" className="self-start" onClick={() => goTab("Classwork")}>View classwork<ArrowRight aria-hidden className="size-4" /></Button>
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><BookOpen aria-hidden className="size-4 text-primary-700" />About this class</h2>
          <p className="m-0 text-body">{subject?.description ?? "Course information and resources for this classroom."}</p>
          <p className="m-0 text-body text-muted">{content.students.length} students · {room.term ?? "Fall 2026"}</p>
          {room.schedule && <p className="m-0 text-body text-muted">Schedule <strong className="font-semibold text-ink">{room.schedule}</strong></p>}
          {room.source === "isms" && <p className="m-0 text-body text-muted">This class and its class list come from ISMS.</p>}
          {room.enrollmentCode && <p className="m-0 text-body text-muted">Class code <strong className="font-semibold text-ink">{room.enrollmentCode}</strong></p>}
        </Card>
      </aside>
    </div>
  );
}
