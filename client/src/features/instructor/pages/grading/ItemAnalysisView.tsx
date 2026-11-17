import { BarChart3, Check, KeyRound, TriangleAlert } from "lucide-react";
import { describeApiError } from "../../../../shared/api/http";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { barWidth, formatAverage, formatRate, formatShare, typeLabel, useItemAnalysis, type ItemAnalysisRow } from "../../api/grading";

/** The correct rate as a number with a plain bar for scale (the number is the information, like Admin's CountRow). */
function RateBar({ rate }: { rate: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex justify-between gap-2 text-body">
        <span>Correct</span>
        <strong className="font-semibold tabular-nums">{formatRate(rate)}</strong>
      </span>
      <span aria-hidden className="h-2 overflow-hidden rounded-full bg-canvas">
        <span className="block h-full rounded-full bg-primary-500" style={{ width: `${barWidth(rate)}%` }} />
      </span>
    </div>
  );
}

function QuestionAnalysis({ row, canFix, onFixKey }: { row: ItemAnalysisRow; canFix: boolean; onFixKey: (questionId: number) => void }) {
  const headingId = `analysis-${row.questionId}`;
  return (
    <li>
      <article aria-labelledby={headingId} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 font-sans">
        <div className="flex flex-col gap-0.5">
          <h3 id={headingId} className="m-0 text-card-title font-semibold">Question {row.number}</h3>
          <p className="m-0 text-body text-muted">{typeLabel(row.type)} · {row.points} {row.points === 1 ? "point" : "points"} · {row.answered} answered</p>
          <p className="m-0 text-body text-ink">{row.prompt}</p>
        </div>
        {row.flag === "check_key" && (
          <div role="note" className="flex flex-col gap-2 rounded-control bg-warning-soft p-3 text-body text-ink sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 flex items-start gap-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <span><strong className="font-semibold">Check the key.</strong> Half or more of the students gave the same answer the key marks wrong.</span>
            </p>
            {canFix && (
              <Button variant="secondary" className="max-w-full shrink self-start whitespace-normal sm:self-auto" icon={<KeyRound aria-hidden className="size-4" />} onClick={() => onFixKey(row.questionId)}>
                Fix the key for question {row.number}
              </Button>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          <div className="flex flex-col gap-2">
            <RateBar rate={row.correctRate} />
            <p className="m-0 text-body">Average: <strong className="font-semibold tabular-nums">{formatAverage(row.averagePoints, row.points)}</strong></p>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="m-0 text-body font-semibold text-muted">Top answers</h4>
            {row.topAnswers.length ? (
              <ol className="m-0 flex list-none flex-col gap-1 p-0 text-body">
                {row.topAnswers.map((answer, index) => (
                  <li key={`${answer.answer}-${index}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 break-words">{answer.answer || "No answer"}</span>
                    <span className="text-muted tabular-nums">{formatShare(answer.count, row.answered)}</span>
                    {answer.isKey && <Badge tone="success"><Check aria-hidden className="size-4" />Answer key</Badge>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="m-0 text-body text-muted">No answers yet.</p>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

/** How each question did across submitted attempts (§6), with a "check the key" flag. */
export function ItemAnalysisView({ classId, examId, examTitle, canFix, onFixKey }: { classId: string; examId: string; examTitle: string; canFix: boolean; onFixKey: (questionId: number) => void }) {
  const query = useItemAnalysis(classId, examId);
  if (query.isPending) {
    return <SkeletonGroup label="Loading item analysis" className="flex flex-col gap-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32 w-full" /></SkeletonGroup>;
  }
  if (query.isError) {
    const { title, detail } = describeApiError(query.error);
    return <EmptyState title={title} description={detail} action={<Button onClick={() => void query.refetch()}>Try again</Button>} />;
  }
  const rows = [...query.data].sort((a, b) => a.number - b.number);
  const flagged = rows.filter((row) => row.flag === "check_key").length;
  return (
    <div className="@container flex flex-col gap-4">
      <SectionHeading
        title="Item analysis"
        description={flagged ? `${flagged} ${flagged === 1 ? "question needs" : "questions need"} a look at the key.` : "Correct rates and the most common answers, over submitted attempts."}
      />
      {rows.length ? (
        <ol aria-label={`Item analysis for ${examTitle}`} className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((row) => <QuestionAnalysis key={row.questionId} row={row} canFix={canFix} onFixKey={onFixKey} />)}
        </ol>
      ) : (
        <EmptyState icon={<BarChart3 />} title="No questions to analyze" description="Results appear once students submit attempts." />
      )}
    </div>
  );
}
