import { useState } from "react";
import { describeApiError } from "../../../../shared/api/http";
import { Button } from "../../../../shared/ui/Button";
import { Dialog, DialogContent } from "../../../../shared/ui/Dialog";
import { Field, Textarea } from "../../../../shared/ui/Field";
import { Skeleton, SkeletonGroup } from "../../../../shared/ui/Skeleton";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { COMMENT_LIMIT, COMMENT_MAX, commentProblem, useCommentBank, useCommentBankActions, type SavedComment } from "../../api/commentBank";

/** One saved comment: add it to the feedback, change it, or delete it (asked first). */
function CommentItem({ comment, onChoose }: { comment: SavedComment; onChoose: (text: string) => void }) {
  const toast = useToast();
  const actions = useCommentBankActions();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [text, setText] = useState(comment.text);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const textId = `saved-comment-${comment.id}`;

  const saveEdit = async () => {
    const problem = commentProblem(text);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    const result = await actions.update(comment.id, text);
    setBusy(false);
    if (!result.ok) {
      setError(result.fieldErrors?.text?.[0]);
      toast.show({ title: "Could not change the comment", description: result.message, tone: "danger" });
      return;
    }
    setMode("view");
    toast.show({ title: "Comment changed", tone: "success" });
  };

  const remove = async () => {
    setBusy(true);
    const result = await actions.remove(comment.id);
    setBusy(false);
    if (!result.ok) {
      toast.show({ title: "Could not delete the comment", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Comment deleted", tone: "success" });
  };

  if (mode === "edit") {
    return (
      <li className="flex flex-col gap-2 rounded-control border border-line p-3">
        <Field label="Comment" hint={`Up to ${COMMENT_MAX} characters.`} error={error}>
          <Textarea rows={3} value={text} onChange={(event) => { setText(event.target.value); setError(undefined); }} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => { setText(comment.text); setError(undefined); setMode("view"); }}>Cancel</Button>
          <Button loading={busy} onClick={() => void saveEdit()}>Save comment</Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-control border border-line p-3">
      <p id={textId} className="m-0 text-body break-words whitespace-pre-wrap">{comment.text}</p>
      {mode === "delete" ? (
        <div role="group" aria-label="Delete this comment?" className="flex flex-col gap-2">
          <p className="m-0 text-body font-semibold">Delete this comment? It is removed from Saved comments; feedback already given keeps it.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setMode("view")}>Keep it</Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>Delete</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button aria-describedby={textId} onClick={() => onChoose(comment.text)}>Add to feedback</Button>
          <Button variant="secondary" aria-describedby={textId} onClick={() => setMode("edit")}>Edit</Button>
          <Button variant="secondary" aria-describedby={textId} onClick={() => setMode("delete")}>Delete</Button>
        </div>
      )}
    </li>
  );
}

export interface SavedCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A comment was chosen: it is added to the feedback. */
  onChoose: (text: string) => void;
  onCloseAutoFocus: (event: Event) => void;
}

/** The instructor's saved comments, newest first, for every class (contract §13). */
export function SavedCommentsDialog({ open, onOpenChange, onChoose, onCloseAutoFocus }: SavedCommentsDialogProps) {
  const list = useCommentBank(open);

  let body;
  if (list.isPending) {
    body = <SkeletonGroup label="Loading your saved comments" className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></SkeletonGroup>;
  } else if (list.isError) {
    const { title, detail } = describeApiError(list.error);
    body = (
      <div role="alert" className="flex flex-col gap-2">
        <p className="m-0 text-body">{title}. {detail}</p>
        <Button variant="secondary" className="self-start" onClick={() => void list.refetch()}>Try again</Button>
      </div>
    );
  } else if (list.data.length === 0) {
    body = <p className="m-0 text-body">No saved comments yet. Write feedback for a student, then choose “Save this feedback as a comment”.</p>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body text-muted">{list.data.length} of {COMMENT_LIMIT} saved comments.</p>
        <ul aria-label="Saved comments" className="m-0 flex list-none flex-col gap-2 p-0">
          {list.data.map((comment) => <CommentItem key={`${comment.id}-${comment.text}`} comment={comment} onChoose={onChoose} />)}
        </ul>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          title="Saved comments"
          description="Your comments for every class. Adding one puts it at the end of the feedback."
          onCloseAutoFocus={onCloseAutoFocus}
        >
          {body}
        </DialogContent>
      )}
    </Dialog>
  );
}
