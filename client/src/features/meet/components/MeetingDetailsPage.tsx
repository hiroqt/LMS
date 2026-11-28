import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { CalendarClock, Download, MessageSquare, Radio, Trash2, UsersRound, Video } from "lucide-react";
import { useState } from "react";
import { BackLink } from "../../../shared/components/BackLink";
import { Panel } from "../../../shared/components/Panel";
import { saveBlob } from "../../../shared/api/assignments";
import { shouldRetryApiRead } from "../../../shared/api/http";
import type { Viewer } from "../../../shared/api/viewer";
import { PageHeader } from "../../../shared/layout/PageHeader";
import { Badge } from "../../../shared/ui/Badge";
import { Button } from "../../../shared/ui/Button";
import { Dialog, DialogClose, DialogContent } from "../../../shared/ui/Dialog";
import { useToast } from "../../../shared/ui/toast/useToast";
import { attendanceCsv, attendanceFileName } from "../api/attendanceCsv";
import { deleteSavedChat, describeMeetingError, fetchAttendance, fetchMeeting, fetchSavedChat, meetingKeys, type ChatMessage, type Meeting, type MeetingAttendance } from "../api/meetings";
import { formatClock, formatDuration, formatMeetingTime } from "../api/time";

export interface MeetingDetailsPageProps {
  viewer: Viewer;
  classId: string;
  meetingId: number;
  className: string;
  onBack: () => void;
  onJoin: (meeting: Meeting) => void;
}

const query = { retry: shouldRetryApiRead, networkMode: "always" } as const;

/**
 * One meeting's own page (D-072, Phase 3): when it was and how long it lasted; for the
 * instructor, who came and for how long (with a CSV); for the class, the saved chat. A meeting
 * still on offers Join; one still to come says when.
 */
export default function MeetingDetailsPage({ viewer, classId, meetingId, className, onBack, onJoin }: MeetingDetailsPageProps) {
  const isInstructor = viewer.role === "instructor";
  const meeting = useQuery({ queryKey: meetingKeys.one(viewer.id, classId, meetingId), queryFn: ({ signal }) => fetchMeeting(viewer, classId, meetingId, signal), ...query });
  const ended = meeting.data?.status === "ended";
  const attendance = useQuery({
    queryKey: [...meetingKeys.one(viewer.id, classId, meetingId), "attendance"],
    queryFn: ({ signal }) => fetchAttendance(viewer, classId, meetingId, signal),
    enabled: isInstructor && meeting.data?.status !== "scheduled" && Boolean(meeting.data),
    ...query,
  });
  const chat = useQuery({
    queryKey: [...meetingKeys.one(viewer.id, classId, meetingId), "chat"],
    queryFn: ({ signal }) => fetchSavedChat(viewer, classId, meetingId, signal),
    enabled: Boolean(meeting.data),
    ...query,
  });

  if (meeting.isPending) return <p role="status" className="m-0 text-body text-muted">Loading the meeting…</p>;
  if (meeting.isError || !meeting.data) {
    const problem = describeMeetingError(meeting.error);
    return (
      <>
        <BackLink label="Back to meetings" onBack={onBack} />
        <PageHeader title={problem.title} description={problem.detail || undefined} />
      </>
    );
  }
  const m = meeting.data;
  const when = m.startedAt && m.endedAt
    ? `${formatMeetingTime(m.startedAt)}–${formatClock(m.endedAt)} · ${formatDuration(m.startedAt, m.endedAt)}`
    : m.startedAt ? `Started ${formatMeetingTime(m.startedAt)}`
    : m.scheduledStart ? `Starts ${formatMeetingTime(m.scheduledStart)}` : "Not scheduled";

  return (
    <>
      <BackLink label="Back to meetings" onBack={onBack} />
      <PageHeader
        title={m.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{className} · {when}</span>
            {m.status === "live" && <Badge tone="success"><Radio aria-hidden className="size-4" />Live now</Badge>}
            {m.status === "ended" && m.endReason === "empty" && <span className="text-muted">Ended when everyone had left</span>}
          </span>
        }
        actions={m.status === "live" && <Button onClick={() => onJoin(m)} icon={<Video aria-hidden className="size-4" />}>Join meeting</Button>}
      />
      <div className="grid grid-cols-1 gap-3 sm:gap-4 @4xl:grid-cols-12">
        {m.status === "scheduled" && (
          <Panel id="meeting-when" icon={<CalendarClock />} title="Not started yet" className="@4xl:col-span-12">
            <p className="m-0 text-body text-muted">{isInstructor ? "Start it from the class's Meetings tab when it's time." : "Join from the class page when the instructor starts it."}</p>
          </Panel>
        )}
        {isInstructor && m.status !== "scheduled" && (
          <AttendancePanel meeting={m} query={attendance} />
        )}
        {m.status !== "scheduled" && (
          <SavedChatPanel viewer={viewer} classId={classId} meeting={m} query={chat} canDelete={isInstructor} ended={ended} wide={!isInstructor} />
        )}
      </div>
    </>
  );
}

