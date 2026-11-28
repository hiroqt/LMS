import { CalendarPlus, History, Radio, Trash2, Video } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DateTile } from "../../../shared/components/DateTile";
import { IconTile, ListRow, RowList } from "../../../shared/components/ListRow";
import { Panel } from "../../../shared/components/Panel";
import type { Viewer } from "../../../shared/api/viewer";
import { isApiError } from "../../../shared/api/http";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { Field, Input } from "../../../shared/ui/Field";
import { IconButton } from "../../../shared/ui/IconButton";
import { useToast } from "../../../shared/ui/toast/useToast";
import { createMeeting, deleteMeeting, describeMeetingError, liveMeeting, pastMeetings, startMeeting, upcomingMeetings, type Meeting, type MeetingSettings } from "../api/meetings";
import { formatClock, formatDuration, formatMeetingTime, nextFullHour, toLocalInput } from "../api/time";
import { useClassMeetings, useRefreshMeetings } from "../hooks/useClassMeetings";

export interface ClassMeetingsProps {
  viewer: Viewer;
  classId: string;
  /** Opens the meeting page (same tab: the demo identity is per tab, D-072). */
  onOpen: (meeting: Meeting) => void;
}

/** Opens a past meeting's own page (attendance, saved chat). */
export type OpenDetails = (meeting: Meeting) => void;

/**
 * Above a class page's tabs while a meeting is on: what it is, since when, and Join. The one
 * Join control on the page (C-015); the Meetings tab lists the rest.
 */
export function LiveMeetingBanner({ viewer, classId, onOpen }: ClassMeetingsProps) {
  const live = liveMeeting(useClassMeetings(viewer, classId).data);
  if (!live) return null;
  return (
    <section aria-labelledby="live-meeting-title" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 font-sans text-ink @xl:flex-row @xl:items-center">
      <IconTile tone="bg-success-soft text-success"><Video aria-hidden className="size-5" /></IconTile>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Badge tone="success" className="self-start"><Radio aria-hidden className="size-4" />Live now</Badge>
        <h2 id="live-meeting-title" className="m-0 text-card-title font-semibold break-words">{live.title}</h2>
        {live.startedAt && <p className="m-0 text-body text-muted">Started {formatClock(live.startedAt)}</p>}
      </div>
      <Button onClick={() => onOpen(live)} icon={<Video aria-hidden className="size-4" />} className="max-w-full shrink whitespace-normal">Join meeting</Button>
    </section>
  );
}

/** The instructor's "Start meeting" in the class header. Hidden while a meeting is on (the banner has Join). */
export function StartMeetingButton({ viewer, classId, onOpen }: ClassMeetingsProps) {
  const meetings = useClassMeetings(viewer, classId);
  const refresh = useRefreshMeetings(viewer, classId);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!meetings.data || liveMeeting(meetings.data)) return null;
  const start = async () => {
    setBusy(true);
    try {
      const meeting = await createMeeting(viewer, classId, { startNow: true });
      await refresh();
      onOpen(meeting);
    } catch (error) {
      const problem = describeMeetingError(error);
      toast.show({ title: problem.title, description: problem.detail || undefined, tone: "danger", group: "meeting-start" });
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button onClick={start} loading={busy} loadingLabel="Starting the meeting" icon={<Video aria-hidden className="size-4" />}>
      Start meeting
    </Button>
  );
}

