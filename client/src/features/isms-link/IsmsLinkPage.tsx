import { Info, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { SkipLink } from "../../shared/layout/SkipLink";
import { PageHeader } from "../../shared/layout/PageHeader";
import { Button } from "../../shared/ui/Button";
import { formatTimestamp } from "./api/format";
import { classFilters } from "./api/isms";
import { ClassesPanel } from "./components/ClassesPanel";
import { StatusPanel } from "./components/StatusPanel";
import { SubjectsPanel } from "./components/SubjectsPanel";
import { useIsmsClasses } from "./hooks/useIsmsClasses";
import { useIsmsSubjects } from "./hooks/useIsmsSubjects";
import { useRefreshIsms } from "./hooks/useRefreshIsms";

const PAGE_TITLE = "ISMS connection";

/** The most recent of the sync times the API reported, if any. */
function latest(...values: (string | undefined)[]): string | undefined {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

/**
 * /isms-link: the first server-backed screen (D-030). Shows ISMS-owned
 * subjects, instructors, and class schedules read through the LMS API, to
 * prove the frontend-to-backend path. Read-only, reached by URL only, and
 * independent of the browser-local Student, Instructor, and Admin data.
 */
export default function IsmsLinkPage() {
  const [instructorId, setInstructorId] = useState("");
  const classes = useIsmsClasses(classFilters(instructorId));
  const subjects = useIsmsSubjects();
  const { refresh, refreshing } = useRefreshIsms();
  const syncedAt = latest(classes.data?.syncedAt, subjects.data?.syncedAt);

  useEffect(() => {
    const previous = document.title;
    document.title = `TMCC LMS · ${PAGE_TITLE}`;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-canvas font-sans text-ink">
      <SkipLink />
      <main id="main-content" tabIndex={-1} className="@container mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 outline-none sm:gap-6 sm:px-6">
        <PageHeader
          title={PAGE_TITLE}
          description="Subjects, instructors, and class schedules from the school's student information system (ISMS), read through the LMS API."
          actions={
            <Button variant="secondary" onClick={() => void refresh()} loading={refreshing} loadingLabel="Refreshing…" icon={<RefreshCw aria-hidden className="size-4" />}>
              Refresh
            </Button>
          }
        />

        <aside aria-label="About this data" className="flex items-start gap-3 rounded-card border border-info/30 bg-info-soft p-4 text-body text-ink">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
          <div className="flex flex-col gap-1">
            <p className="m-0"><strong className="font-semibold">Read-only.</strong> ISMS owns these subjects, instructors, and schedules. Change them in ISMS; this page cannot edit them.</p>
            <p className="m-0 text-muted">
              Last synced from ISMS:{" "}
              {syncedAt ? <time dateTime={syncedAt}>{formatTimestamp(syncedAt)}</time> : "not yet"}
            </p>
          </div>
        </aside>

        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          <StatusPanel />
          <ClassesPanel instructorId={instructorId} onInstructorChange={setInstructorId} />
          <SubjectsPanel />
        </div>
      </main>
    </div>
  );
}
