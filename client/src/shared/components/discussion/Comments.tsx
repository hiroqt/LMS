import { Lock, MessageSquare, Send, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { COMMENT_MAX_LENGTH, type Comment, type CommentTarget, type PrivateThread } from "../../api/comments";
import { describeApiError, isApiError } from "../../api/http";
import type { Viewer } from "../../api/viewer";
import { useComments, useDeleteComment, usePostComment } from "../../hooks/useComments";
import { formatDateTime } from "../../lib/format";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { cn } from "../../lib/cn";
import { Dialog, DialogClose, DialogContent } from "../../ui/Dialog";
import { Field, Select, Textarea } from "../../ui/Field";
import { IconButton } from "../../ui/IconButton";
import { Skeleton, SkeletonGroup } from "../../ui/Skeleton";
import { useToast } from "../../ui/toast/useToast";

/*
 * Discussion on a material or a piece of coursework (D-073): the class comments everyone in the
 * class reads, and private comments between one student and the instructor.
 */

function reason(error: unknown): string {
  if (isApiError(error) && error.status === 400) return Object.values(error.fieldErrors).flat()[0] ?? "Check the comment and try again.";
  if (isApiError(error) && error.title && error.status !== 0) return error.title;
  const { title, detail } = describeApiError(error);
  return `${title}. ${detail}`;
}

interface ThreadProps {
  viewer: Viewer;
  target: CommentTarget;
}

/** One comment list. Deleting asks first, naming whose comment it is (C-013). */
function CommentList({ viewer, target, comments, label, empty }: ThreadProps & { comments: Comment[]; label: string; empty: string }) {
  const toast = useToast();
  const remove = useDeleteComment(viewer, target);
  const [removing, setRemoving] = useState<Comment | null>(null);

  if (!comments.length) return <p className="m-0 text-body text-muted">{empty}</p>;
  return (
    <>
      <ol aria-label={label} className="m-0 flex list-none flex-col divide-y divide-line p-0">
        {comments.map((comment) => {
          const mine = comment.authorId === viewer.id;
          return (
            <li key={comment.id} className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
                  <strong className="font-semibold text-ink">{mine ? `${comment.authorName} (you)` : comment.authorName}</strong>
                  {comment.authorRole === "instructor" && <Badge tone="brand">Instructor</Badge>}
                  <time dateTime={comment.createdAt} className="text-muted">{formatDateTime(comment.createdAt)}</time>
                </p>
                <p className="m-0 text-body break-words whitespace-pre-line text-ink">{comment.body}</p>
              </div>
              {comment.canDelete && (
                <IconButton label={`Delete comment by ${mine ? "you" : comment.authorName} from ${formatDateTime(comment.createdAt)}`} onClick={() => setRemoving(comment)}>
                  <Trash2 />
                </IconButton>
              )}
            </li>
          );
        })}
      </ol>
      <Dialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        {removing && (
          <DialogContent
            title="Delete this comment?"
            description={`${removing.authorId === viewer.id ? "Your" : `${removing.authorName}’s`} comment from ${formatDateTime(removing.createdAt)} will be removed for everyone who can see it. This cannot be undone.`}
            footer={
              <>
                <DialogClose asChild><Button variant="secondary">Keep comment</Button></DialogClose>
                <Button
                  variant="danger"
                  loading={remove.isPending}
                  onClick={async () => {
                    try {
                      await remove.mutateAsync(removing.id);
                      toast.show({ title: "Comment deleted", tone: "success" });
                    } catch (error) {
                      toast.show({ title: "Could not delete the comment", description: reason(error), tone: "danger" });
                    }
                    setRemoving(null);
                  }}
                >
                  Delete comment
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </>
  );
}

/** A text box and a Post button. Private comments go to `studentId`'s thread (instructors) or the student's own. */
function CommentComposer({ viewer, target, label, privateTo, disabled }: ThreadProps & { label: string; privateTo?: string | true; disabled?: boolean }) {
  const toast = useToast();
  const post = usePostComment(viewer, target);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (post.isPending) return;
    const text = body.trim();
    if (!text) return setError("Write a comment first.");
    if (text.length > COMMENT_MAX_LENGTH) return setError(`Use at most ${COMMENT_MAX_LENGTH} characters.`);
    try {
      await post.mutateAsync(
        privateTo === undefined ? { body: text, visibility: "class" } : { body: text, visibility: "private", ...(privateTo === true ? {} : { studentId: privateTo }) },
      );
    } catch (failure) {
      toast.show({ title: "Could not post your comment", description: reason(failure), tone: "danger" });
      return;
    }
    setBody("");
    setError("");
    toast.show({ title: privateTo === undefined ? "Comment posted" : "Private comment sent", tone: "success" });
  };

  return (
    <form onSubmit={submit} noValidate aria-label={label} className="flex flex-col gap-2">
      <Field label={label} error={error || undefined}>
        <Textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError("");
          }}
          rows={2}
          maxLength={COMMENT_MAX_LENGTH}
          disabled={disabled}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={post.isPending} disabled={disabled} className="self-end" icon={<Send aria-hidden className="size-4" />}>
        Post
      </Button>
    </form>
  );
}

/** Loading, error, or the threads. */
function ThreadsState({ viewer, target, children }: ThreadProps & { children: (threads: NonNullable<ReturnType<typeof useComments>["data"]>) => ReactNode }) {
  const query = useComments(viewer, target);
  if (query.data) return <>{children(query.data)}</>;
  if (query.isError) {
    const { title, detail } = describeApiError(query.error);
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-body">
        <p className="m-0"><strong className="font-semibold">Comments could not load.</strong> {title}. {detail}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>
      </div>
    );
  }
  return (
    <SkeletonGroup label="Loading comments" className="flex flex-col gap-2">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-5 w-2/3" />
    </SkeletonGroup>
  );
}

