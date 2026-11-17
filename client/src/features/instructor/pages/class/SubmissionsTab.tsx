import { Check, ClipboardCheck, Paperclip, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { cn } from "../../../../shared/lib/cn";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Input, Select, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { useQuery } from "@tanstack/react-query";
import { describeApiError, getJson, shouldRetryApiRead } from "../../../../shared/api/http";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { useInstructorActions } from "../../api/actions";
import { gradedLabel, notHandedInGrades, studentsWithoutWork, type ReviewItem, type WorkItem } from "../../api/selectors";
import type { RoleStore, User } from "../../api/types";

interface AttemptDetail {
  questions: Array<{ id: number; type: string; prompt: string; points: number }>;
  answers: Array<{ questionId: number; optionId: number | null; text: string | null; items: string[]; pointsAwarded: number | null }>;
}

/** An exam attempt as the server scored it; essays need the instructor's points. */
function useAttempt(item: ReviewItem, instructorId: string) {
  return useQuery({
    queryKey: ["instructor", "attempt", item.id],
    queryFn: ({ signal }) =>
      getJson<AttemptDetail>(`/api/classes/${encodeURIComponent(item.classroomId)}/coursework/${item.courseworkId}/submissions/${item.id}`, { identity: true, viewer: { id: instructorId, role: "instructor" }, signal }),
    enabled: item.kind === "exam",
    retry: shouldRetryApiRead,
    networkMode: "always",
  });
}

function GradeForm({ item, instructor, onDone }: { item: ReviewItem; instructor: User; onDone: () => void }) {
  const toast = useToast();
  const actions = useInstructorActions();
  const attempt = useAttempt(item, instructor.id);
  const [score, setScore] = useState("");
  const [essayPoints, setEssayPoints] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const student = `${item.student?.firstName ?? "Student"} ${item.student?.lastName ?? ""}`.trim();
  const essays = (attempt.data?.questions ?? []).filter((question) => question.type === "essay");
  const answerOf = (questionId: number) => attempt.data?.answers.find((answer) => answer.questionId === questionId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    let answerPoints: Record<string, number> | undefined;
    let value = Number(score);
    if (item.kind === "activity") {
      if (score.trim() === "" || Number.isNaN(value) || value < 0 || value > item.maxScore) {
        setError(`Enter a score from 0 to ${item.maxScore}.`);
        return;
      }
    } else {
      answerPoints = {};
      for (const essay of essays) {
        const points = Number(essayPoints[essay.id] ?? "");
        if ((essayPoints[essay.id] ?? "").trim() === "" || Number.isNaN(points) || points < 0 || points > essay.points) {
          setError(`Score every essay from 0 to its points.`);
          return;
        }
        answerPoints[essay.id] = points;
      }
      const automatic = (attempt.data?.answers ?? []).filter((answer) => !essays.some((essay) => essay.id === answer.questionId)).reduce((sum, answer) => sum + (answer.pointsAwarded ?? 0), 0);
      value = automatic + Object.values(answerPoints).reduce((sum, points) => sum + points, 0);
    }
    setSaving(true);
    const result = await actions.saveGrade(item, value, feedback, answerPoints);
    setSaving(false);
    if (!result.ok) {
      toast.show({ title: "Could not save the grade", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Grade saved", description: `${student} · ${Math.round(value * 100) / 100} / ${item.maxScore}`, tone: "success" });
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate aria-labelledby="grading-title" className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">{item.kind === "activity" ? "Assignment" : "Assessment"} · {student}</p>
        <h3 id="grading-title" className="m-0 font-sans text-section font-semibold">{item.title}</h3>
      </div>
      {item.kind === "activity" ? (
        <>
          <dl className="m-0 flex flex-col gap-3 rounded-control bg-canvas p-3">
            <div className="flex flex-col"><dt className="flex items-center gap-1.5 text-body text-muted"><Paperclip aria-hidden className="size-4" />Attachment</dt><dd className="m-0 text-body font-medium">{item.submission?.fileAttachmentUrl || "No file name"}</dd></div>
            <div className="flex flex-col"><dt className="text-body text-muted">Student note</dt><dd className="m-0 text-body">{item.submission?.submissionText || "No note"}</dd></div>
          </dl>
          <Field label={`Score (0–${item.maxScore})`} required error={error || undefined}>
            <Input type="number" inputMode="numeric" min={0} max={item.maxScore} value={score} onChange={(event) => setScore(event.target.value)} />
          </Field>
        </>
      ) : attempt.isPending ? (
        <SkeletonGroup label="Loading the attempt" className="flex flex-col gap-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-20 w-full" /></SkeletonGroup>
      ) : attempt.isError ? (
        <p role="alert" className="m-0 text-body text-danger">{describeApiError(attempt.error).title}. <button type="button" onClick={() => void attempt.refetch()} className="min-h-touch border-0 bg-transparent font-sans font-semibold text-primary-700 underline">Try again</button></p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body">The server scored every question except essays. Score each essay below; the total is added up for you.</p>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {(attempt.data?.questions ?? []).map((question, index) => (
              <li key={question.id} className="flex flex-col gap-2 rounded-control bg-canvas p-3 text-body">
                <span className="font-semibold">{index + 1}. {question.prompt}</span>
                {question.type === "essay" ? (
                  <>
                    <p className="m-0 whitespace-pre-wrap">{answerOf(question.id)?.text || "No answer"}</p>
                    <Field label={`Points for question ${index + 1} (0–${question.points})`} required error={error && !essayPoints[question.id] ? error : undefined}>
                      <Input type="number" inputMode="decimal" min={0} max={question.points} value={essayPoints[question.id] ?? ""} onChange={(event) => setEssayPoints((current) => ({ ...current, [question.id]: event.target.value }))} />
                    </Field>
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-muted">
                    {(answerOf(question.id)?.pointsAwarded ?? 0) >= question.points ? <Check aria-hidden className="size-4 text-success" /> : <X aria-hidden className="size-4 text-danger" />}
                    Scored {answerOf(question.id)?.pointsAwarded ?? 0} of {question.points}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      <Field label="Feedback" hint="Optional. Students see it with their grade.">
        <Textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional feedback" />
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={saving}>Save grade</Button>
      </div>
    </form>
  );
}

/** One student without work: a points field opens on demand. */
function NotHandedInRow({ student, item, classroomId }: { student: User; item: WorkItem; classroomId: string }) {
  const toast = useToast();
  const actions = useInstructorActions();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const name = `${student.firstName} ${student.lastName}`.trim();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(points);
    if (points.trim() === "" || Number.isNaN(value) || value < 0 || value > item.points) {
      setError(`Enter a score from 0 to ${item.points}.`);
      return;
    }
    setSaving(true);
    const result = await actions.gradeNotHandedIn(classroomId, item.id, student.id, value);
    setSaving(false);
    if (!result.ok) {
      toast.show({ title: "Could not save the grade", description: result.fieldErrors?.points?.[0] ?? result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Grade saved", description: `${name} · Not handed in · ${value} / ${item.points}`, tone: "success" });
  };

  return (
    <li className="flex flex-col gap-2 rounded-control bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-body font-medium">{name}</span>
        {!open && <Button variant="secondary" aria-label={`Give a grade to ${name}`} onClick={() => setOpen(true)}>Give a grade</Button>}
      </div>
      {open && (
        <form onSubmit={save} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label={`Score for ${name} (0–${item.points})`} required error={error || undefined} className="sm:flex-1">
            <Input type="number" inputMode="decimal" min={0} max={item.points} value={points} onChange={(event) => { setPoints(event.target.value); setError(""); }} />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} aria-label={`Save grade for ${name}`}>Save grade</Button>
          </div>
        </form>
      )}
    </li>
  );
}

/**
 * Students who handed in nothing for one assignment or assessment (D-036): give each a grade,
 * or give everyone left the same points (0 by default) after a confirmation.
 */
function NotHandedInPanel({ store, work, students, classroomId }: { store: RoleStore; work: WorkItem[]; students: User[]; classroomId: string }) {
  const toast = useToast();
  const actions = useInstructorActions();
  const first = work.find((item) => studentsWithoutWork(store, item, students).length) ?? work[0];
  const [chosenId, setChosenId] = useState(first?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [points, setPoints] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const item = work.find((entry) => entry.id === chosenId) ?? first;
  if (!item) return null;
  const missing = studentsWithoutWork(store, item, students);
  const given = notHandedInGrades(store, item, students);

  const giveAll = async () => {
    const value = Number(points);
    if (points.trim() === "" || Number.isNaN(value) || value < 0 || value > item.points) {
      setError(`Enter a score from 0 to ${item.points}.`);
      return;
    }
    setSaving(true);
    const result = await actions.gradeEveryoneNotHandedIn(classroomId, item.id, value);
    setSaving(false);
    if (!result.ok) {
      toast.show({ title: "Could not save the grades", description: result.fieldErrors?.points?.[0] ?? result.message, tone: "danger" });
      return;
    }
    setConfirming(false);
    toast.show({ title: "Grades saved", description: `${value} / ${item.points} for ${result.graded} ${result.graded === 1 ? "student" : "students"} who didn't hand in`, tone: "success" });
  };

  return (
    <section aria-labelledby="not-handed-in" className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-5 font-sans">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h3 id="not-handed-in" className="m-0 text-section font-semibold">Didn't hand in</h3>
        <Field label="Assignment or assessment" className="w-full min-w-0 sm:w-80">
          <Select value={item.id} onChange={(event) => setChosenId(event.target.value)} className="w-full min-w-0">
            {work.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}{entry.closed ? " (closed)" : ""}</option>)}
          </Select>
        </Field>
      </div>
      <p className="m-0 text-body text-muted">{gradedLabel(item)} · {missing.length} {missing.length === 1 ? "student has" : "students have"} handed in nothing.</p>
      {missing.length ? (
        <>
          <ul aria-label={`Didn't hand in ${item.title}`} className="m-0 flex list-none flex-col gap-2 p-0">
            {missing.map((student) => <NotHandedInRow key={`${item.id}-${student.id}`} student={student} item={item} classroomId={classroomId} />)}
          </ul>
          <Button variant="secondary" className="max-w-full shrink self-start whitespace-normal" onClick={() => { setPoints("0"); setError(""); setConfirming(true); }}>Give 0 to everyone who didn't hand in</Button>
        </>
      ) : (
        <p className="m-0 text-body">Everyone has handed in or has a grade.</p>
      )}
      {given.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="m-0 text-card-title font-semibold">Graded as not handed in</h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
            {given.map(({ student, score }) => <li key={student.id}>{student.firstName} {student.lastName} · Not handed in · {score ?? 0} / {item.points}</li>)}
          </ul>
        </div>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        {confirming && (
          <DialogContent
            title="Grade everyone who didn't hand in?"
            description={`${missing.length} ${missing.length === 1 ? "student" : "students"} with nothing handed in for “${item.title}” get this score. Work already handed in or started is not changed.`}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <Button loading={saving} onClick={() => void giveAll()}>Give the grade</Button>
              </>
            }
          >
            <Field label={`Points for each student (0–${item.points})`} required error={error || undefined}>
              <Input type="number" inputMode="decimal" min={0} max={item.points} value={points} onChange={(event) => { setPoints(event.target.value); setError(""); }} />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}

export interface SubmissionsTabProps {
  items: ReviewItem[];
  selectedId?: string;
  onSelect: (id?: string) => void;
  instructor: User;
  store: RoleStore;
  /** The class's assignments and assessments, for "Didn't hand in". */
  work: WorkItem[];
  students: User[];
  classroomId: string;
}

export function SubmissionsTab({ items, selectedId, onSelect, instructor, store, work, students, classroomId }: SubmissionsTabProps) {
  const selected = items.find((item) => item.id === selectedId);
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading title="Submissions" description="Review and grade work from this class." count={items.length} />
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
      <NotHandedInPanel store={store} work={work} students={students} classroomId={classroomId} />
    </div>
  );
}
