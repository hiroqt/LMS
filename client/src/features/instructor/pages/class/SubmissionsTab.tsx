import { Check, ClipboardCheck, Paperclip, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { saveGrade } from "../../api/actions";
import { suggestedScore, type ReviewItem } from "../../api/selectors";
import type { User } from "../../api/types";

function GradeForm({ item, instructor, onDone }: { item: ReviewItem; instructor: User; onDone: () => void }) {
  const toast = useToast();
  const [score, setScore] = useState(item.kind === "exam" ? String(suggestedScore(item)) : "");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const student = `${item.student?.firstName ?? "Student"} ${item.student?.lastName ?? ""}`.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(score);
    if (score.trim() === "" || Number.isNaN(value) || value < 0 || value > item.maxScore) {
      setError(`Enter a score from 0 to ${item.maxScore}.`);
      return;
    }
    if (!saveGrade(instructor, item, value, feedback)) {
      toast.show({ title: "Could not save the grade", description: "Browser storage is full or blocked.", tone: "danger" });
      return;
    }
    toast.show({ title: "Grade saved", description: `${student} · ${value} / ${item.maxScore}`, tone: "success" });
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="grading-title" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">{item.kind === "activity" ? "Assignment" : "Assessment"} · {student}</p>
        <h3 id="grading-title" className="m-0 font-sans text-section font-semibold">{item.title}</h3>
      </div>
      {item.kind === "activity" ? (
        <dl className="m-0 flex flex-col gap-3 rounded-control bg-canvas p-3">
          <div className="flex flex-col"><dt className="flex items-center gap-1.5 text-body text-muted"><Paperclip aria-hidden className="size-4" />Attachment</dt><dd className="m-0 text-body font-medium">{item.submission?.fileAttachmentUrl || "No file name"}</dd></div>
          <div className="flex flex-col"><dt className="text-body text-muted">Student note</dt><dd className="m-0 text-body">{item.submission?.submissionText || "No note"}</dd></div>
        </dl>
      ) : (
        <div className="flex flex-col gap-2 rounded-control bg-canvas p-3">
          <p className="m-0 text-body"><strong className="font-semibold">Auto-score: {item.correct} / {item.questions.length} correct.</strong> The score below starts at the scaled value; adjust it if needed.</p>
          <ol className="m-0 flex max-h-56 list-none flex-col gap-1 overflow-y-auto p-0">
            {item.questions.map((question, index) => {
              const right = item.answers[index] === question.correct;
              return (
                <li key={`${index}-${question.prompt}`} className="flex items-start gap-2 text-body">
                  <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", right ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {right ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </span>
                  <span><span className="sr-only">{right ? "Correct: " : "Incorrect: "}</span>{index + 1}. {question.prompt}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <Field label={`Score (0–${item.maxScore})`} required error={error || undefined}>
        <Input type="number" inputMode="numeric" min={0} max={item.maxScore} value={score} onChange={(event) => setScore(event.target.value)} />
      </Field>
      <Field label="Feedback" hint="Optional. Students see it with their grade.">
        <Textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional feedback" />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit">Save grade</Button>
      </div>
    </form>
  );
}

export function SubmissionsTab({ items, selectedId, onSelect, instructor }: { items: ReviewItem[]; selectedId?: string; onSelect: (id?: string) => void; instructor: User }) {
  const selected = items.find((item) => item.id === selectedId);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading eyebrow="Review and grade work from this class." title="Submissions" count={items.length} />
      {items.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card className="self-start p-2">
            <ul className="m-0 flex list-none flex-col p-0">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={item.id === selectedId ? "true" : undefined}
                    onClick={() => onSelect(item.id)}
                    className={cn(
                      "flex min-h-touch w-full flex-col items-start justify-center gap-0.5 rounded-control border-0 px-3 py-2 text-left font-sans focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus",
                      item.id === selectedId ? "bg-primary-100" : "bg-transparent hover:bg-primary-50",
                    )}
                  >
                    <strong className="text-body font-semibold text-ink">{item.title}</strong>
                    <span className="text-body text-muted">{item.student?.firstName} {item.student?.lastName} · {item.kind === "activity" ? "Assignment" : "Assessment"} · awaiting grade</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {selected ? (
            <GradeForm key={selected.id} item={selected} instructor={instructor} onDone={() => onSelect(undefined)} />
          ) : (
            <p className="m-0 self-start rounded-card border border-dashed border-line-strong p-4 text-body text-muted">Choose a submission to review it and save a grade.</p>
          )}
        </div>
      ) : (
        <EmptyState icon={<ClipboardCheck />} title="No submissions waiting" description="New work from this class appears here after students submit." />
      )}
    </div>
  );
}
