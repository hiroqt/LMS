import { Megaphone, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SectionHeading } from "../../../../shared/components/SectionHeading";
import { formatDue } from "../../../../shared/lib/format";
import { Button } from "../../../../shared/ui/Button";
import { Card } from "../../../../shared/ui/Card";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { Field, Input, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { isServerClass, writeContent } from "../../api/content";
import { describeApiError } from "../../../../shared/api/http";
import { publishAnnouncement } from "../../api/actions";
import type { ClassTabProps } from "./shared";

const TITLE_MAX = 120;
const MESSAGE_MAX = 1200;

export function AnnouncementsTab({ room, instructor, content }: ClassTabProps) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ title?: string; message?: string }>({});
  const list = [...content.announcements].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = {
      title: title.trim() ? undefined : "Enter a title.",
      message: message.trim() ? undefined : "Enter a message for your students.",
    };
    setErrors(next);
    if (next.title || next.message) return;
    if (pending) return;
    setPending(true);
    try {
      const saved = isServerClass(room)
        ? await writeContent(room.id, instructor.id, "/announcements", { title, message }).then(() => true)
        : publishAnnouncement(instructor, room.id, { title, message });
      if (!saved) {
        toast.show({ title: "Could not post the announcement", description: "Browser storage is full or blocked.", tone: "danger" });
        return;
      }
      toast.show({ title: "Announcement posted", description: isServerClass(room) ? "Saved to this class on the development LMS API." : "Students see it in their class stream.", tone: "success" });
      setTitle("");
      setMessage("");
      setOpen(false);
    } catch (error) {
      toast.show({ title: "Could not post the announcement", description: describeApiError(error).detail, tone: "danger" });
    } finally { setPending(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading eyebrow={room.section} title="Announcements" count={content.announcements.length} />
        {!open && <Button onClick={() => setOpen(true)} icon={<Plus aria-hidden className="size-4" />}>New announcement</Button>}
      </div>
      {open && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <fieldset disabled={pending} className="contents">
          <h3 className="m-0 font-sans text-card-title font-semibold">New class announcement</h3>
          <Field label="Title" required error={errors.title} hint={`${title.length} / ${TITLE_MAX} characters`}>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={TITLE_MAX} placeholder="Announcement title" />
          </Field>
          <Field label="Message" required error={errors.message} hint={`${message.length} / ${MESSAGE_MAX} characters`}>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={MESSAGE_MAX} rows={4} placeholder="Write an update for your students" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setOpen(false); setErrors({}); }}>Cancel</Button>
            <Button type="submit" loading={pending}>Post announcement</Button>
          </div>
        </fieldset>
    </form>
      )}
      {list.length ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {list.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-1 p-5">
                <p className="m-0 text-label font-semibold tracking-wide text-primary-700 uppercase">Class announcement</p>
                <h3 className="m-0 font-sans text-card-title font-semibold">{item.title}</h3>
                <p className="m-0 text-body whitespace-pre-line">{item.message}</p>
                <p className="m-0 text-body text-muted">{instructor.firstName} {instructor.lastName} · {formatDue(item.createdAt)}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        !open && <EmptyState icon={<Megaphone />} title="No announcements yet." description="Post an update and it appears in your students’ class stream." />
      )}
    </div>
  );
}
