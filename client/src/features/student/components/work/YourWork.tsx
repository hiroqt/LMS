import { CircleMinus, FilePlus2, History, Lock, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { draftFailureMessage, startDraft, unsubmit } from "../../../../shared/api/assignments";
import type { Submission, TurnIn } from "../../../../shared/api/overview";
import type { Rubric } from "../../../../shared/api/rubrics";
import type { HandInSettings } from "../../../../shared/lib/assignmentRules";
import { formatDue } from "../../../../shared/lib/format";
import { useNetworkStatus } from "../../../../shared/hooks/useNetworkStatus";
import { Badge } from "../../../../shared/ui/Badge";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { Dialog, DialogClose, DialogContent } from "../../../../shared/ui/Dialog";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { afterUnsubmit, REFUSALS, splitWork, withRow, workBadges } from "../../api/work";
import { useMyWork } from "../../hooks/useMyWork";
import { useRefreshStudent, useStudentViewer } from "../../hooks/useStudentCatalog";
import { DraftEditor } from "./DraftEditor";
import { GradeSummary } from "./GradeSummary";
import { WorkContents } from "./WorkContents";

export interface YourWorkProps {
  classId: string;
  assessmentId: string;
  /** With the student's own dates (`ownHandIn`). */
  settings: HandInSettings;
  /** The server's verdict (contract §2); the card shows it and never works the rules out. */
  turnIn: TurnIn;
  /** The assignment's rubric once loaded, so a grade can show the level chosen for each criterion. */
  rubric?: Pick<Rubric, "criteria" | "totalPoints"> | null;
}

const RECEIPT_HEADING = "your-work-receipt";
const CARD_HEADING = "your-work";

/** Moves focus once the control that had it is gone (a dialog's trigger replaced by the result). */
const focusLater = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());

/** "Version 2 · Taken back · Oct 23, 2026, 9:00 AM" */
function versionLine(row: Submission): string {
  return [`Version ${row.attemptNumber}`, row.status === "withdrawn" ? "Taken back" : "Turned in", row.submittedAt ? formatDue(row.submittedAt) : "", row.late && row.status !== "withdrawn" ? "Late" : ""].filter(Boolean).join(" · ");
}

/**
 * The student's work on an assignment: its state, the draft (text, link, files), Turn in with a
 * receipt, Take back, a new version, and earlier versions. Every rule comes from `turnIn`.
 */