function AttendancePanel({ meeting, query: attendance }: { meeting: Meeting; query: UseQueryResult<MeetingAttendance, unknown> }) {
  const data = attendance.data;
  return (
    <Panel
      id="meeting-attendance"
      icon={<UsersRound />}
      title="Attendance"
      description={data ? `${data.studentsJoined} of ${data.studentsOnClassList} students joined${meeting.status === "live" ? " so far" : ""}. Not counted in monthly attendance.` : undefined}
      action={data && <Button variant="secondary" icon={<Download aria-hidden className="size-4" />} onClick={() => saveBlob(new Blob([attendanceCsv(data.people)], { type: "text/csv;charset=utf-8" }), attendanceFileName(meeting))}>Download CSV</Button>}
      className="@4xl:col-span-7"
    >
      {attendance.isPending ? (
        <p role="status" className="m-0 text-body text-muted">Loading attendance…</p>
      ) : attendance.isError || !data ? (
        <p className="m-0 text-body text-muted">{describeMeetingError(attendance.error).title}</p>
      ) : (
        <div role="region" aria-label="Attendance table" tabIndex={0} className="overflow-x-auto focus-visible:outline-3 focus-visible:outline-focus">
          <table className="w-full min-w-[34rem] border-collapse text-left text-body">
            <caption className="sr-only">Who joined {meeting.title}, when, and for how long</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                <th scope="col" className="py-2 pr-3 font-medium">Joined</th>
                <th scope="col" className="py-2 pr-3 font-medium">First joined</th>
                <th scope="col" className="py-2 pr-3 font-medium">Left</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Times</th>
                <th scope="col" className="py-2 text-right font-medium">Minutes</th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((person) => (
                <tr key={person.personId} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2 pr-3 font-semibold">
                    {person.name}
                    {person.role === "instructor" && <span className="font-normal text-muted"> · Instructor</span>}
                    {!person.onClassList && <span className="font-normal text-muted"> · No longer on the class list</span>}
                  </th>
                  <td className="py-2 pr-3">{person.joined ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3 tabular-nums">{person.firstJoinedAt ? formatClock(person.firstJoinedAt) : "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{person.lastLeftAt ? formatClock(person.lastLeftAt) : person.joined ? "Still in" : "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{person.stays}</td>
                  <td className="py-2 text-right tabular-nums">{person.minutesIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function SavedChatPanel({ viewer, classId, meeting, query: chat, canDelete, ended, wide }: {
  viewer: Viewer;
  classId: string;
  meeting: Meeting;
  query: UseQueryResult<ChatMessage[], unknown>;
  canDelete: boolean;
  ended: boolean;
  wide: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const messages = chat.data ?? [];
  const remove = async () => {
    setConfirming(false);
    try {
      await deleteSavedChat(viewer, classId, meeting.id);
      await queryClient.invalidateQueries({ queryKey: meetingKeys.one(viewer.id, classId, meeting.id) });
      toast.show({ title: "Saved chat deleted", description: meeting.title, tone: "success" });
    } catch (error) {
      const problem = describeMeetingError(error);
      toast.show({ title: problem.title, description: problem.detail || undefined, tone: "danger", group: "meeting-chat-delete" });
    }
  };
  return (
    <Panel
      id="meeting-saved-chat"
      icon={<MessageSquare />}
      title="Saved chat"
      count={messages.length || undefined}
      action={canDelete && messages.length > 0 && <Button variant="secondary" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setConfirming(true)}>Delete the saved chat</Button>}
      className={wide ? "@4xl:col-span-12" : "@4xl:col-span-5"}
    >
      {chat.isPending ? (
        <p role="status" className="m-0 text-body text-muted">Loading the saved chat…</p>
      ) : messages.length === 0 ? (
        <p className="m-0 text-body text-muted">{ended ? "The chat wasn't saved in this meeting." : "Nothing saved yet. The instructor chooses whether to save the chat."}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {messages.map((message) => (
            <li key={message.key} className="flex flex-col gap-0.5">
              <p className="m-0 text-body">
                <strong className="font-semibold">{message.senderName}</strong>
                {message.senderRole === "instructor" && <span className="text-muted"> · Instructor</span>}
                <span className="text-muted"> · <time dateTime={message.sentAt}>{formatClock(message.sentAt)}</time></span>
              </p>
              <p className="m-0 max-w-prose text-body whitespace-pre-wrap break-words">{message.text}</p>
            </li>
          ))}
        </ol>
      )}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title="Delete the saved chat?"
          description={`All ${messages.length} saved messages of “${meeting.title}” are deleted for the whole class. This can't be undone.`}
          footer={
            <>
              <DialogClose asChild><Button variant="secondary">Keep it</Button></DialogClose>
              <Button variant="danger" onClick={() => void remove()}>Delete the saved chat</Button>
            </>
          }
        />
      </Dialog>
    </Panel>
  );
}
