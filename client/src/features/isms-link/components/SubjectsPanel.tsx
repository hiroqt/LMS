import { BookOpen, Inbox } from "lucide-react";
import { Panel } from "../../../shared/components/Panel";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../shared/ui/Skeleton";
import { useIsmsSubjects } from "../hooks/useIsmsSubjects";
import { QueryError } from "./QueryError";

const columns = ["Subject", "Code", "Units", "Status"];

/** GET /api/subjects as a table (C-016) in a focusable scroll frame (C-013). */
export function SubjectsPanel() {
  const subjects = useIsmsSubjects();

  return (
    <Panel id="isms-subjects-heading" icon={<BookOpen />} title="Subjects" count={subjects.data?.items.length}>
      {subjects.isPending ? (
        <SkeletonGroup label="Loading subjects" className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-10" />)}
        </SkeletonGroup>
      ) : subjects.isError ? (
        <QueryError error={subjects.error} what="Subjects" onRetry={() => void subjects.refetch()} retrying={subjects.isFetching} />
      ) : subjects.data.items.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No subjects in ISMS" description="ISMS returned no subjects." />
      ) : (
        <div role="region" aria-label="Subjects from ISMS" tabIndex={0} className="overflow-x-auto rounded-card border border-line focus-visible:outline-3 focus-visible:outline-focus">
          <table className="w-full min-w-[30rem] border-collapse font-sans text-body text-ink">
            <caption className="sr-only">Subjects from ISMS</caption>
            <thead>
              <tr className="border-b border-line bg-canvas">
                {columns.map((column) => (
                  <th key={column} scope="col" className="px-4 py-3 text-left text-body font-semibold whitespace-nowrap text-muted">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.data.items.map((subject) => (
                <tr key={subject.id} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">{subject.name}</th>
                  <td className="px-4 py-2 whitespace-nowrap">{subject.code ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{subject.units}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{subject.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
