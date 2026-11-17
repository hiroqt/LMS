import { Check, SpellCheck, X } from "lucide-react";
import { describeApiError } from "../../../../shared/api/http";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { Button } from "../../../../shared/ui/Button";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { rowKey, useSpellingDecision, useSpellingReview, waitingCount, type SpellingDecision, type SpellingReviewRow } from "../../api/grading";
import { MatchNoteLabel } from "../../components/MatchNoteLabel";

/**
 * Near misses for one exam (§6): what each student wrote beside the accepted answers, with
 * Accept and Reject. A decision shows at once and goes back if the server refuses it.
 */
export function SpellingReviewView({ classId, examId, examTitle }: { classId: string; examId: string; examTitle: string }) {
  const toast = useToast();
  const query = useSpellingReview(classId, examId);
  const decide = useSpellingDecision(classId, examId, {
    // One toast per answer: a saved retry replaces the error it fixed.
    onSuccess: (row) => toast.show({ group: `spelling-${rowKey(row)}`, title: row.decision === "rejected" ? "Marked wrong" : "Accepted", description: `${row.studentName} · question ${row.number} · ${row.pointsAwarded ?? 0} / ${row.points}`, tone: "success" }),
    onError: (message, row) => toast.show({ group: `spelling-${rowKey(row)}`, title: `Could not save the decision for ${row.studentName}`, description: message, tone: "danger" }),
  });

  if (query.isPending) {
    return <SkeletonGroup label="Loading the spelling review" className="flex flex-col gap-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32 w-full" /></SkeletonGroup>;
  }
  if (query.isError) {
    const { title, detail } = describeApiError(query.error);
    return <EmptyState title={title} description={detail} action={<Button onClick={() => void query.refetch()}>Try again</Button>} />;
  }

  const rows = query.data;
  const left = waitingCount(rows);
  const choose = (row: SpellingReviewRow, decision: SpellingDecision) => {
    if (row.decision === decision) return;
    decide.mutate({ row, decision });
  };
  const caption = `Spelling review for ${examTitle}`;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title="Spelling review"
        count={left}
        description={left ? `${left} ${left === 1 ? "answer is" : "answers are"} waiting for your decision. Answers accepted with a spelling difference are listed too.` : "Nothing is waiting for you. Answers accepted with a spelling difference are listed so you can check them."}
      />
      {rows.length ? (
        // `relative` keeps sr-only text inside the scroll frame (L-058).
        <div role="region" aria-label={caption} tabIndex={0} className="relative overflow-x-auto rounded-card border border-line bg-surface focus-visible:outline-3 focus-visible:outline-focus">
          <table className="w-full min-w-[52rem] border-collapse font-sans text-body text-ink [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-top [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:align-top">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-canvas text-muted">
              <tr>
                <th scope="col" className="font-semibold whitespace-nowrap">Student</th>
                <th scope="col" className="font-semibold whitespace-nowrap">Question</th>
                <th scope="col" className="font-semibold whitespace-nowrap">Wrote</th>
                <th scope="col" className="font-semibold whitespace-nowrap">Accepted answers</th>
                <th scope="col" className="font-semibold whitespace-nowrap">Note</th>
                <th scope="col" className="font-semibold whitespace-nowrap">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const who = `${row.studentName}, question ${row.number}`;
                return (
                  <tr key={rowKey(row)}>
                    <th scope="row" className="border-t border-line font-semibold whitespace-nowrap">{row.studentName}</th>
                    <td className="max-w-64"><span className="font-medium">{row.number}.</span> {row.prompt}</td>
                    <td className="font-semibold break-words">{row.given}</td>
                    <td className="break-words">{row.accepted.join(", ")}</td>
                    <td><MatchNoteLabel note={row.matchNote} decision={row.decision} /></td>
                    <td>
                      <div role="group" aria-label={`Decision for ${who}`} className="flex gap-2">
                        <Button
                          variant="secondary"
                          aria-pressed={row.decision === "accepted"}
                          className="aria-pressed:border-primary-600 aria-pressed:bg-primary-100 aria-pressed:text-primary-800"
                          aria-label={`Accept ${who}`}
                          icon={<Check aria-hidden className="size-4" />}
                          onClick={() => choose(row, "accepted")}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          aria-pressed={row.decision === "rejected"}
                          className="aria-pressed:border-primary-600 aria-pressed:bg-primary-100 aria-pressed:text-primary-800"
                          aria-label={`Reject ${who}`}
                          icon={<X aria-hidden className="size-4" />}
                          onClick={() => choose(row, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<SpellCheck />} title="No spelling to review" description="Near misses appear here when the exam allows small typos or holds them for you." />
      )}
    </div>
  );
}