/** The public discussion under a material or piece of coursework. Every student in the class and the instructor read and write here. */
export function ClassDiscussion({ viewer, target, className }: ThreadProps & { className?: string }) {
  const query = useComments(viewer, target);
  const count = query.data?.class.length;
  return (
    <DiscussionPanel
      id="class-comments"
      icon={<MessageSquare aria-hidden className="size-4 text-primary-700" />}
      title={`Class comments${count ? ` (${count})` : ""}`}
      note={viewer.role === "student" ? "Everyone in this class and your instructor can read these." : "Everyone in this class can read these."}
      className={className}
    >
      <ThreadsState viewer={viewer} target={target}>
        {(threads) => <CommentList viewer={viewer} target={target} comments={threads.class} label="Class comments" empty="No class comments yet." />}
      </ThreadsState>
      <CommentComposer viewer={viewer} target={target} label="Add a class comment" />
    </DiscussionPanel>
  );
}

/** A student's private comments to the instructor, under the item's status. */
export function PrivateComments({ viewer, target }: ThreadProps) {
  return (
    <DiscussionPanel id="private-comments" icon={<Lock aria-hidden className="size-4 text-primary-700" />} title="Private comments" note="Only you and your instructor can see these.">
      <ThreadsState viewer={viewer} target={target}>
        {(threads) => (
          <CommentList viewer={viewer} target={target} comments={threads.private.find((thread) => thread.studentId === viewer.id)?.comments ?? []} label="Private comments" empty="No private comments yet." />
        )}
      </ThreadsState>
      <CommentComposer viewer={viewer} target={target} label="Add a private comment" privateTo />
    </DiscussionPanel>
  );
}

/**
 * The discussion is secondary to the page's content (D-074): a flat tinted panel with tighter
 * padding and a 14px heading, so the white content cards with their larger headings read first.
 */
function DiscussionPanel({ id, icon, title, note, className, children }: { id: string; icon: ReactNode; title: string; note: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-3 rounded-card border border-line bg-canvas p-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="m-0 flex items-center gap-2 font-sans text-body font-semibold text-ink">
          {icon}
          {title}
        </h2>
        <p className="m-0 text-body text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

export interface RosterStudent {
  id: string;
  name: string;
}

/**
 * The instructor's view of every student's private thread on one item. Students who wrote are
 * listed first; any student on the class list can be chosen to start a thread.
 */
export function InstructorPrivateThreads({ viewer, target, roster }: ThreadProps & { roster: RosterStudent[] }) {
  return (
    <ThreadsState viewer={viewer} target={target}>
      {(threads) => <PrivateThreadPicker viewer={viewer} target={target} roster={roster} threads={threads.private} />}
    </ThreadsState>
  );
}

function PrivateThreadPicker({ viewer, target, roster, threads }: ThreadProps & { roster: RosterStudent[]; threads: PrivateThread[] }) {
  const withThreads = threads.filter((thread) => thread.comments.length);
  const others = roster.filter((student) => !withThreads.some((thread) => thread.studentId === student.id));
  const [chosen, setChosen] = useState(withThreads[0]?.studentId ?? "");
  const thread = threads.find((item) => item.studentId === chosen);
  const name = thread?.studentName ?? roster.find((student) => student.id === chosen)?.name ?? chosen;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Student" hint={withThreads.length ? `${withThreads.length} ${withThreads.length === 1 ? "student has" : "students have"} written privately.` : "No student has written privately yet."}>
        <Select value={chosen} onChange={(event) => setChosen(event.target.value)}>
          <option value="">Choose a student</option>
          {withThreads.length > 0 && (
            <optgroup label="Wrote privately">
              {withThreads.map((item) => <option key={item.studentId} value={item.studentId}>{item.studentName} ({item.comments.length})</option>)}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Everyone else in the class">
              {others.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </optgroup>
          )}
        </Select>
      </Field>
      {chosen && (
        <section aria-label={`Private comments with ${name}`} className="flex flex-col gap-4">
          <CommentList viewer={viewer} target={target} comments={thread?.comments ?? []} label={`Private comments with ${name}`} empty={`No private comments with ${name} yet.`} />
          <CommentComposer viewer={viewer} target={target} label={`Reply privately to ${name}`} privateTo={chosen} />
        </section>
      )}
    </div>
  );
}

/** The instructor's public thread, without the page section around it (used in a dialog). */
export function InstructorClassThread({ viewer, target }: ThreadProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-body text-muted">Everyone in this class can read these.</p>
      <ThreadsState viewer={viewer} target={target}>
        {(threads) => <CommentList viewer={viewer} target={target} comments={threads.class} label="Class comments" empty="No class comments yet." />}
      </ThreadsState>
      <CommentComposer viewer={viewer} target={target} label="Add a class comment" />
    </div>
  );
}
