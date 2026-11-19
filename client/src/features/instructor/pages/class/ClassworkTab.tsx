import { ArrowRight, ClipboardList, GraduationCap, ListChecks, Lock, LockOpen, Pencil, Plus, SpellCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { cn } from "../../../../shared/lib/cn";
import { FilterChip, FilterChipGroup } from "../../../../shared/ui/FilterChip";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useInstructorActions, type UngradedStudent } from "../../api/actions";
import { useSpellingReview, waitingCount } from "../../api/grading";
import { classWork, gradedLabel, type WorkItem } from "../../api/selectors";
import { instructorPaths } from "../../paths";
import { dueLabel } from "./classUtils";
import { ListSearch, type ClassTabProps } from "./shared";

const FILTERS = [
  { id: "All", label: "All work" },
  { id: "Assignment", label: "Assignments" },
  { id: "Assessment", label: "Assessments" },
] as const;

/** "2 spelling answers to review" on an exam's row, once the spelling review list has any. */
function SpellingWaiting({ classId, examId }: { classId: string; examId: string }) {
  const count = waitingCount(useSpellingReview(classId, examId).data);
  if (!count) return null;
  return (
    <span className="flex items-center gap-1.5 text-body text-warning">
      <SpellCheck aria-hidden className="size-4 shrink-0" />
      {count} {count === 1 ? "spelling answer" : "spelling answers"} to review
    </span>
  );
}

export function ClassworkTab({ room, content, goTab }: ClassTabProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const actions = useInstructorActions();
  const [busy, setBusy] = useState<string>();
  /** Students still to grade, by item id, after a refused close. */
  const [refused, setRefused] = useState<Record<string, UngradedStudent[]>>({});
  const [query, setQuery] = useState("");

  const close = async (item: WorkItem) => {
    setBusy(item.id);
    const result = await actions.closeCoursework(room.id, item.id);
    setBusy(undefined);
    setRefused((current) => {
      const { [item.id]: _previous, ...rest } = current;
      return result.ungraded.length ? { ...rest, [item.id]: result.ungraded } : rest;
    });
    if (result.ok) toast.show({ title: "Closed", description: `${item.title} no longer accepts work.`, tone: "success" });
    else if (!result.ungraded.length) toast.show({ title: "Could not close", description: result.message, tone: "danger" });
  };

  const reopen = async (item: WorkItem) => {
    setBusy(item.id);
    const result = await actions.reopenCoursework(room.id, item.id);
    setBusy(undefined);
    toast.show(result.ok ? { title: "Reopened", description: `${item.title} accepts work again.`, tone: "success" } : { title: "Could not reopen", description: result.message, tone: "danger" });
  };
  const [type, setType] = useState<(typeof FILTERS)[number]["id"]>("All");
  const work = classWork(content);
  const shown = work.filter((item) => (type === "All" || item.kind === type) && `${item.title} ${item.kind}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="Classwork" description="Assignments and assessments" count={work.length} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <ListSearch label="Search classwork" placeholder="Search classwork" value={query} onChange={setQuery} />
          <Button onClick={() => goTab("Create content")} icon={<Plus aria-hidden className="size-4" />}>Create</Button>
        </div>
      </div>
      <FilterChipGroup label="Filter classwork">
        {FILTERS.map((filter) => (
          <FilterChip key={filter.id} selected={type === filter.id} count={filter.id === "All" ? work.length : work.filter((item) => item.kind === filter.id).length} onClick={() => setType(filter.id)}>
            {filter.label}
          </FilterChip>
        ))}
      </FilterChipGroup>
      {shown.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {shown.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 font-sans">
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-control", item.kind === "Assignment" ? "bg-accent-100 text-accent-700" : "bg-info-soft text-info")}>
                  {item.kind === "Assignment" ? <ClipboardList className="size-5" /> : <GraduationCap className="size-5" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <strong className="text-card-title font-semibold">{item.title}</strong>
                  <span className="text-body text-muted">{item.kind} · Due {dueLabel(item.dueAt)} · {item.points} points</span>
                  <span className="text-body text-ink">{gradedLabel(item)}</span>
                  {item.kind === "Assessment" && <SpellingWaiting classId={room.id} examId={item.id} />}
                </span>
                <Badge tone={item.closed || item.draft ? "neutral" : "success"}>{item.draft ? "Draft" : item.closed ? "Closed" : "Published"}</Badge>
                {item.draft ? (
                  <Button
                    variant="secondary"
                    aria-label={`Edit draft ${item.title}`}
                    onClick={() => navigate(item.kind === "Assignment" ? instructorPaths.assignmentEdit(room.id, item.id) : instructorPaths.assessmentEdit(room.id, item.id))}
                    icon={<Pencil aria-hidden className="size-4" />}
                  >
                    Edit draft
                  </Button>
                ) : (
                <>
                {/* Assignments can change after publishing (D-059); a closed one opens read-only. */}
                {item.kind === "Assignment" && (
                  <Button variant="secondary" aria-label={`Edit ${item.title}`} onClick={() => navigate(instructorPaths.assignmentEdit(room.id, item.id))} icon={<Pencil aria-hidden className="size-4" />}>
                    Edit
                  </Button>
                )}
                <Button
                  variant="secondary"
                  aria-label={`Grading for ${item.title}`}
                  onClick={() => navigate(item.kind === "Assignment" ? instructorPaths.assignmentGrading(room.id, item.id) : instructorPaths.examGrading(room.id, item.id))}
                  icon={<ListChecks aria-hidden className="size-4" />}
                >
                  Grading
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === item.id}
                  aria-label={`${item.closed ? "Reopen" : "Close"} ${item.title}`}
                  onClick={() => void (item.closed ? reopen(item) : close(item))}
                  icon={item.closed ? <LockOpen aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
                >
                  {item.closed ? "Reopen" : "Close"}
                </Button>
                </>
                )}
              </div>
              {refused[item.id] && (
                <div role="alert" className="flex flex-col gap-2 rounded-control border border-warning/40 bg-warning-soft p-3 text-body text-ink">
                  <p className="m-0 font-semibold">{item.title} cannot close yet. Still to grade ({refused[item.id]!.length}):</p>
                  <ul aria-label={`Still to grade for ${item.title}`} className="m-0 flex list-disc flex-col gap-0.5 pl-5">
                    {refused[item.id]!.map((student) => <li key={student.studentId}>{student.name}</li>)}
                  </ul>
                  <Button variant="secondary" className="self-start" onClick={() => goTab("Submissions")}>Grade in Submissions<ArrowRight aria-hidden className="size-4" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<ClipboardList />}
          title={work.length ? "No classwork matches your search" : "No classwork yet"}
          action={<Button variant="secondary" onClick={() => goTab("Create content")}>Create the first item<ArrowRight aria-hidden className="size-4" /></Button>}
        />
      )}
    </div>
  );
}