export function YourWork({ classId, assessmentId, settings, turnIn, rubric }: YourWorkProps) {
  const viewer = useStudentViewer();
  const toast = useToast();
  const refresh = useRefreshStudent();
  const { online } = useNetworkStatus();
  const work = useMyWork(classId, assessmentId);
  const [takingBack, setTakingBack] = useState(false);
  const [takeBackBusy, setTakeBackBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const tookBack = useRef(false);

  const { draft, current, earlier } = splitWork(work.data ?? []);
  const badges = workBadges(turnIn, current);
  // A closed assignment already says so on the page.
  const reason = turnIn.reason && turnIn.reason !== "closed" ? REFUSALS[turnIn.reason] : undefined;
  // The editor shows while work can be turned in and there is no turned-in version, or a new version is under way.
  const editing = turnIn.canTurnIn && (Boolean(draft) || !current);

  const startNewVersion = async () => {
    setStarting(true);
    try {
      const row = await startDraft(viewer, classId, assessmentId);
      work.setRows((rows) => withRow(rows, row));
      toast.show({ title: "New version started", description: "It starts as a copy of what you turned in.", tone: "success" });
      void refresh();
      focusLater(`${CARD_HEADING}-editor`);
    } catch (failure) {
      toast.show({ title: "Could not start a new version", description: draftFailureMessage(failure), tone: "danger" });
    } finally {
      setStarting(false);
    }
  };

  const takeBack = async () => {
    setTakeBackBusy(true);
    try {
      const row = await unsubmit(viewer, classId, assessmentId);
      work.setRows((rows) => afterUnsubmit(rows, row));
      tookBack.current = true;
      setTakingBack(false);
      toast.show({ title: "Work taken back", description: "It is a draft again. Turn it in when it is ready.", tone: "success" });
      void refresh();
    } catch (failure) {
      toast.show({ title: "Could not take your work back", description: draftFailureMessage(failure), tone: "danger" });
    } finally {
      setTakeBackBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-5 p-5">
      <section aria-labelledby={CARD_HEADING} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={CARD_HEADING} className="m-0 font-sans text-section font-semibold">Your work</h2>
          <p className="m-0 flex flex-wrap gap-2">
            <span className="sr-only">Status:</span>
            {badges.map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)}
          </p>
        </div>

        {!turnIn.canTurnIn && reason && (
          <p className="m-0 flex items-start gap-2 rounded-control bg-canvas p-3 text-body text-ink">
            {turnIn.reason === "excused" ? <CircleMinus aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /> : <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />}{reason}
          </p>
        )}

        {work.isPending ? (
          <SkeletonGroup label="Loading your work"><Skeleton className="h-24 w-full" /></SkeletonGroup>
        ) : work.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-body text-danger">Your work could not be loaded. {draftFailureMessage(work.error)}</p>
            <Button variant="secondary" onClick={() => void work.refetch()}>Try again</Button>
          </div>
        ) : (
          <>
            {current && (
              <section aria-labelledby={RECEIPT_HEADING} className="flex flex-col gap-3 rounded-control border border-line p-4">
                <div className="flex flex-col gap-1">
                  <h3 id={RECEIPT_HEADING} tabIndex={-1} className="m-0 font-sans text-card-title font-semibold outline-none">Receipt</h3>
                  <p className="m-0 text-body text-ink">
                    Turned in {current.submittedAt ? formatDue(current.submittedAt) : ""} · Version {current.attemptNumber}{current.late ? " · Late" : ""}
                  </p>
                  {current.files.length > 0 && <p className="m-0 text-body text-muted">Each file’s code is the start of its fingerprint, so you can show which file you turned in.</p>}
                </div>
                <WorkContents work={current} viewer={viewer} showCodes />
                {!draft && (turnIn.canUnsubmit || turnIn.canTurnIn) && (
                  <div className="flex flex-wrap gap-2">
                    {turnIn.canUnsubmit && (
                      <Button variant="secondary" onClick={() => setTakingBack(true)}><Undo2 aria-hidden className="size-4" />Take back</Button>
                    )}
                    {turnIn.canTurnIn && (
                      <Button variant="secondary" onClick={() => void startNewVersion()} loading={starting} loadingLabel="Starting…" disabled={!online}>
                        <FilePlus2 aria-hidden className="size-4" />Turn in a new version
                      </Button>
                    )}
                  </div>
                )}
              </section>
            )}

            {current && <GradeSummary work={current} rubric={rubric} />}

            {editing && (
              <div id={`${CARD_HEADING}-editor`} tabIndex={-1} className="outline-none">
                <DraftEditor
                  classId={classId}
                  assessmentId={assessmentId}
                  settings={settings}
                  turnIn={turnIn}
                  draft={draft}
                  newVersion={Boolean(current)}
                  online={online}
                  setRows={work.setRows}
                  refresh={refresh}
                  onTurnedIn={() => focusLater(RECEIPT_HEADING)}
                />
              </div>
            )}

            {!editing && draft && (
              <section aria-labelledby={`${CARD_HEADING}-draft`} className="flex flex-col gap-2">
                <h3 id={`${CARD_HEADING}-draft`} className="m-0 font-sans text-card-title font-semibold">Your draft, not turned in</h3>
                <WorkContents work={draft} viewer={viewer} />
              </section>
            )}

            {earlier.length > 0 && (
              <section aria-labelledby={`${CARD_HEADING}-earlier`} className="flex flex-col gap-2">
                <h3 id={`${CARD_HEADING}-earlier`} className="m-0 flex items-center gap-2 font-sans text-card-title font-semibold"><History aria-hidden className="size-4 text-muted" />Earlier versions</h3>
                <ul className="m-0 flex flex-col gap-3 p-0">
                  {earlier.map((row) => (
                    <li key={row.id} className="flex list-none flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <p className="m-0 text-body font-medium">{versionLine(row)}</p>
                      <WorkContents work={row} viewer={viewer} showCodes />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </section>

      <Dialog open={takingBack} onOpenChange={setTakingBack}>
        <DialogContent
          title="Take back your work?"
          description={current ? `Version ${current.attemptNumber} goes back to being a draft. Your instructor no longer sees it until you turn it in again.` : undefined}
          onCloseAutoFocus={(event) => {
            // After taking back, the Take back button is gone: go to the draft.
            if (tookBack.current) {
              tookBack.current = false;
              event.preventDefault();
              focusLater(`${CARD_HEADING}-editor`);
            }
          }}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Keep it turned in</Button></DialogClose>
              <Button onClick={() => void takeBack()} loading={takeBackBusy} loadingLabel="Taking back…" disabled={!online}>Take back</Button>
            </>
          }
        />
      </Dialog>
    </Card>
  );
}