/** The Meetings tab: upcoming and past meetings. The instructor schedules, starts, and deletes them. */
export function MeetingsTab({ viewer, classId, onOpen, onDetails, canManage, className: classTitle }: ClassMeetingsProps & { onDetails: OpenDetails; canManage: boolean; className: string }) {
  const meetings = useClassMeetings(viewer, classId);
  const refresh = useRefreshMeetings(viewer, classId);
  const toast = useToast();
  const [scheduling, setScheduling] = useState(false);
  const [deleting, setDeleting] = useState<Meeting | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  if (meetings.isPending) return <p className="m-0 text-body text-muted" role="status">Loading meetings…</p>;
  if (meetings.isError) {
    const problem = describeMeetingError(meetings.error);
    return (
      <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-line-strong p-4">
        <p className="m-0 text-body font-semibold text-ink">{problem.title}</p>
        {problem.detail && <p className="m-0 text-body text-muted">{problem.detail}</p>}
        <Button variant="secondary" onClick={() => void meetings.refetch()}>Try again</Button>
      </div>
    );
  }
  const upcoming = upcomingMeetings(meetings.data);
  const past = pastMeetings(meetings.data);
  const failed = (error: unknown) => {
    const problem = describeMeetingError(error);
    toast.show({ title: problem.title, description: problem.detail || undefined, tone: "danger", group: "meetings" });
  };
  const start = async (meeting: Meeting) => {
    setBusy(meeting.id);
    try {
      const started = await startMeeting(viewer, classId, meeting.id);
      await refresh();
      onOpen(started);
    } catch (error) {
      failed(error);
      await refresh();
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!deleting) return;
    const meeting = deleting;
    try {
      await deleteMeeting(viewer, classId, meeting.id);
      setDeleting(null);
      await refresh();
      toast.show({ title: "Meeting deleted", description: meeting.title, tone: "success" });
    } catch (error) {
      setDeleting(null);
      failed(error);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-2">
      <Panel
        id="upcoming-meetings"
        icon={<CalendarPlus />}
        title="Upcoming meetings"
        count={upcoming.length}
        action={canManage && <Button variant="secondary" onClick={() => setScheduling(true)}>Schedule a meeting</Button>}
      >
        {upcoming.length === 0 ? (
          <p className="m-0 text-body text-muted">No meetings are scheduled.</p>
        ) : (
          <RowList label="Upcoming meetings">
            {upcoming.map((meeting) => (
              <ListRow
                key={meeting.id}
                lead={meeting.scheduledStart ? <DateTile date={new Date(meeting.scheduledStart)} /> : <IconTile><Video aria-hidden className="size-5" /></IconTile>}
                title={meeting.title}
                meta={meeting.scheduledStart ? formatMeetingTime(meeting.scheduledStart) : "Not scheduled"}
                trail={
                  canManage && (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button variant="secondary" onClick={() => void start(meeting)} loading={busy === meeting.id} loadingLabel={`Starting ${meeting.title}`}>
                        Start<span className="sr-only"> {meeting.title}</span>
                      </Button>
                      <IconButton label={`Delete ${meeting.title}`} onClick={() => setDeleting(meeting)}><Trash2 /></IconButton>
                    </span>
                  )
                }
              />
            ))}
          </RowList>
        )}
      </Panel>

      <Panel id="past-meetings" icon={<History />} title="Past meetings" count={past.length}>
        {past.length === 0 ? (
          <p className="m-0 text-body text-muted">No meetings have ended yet.</p>
        ) : (
          <RowList label="Past meetings">
            {past.map((meeting) => (
              <ListRow
                key={meeting.id}
                lead={meeting.startedAt ? <DateTile date={new Date(meeting.startedAt)} /> : undefined}
                title={meeting.title}
                meta={meeting.startedAt && meeting.endedAt ? `${formatMeetingTime(meeting.startedAt)} · ${formatDuration(meeting.startedAt, meeting.endedAt)}` : "Ended"}
                trail={meeting.savedChatMessages > 0 && <Badge tone="info">{meeting.savedChatMessages} saved messages</Badge>}
                onOpen={() => onDetails(meeting)}
              />
            ))}
          </RowList>
        )}
      </Panel>

      {canManage && <ScheduleMeetingDialog open={scheduling} onOpenChange={setScheduling} viewer={viewer} classId={classId} defaultTitle={`${classTitle} meeting`} onScheduled={refresh} />}
      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent
          title="Delete this meeting?"
          description={deleting ? `“${deleting.title}” on ${deleting.scheduledStart ? formatMeetingTime(deleting.scheduledStart) : "no date"} is removed for the whole class.` : undefined}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Keep it</Button></DialogClose>
              <Button variant="danger" onClick={() => void remove()}>Delete meeting</Button>
            </>
          }
        />
      </Dialog>
    </div>
  );
}

function ScheduleMeetingDialog({ open, onOpenChange, viewer, classId, defaultTitle, onScheduled }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: Viewer;
  classId: string;
  defaultTitle: string;
  onScheduled: () => Promise<void>;
}) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(() => toLocalInput(nextFullHour(new Date())));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // The API's defaults (D-072, decision 7); changeable during the meeting too.
  const [settings, setSettings] = useState<Pick<MeetingSettings, "studentsMayUnmute" | "studentsMayVideo" | "studentsMayShareScreen" | "studentsMayChat" | "saveChat">>({
    studentsMayUnmute: true, studentsMayVideo: true, studentsMayShareScreen: false, studentsMayChat: true, saveChat: false,
  });
  const choices: { key: keyof typeof settings; label: string }[] = [
    { key: "studentsMayUnmute", label: "Students may turn on their mic" },
    { key: "studentsMayVideo", label: "Students may turn on their camera" },
    { key: "studentsMayShareScreen", label: "Students may share their screen" },
    { key: "studentsMayChat", label: "Students may chat" },
    { key: "saveChat", label: "Save the chat" },
  ];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!when) {
      setErrors({ scheduledStart: "Choose when the meeting starts." });
      return;
    }
    setSaving(true);
    try {
      const meeting = await createMeeting(viewer, classId, { title: title.trim() || undefined, scheduledStart: new Date(when).toISOString(), settings });
      await onScheduled();
      onOpenChange(false);
      setTitle("");
      setErrors({});
      toast.show({ title: "Meeting scheduled", description: `${meeting.title} · ${meeting.scheduledStart ? formatMeetingTime(meeting.scheduledStart) : ""}`, tone: "success" });
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([field, messages]) => [field, messages[0] ?? ""])));
      } else {
        const problem = describeMeetingError(error);
        toast.show({ title: problem.title, description: problem.detail || undefined, tone: "danger", group: "meeting-schedule" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Schedule a meeting" description="Students see it in the class's Meetings tab. You start it when it's time.">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
          <Field label="Title" hint={`Leave it empty for “${defaultTitle}”.`} error={errors.title}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={250} />
          </Field>
          <Field label="Starts" required error={errors.scheduledStart}>
            <Input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          </Field>
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 p-0 text-body font-medium text-ink">In the meeting</legend>
            <p className="m-0 mb-1 text-body text-muted">Students join with the mic off. You can change these during the meeting.</p>
            {choices.map((choice) => (
              <label key={choice.key} className="flex min-h-touch cursor-pointer items-center gap-3 rounded-control px-1 hover:bg-primary-50">
                <input type="checkbox" checked={settings[choice.key]} onChange={(event) => setSettings((current) => ({ ...current, [choice.key]: event.target.checked }))} className="size-5 shrink-0 accent-primary-700" />
                <span className="text-body">{choice.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" loading={saving} loadingLabel="Scheduling">Schedule</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
