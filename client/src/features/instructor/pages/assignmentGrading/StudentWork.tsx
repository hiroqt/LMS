import { ExternalLink, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Submission } from "../../../../shared/api/overview";
import type { Viewer } from "../../../../shared/api/viewer";
import { formatDue } from "../../../../shared/lib/format";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { safeLink, type StudentRow } from "../../api/assignmentGrading";
import type { Activity } from "../../api/types";
import { GradeForm, NoWorkGradeForm } from "./GradePanel";
import { LateBadge, StatusBadge } from "./StatusBadge";
import { WorkFiles } from "./WorkFiles";

const turnedIn = (item: Submission) => (item.submittedAt ? `Turned in ${formatDue(item.submittedAt)}` : "No time recorded");

/** What one version holds: the written answer, the link, and the files. */
function VersionWork({ version, viewer }: { version: Submission; viewer: Viewer }) {
  if (version.notHandedIn) return <p className="m-0 text-body">Not handed in. This grade was given without work.</p>;
  const link = safeLink(version.link);
  const nothing = !version.text && !version.link && !version.fileName && version.files.length === 0;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {version.text && (
        <div className="flex flex-col gap-1">
          <h4 className="m-0 text-card-title font-semibold">Written answer</h4>
          <p className="m-0 max-w-prose text-body break-words whitespace-pre-wrap">{version.text}</p>
        </div>
      )}
      {version.link && (
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className="m-0 text-card-title font-semibold">Link</h4>
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-touch items-center gap-1.5 self-start text-body font-medium break-all text-primary-700 underline">
              {link}
              <ExternalLink aria-hidden className="size-4 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <p className="m-0 text-body break-all">{version.link} <span className="text-muted">(not a web address, so it is not opened)</span></p>
          )}
        </div>
      )}
      {version.fileName && (
        <p className="m-0 text-body">File name typed before uploads: <span className="font-medium break-words">{version.fileName}</span></p>
      )}
      {version.files.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="m-0 text-card-title font-semibold">Files</h4>
          <WorkFiles key={version.id} files={version.files} viewer={viewer} />
        </div>
      )}
      {nothing && <p className="m-0 text-body text-muted">This version has no text, link, or files.</p>}
    </div>
  );
}

export interface StudentWorkProps {
  classId: string;
  activity: Activity;
  row: StudentRow;
  viewer: Viewer;
  /** Why a "not handed in" grade would be refused now (null when it would be accepted). */
  refusal: string | null;
  next?: StudentRow;
  onNext: (studentId: string) => void;
  onReturn: () => void;
  /** How this student was opened: "click" brings the work into view (phones), "next" also moves focus to the name. */
  arrival?: "click" | "next";
}

/** One student's work: the version shown, earlier versions, the grade, and Return. */
export function StudentWork({ classId, activity, row, viewer, refusal, next, onNext, onReturn, arrival }: StudentWorkProps) {
  const [versionId, setVersionId] = useState<number | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (arrival === "next") heading.current?.focus();
    else if (arrival === "click") heading.current?.scrollIntoView({ block: "nearest" });
  }, [arrival]);
  const latest = row.latest;
  const shown = row.versions.find((item) => item.id === versionId) ?? latest;
  const earlier = row.versions.length > 1;
  const held = activity.gradeRelease === "returned";

  return (
    <section aria-labelledby="student-work-title" className="@container flex min-w-0 flex-col gap-5 rounded-card border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-2">
        <h2 id="student-work-title" ref={heading} tabIndex={-1} className="m-0 scroll-mt-20 outline-none font-sans text-section font-semibold break-words">{row.name}</h2>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge row={row} gradeRelease={activity.gradeRelease} /></div>
      </div>

      {shown ? (
        <div className="flex min-w-0 flex-col gap-4">
          {!shown.notHandedIn && (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-card-title font-semibold">Version {shown.attemptNumber}{shown.id === latest?.id ? "" : " (earlier version)"}</h3>
              <p className="m-0 flex flex-wrap items-center gap-2 text-body text-muted">{turnedIn(shown)}{shown.late && <LateBadge />}</p>
              {shown.id !== latest?.id && <p className="m-0 text-body">The grade goes on the latest version, Version {latest?.attemptNumber}.</p>}
            </div>
          )}
          <VersionWork version={shown} viewer={viewer} />
        </div>
      ) : (
        <p className="m-0 text-body">{row.name} has handed in nothing.</p>
      )}

      {earlier && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-card-title font-semibold">All versions</h3>
          <ul aria-label={`Versions from ${row.name}`} className="m-0 flex list-none flex-col gap-1 p-0">
            {[...row.versions].reverse().map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.id === shown?.id ? "true" : undefined}
                  onClick={() => setVersionId(item.id)}
                  className={cn(
                    "flex min-h-touch w-full flex-wrap items-center gap-x-2 rounded-control border border-line px-3 py-2 text-left font-sans text-body focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                    item.id === shown?.id ? "bg-primary-100 font-semibold" : "bg-surface hover:bg-primary-50",
                  )}
                >
                  Version {item.attemptNumber}{item.id === latest?.id ? " (latest)" : ""} · {turnedIn(item)}{item.late ? " · Late" : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <h3 className="m-0 text-section font-semibold">Grade</h3>
        {latest ? (
          <GradeForm key={`${latest.id}-${latest.gradedAt ?? ""}`} classId={classId} activity={activity} row={row} latest={latest} next={next} onNext={onNext} />
        ) : (
          <NoWorkGradeForm key={row.studentId} classId={classId} activity={activity} row={row} refusal={refusal} />
        )}
      </div>

      {held && row.status === "graded" && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="m-0 text-body">{row.name} can't see this grade until you return it.</p>
          <Button variant="secondary" className="self-start" icon={<Send aria-hidden className="size-4" />} onClick={onReturn}>Return to {row.name}</Button>
        </div>
      )}
      {row.status === "returned" && (
        <p className="m-0 border-t border-line pt-4 text-body">Returned. {row.name} can see this grade; a change you save reaches them at once.</p>
      )}
    </section>
  );
}
