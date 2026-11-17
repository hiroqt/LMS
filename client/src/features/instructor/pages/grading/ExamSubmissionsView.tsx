import { ClipboardCheck } from "lucide-react";
import { describeApiError } from "../../../../shared/api/http";
import { splitName, type Submission } from "../../../../shared/api/overview";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { useExamSubmissions } from "../../api/grading";
import type { ReviewItem } from "../../api/selectors";
import type { Exam, User } from "../../api/types";
import { GradeForm } from "../class/SubmissionsTab";

const waiting = (item: Submission) => item.status === "submitted";

/** Every handed-in attempt of one exam: those waiting first, then graded ones, which can be corrected. */
export function ExamSubmissionsView({ classId, exam, students, selectedId, onSelect }: { classId: string; exam: Exam; students: User[]; selectedId?: string; onSelect: (id?: string) => void }) {
  const query = useExamSubmissions(classId, exam.id);

  if (query.isPending) {
    return <SkeletonGroup label="Loading attempts" className="flex flex-col gap-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24 w-full" /></SkeletonGroup>;
  }
  if (query.isError) {
    const { title, detail } = describeApiError(query.error);
    return <EmptyState title={title} description={detail} action={<Button onClick={() => void query.refetch()}>Try again</Button>} />;
  }

  const attempts = query.data.items.filter((item) => !item.notHandedIn && item.status !== "in_progress").sort((a, b) => Number(waiting(b)) - Number(waiting(a)));
  const toItem = (item: Submission): ReviewItem => ({
    id: String(item.id),
    kind: "exam",
    classroomId: classId,
    courseworkId: exam.id,
    title: exam.title,
    maxScore: exam.totalMarks,
    student: students.find((student) => student.id === item.studentId) ?? { id: item.studentId, ...splitName(item.studentName ?? "Student"), role: "student", status: "active" },
  });
  const nameOf = (item: Submission) => {
    const student = toItem(item).student;
    return `${student?.firstName ?? ""} ${student?.lastName ?? ""}`.trim();
  };
  const selected = attempts.find((item) => String(item.id) === selectedId);

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Submissions" description="Every handed-in attempt. Open one to see each answer beside the key and to change its points." count={attempts.length} />
      {attempts.length ? (
        <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card className="self-start p-2">
            <ul aria-label={`Attempts of ${exam.title}`} className="m-0 flex list-none flex-col p-0">
              {attempts.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={String(item.id) === selectedId ? "true" : undefined}
                    onClick={() => onSelect(String(item.id))}
                    className={cn(
                      "flex min-h-touch w-full flex-col items-start justify-center gap-0.5 rounded-control border-0 px-3 py-2 text-left font-sans focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                      String(item.id) === selectedId ? "bg-primary-100" : "bg-transparent hover:bg-primary-50",
                    )}
                  >
                    <strong className="text-body font-semibold text-ink">{nameOf(item)}</strong>{" "}
                    <span className="text-body text-muted">
                      Attempt {item.attemptNumber} · {waiting(item) ? "awaiting grade" : `graded ${item.score ?? 0} / ${item.maxPoints}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? (
            <GradeForm key={selected.id} item={toItem(selected)} initialFeedback={selected.feedback ?? ""} onDone={() => onSelect(undefined)} />
          ) : (
            <p className="m-0 self-start rounded-card border border-dashed border-line-strong p-4 text-body text-muted">Choose an attempt to see the answers and save a grade.</p>
          )}
        </div>
      ) : (
        <EmptyState icon={<ClipboardCheck />} title="No attempts yet" description="Attempts appear here once students submit." />
      )}
    </div>
  );
}
