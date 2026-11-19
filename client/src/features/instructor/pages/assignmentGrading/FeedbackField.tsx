import { BookmarkPlus, MessageSquareText } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "../../../../shared/ui/Button";
import { Field, Textarea } from "../../../../shared/ui/Field";
import { useToast } from "../../../../shared/ui/toast/useToast";
import { appendComment, commentProblem, useCommentBankActions } from "../../api/commentBank";
import { SavedCommentsDialog } from "./SavedCommentsDialog";

export interface FeedbackFieldProps {
  value: string;
  onChange: (value: string) => void;
  hint: ReactNode;
  error?: string;
}

/**
 * The feedback for a grade, with the instructor's saved comments (contract §13): "Saved comments"
 * adds one at the end, and "Save this feedback as a comment" keeps what is written for later.
 */
export function FeedbackField({ value, onChange, hint, error }: FeedbackFieldProps) {
  const toast = useToast();
  const id = useId();
  const comments = useCommentBankActions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // A comment was added: focus goes to the end of the feedback, not back to the button.
  const added = useRef(false);

  const saveAsComment = async () => {
    const problem = commentProblem(value);
    if (problem) {
      toast.show({ title: "Could not save the comment", description: problem, tone: "danger" });
      return;
    }
    setSaving(true);
    const result = await comments.save(value);
    setSaving(false);
    if (!result.ok) {
      toast.show({ title: "Could not save the comment", description: result.message, tone: "danger" });
      return;
    }
    toast.show({ title: "Comment saved", description: "It is in Saved comments for every assignment.", tone: "success" });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Field label="Feedback" hint={hint} error={error}>
        <Textarea id={id} rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={<MessageSquareText aria-hidden className="size-4" />} onClick={() => setOpen(true)}>Saved comments</Button>
        <Button variant="secondary" className="max-w-full shrink whitespace-normal" icon={<BookmarkPlus aria-hidden className="size-4" />} loading={saving} onClick={() => void saveAsComment()}>
          Save this feedback as a comment
        </Button>
      </div>
      <SavedCommentsDialog
        open={open}
        onOpenChange={setOpen}
        onChoose={(text) => {
          onChange(appendComment(value, text));
          added.current = true;
          setOpen(false);
          toast.show({ title: "Comment added", description: "It is at the end of the feedback. Save the grade to keep it.", tone: "success" });
        }}
        onCloseAutoFocus={(event) => {
          if (!added.current) return;
          added.current = false;
          event.preventDefault();
          const field = document.getElementById(id) as HTMLTextAreaElement | null;
          field?.focus();
          field?.setSelectionRange(field.value.length, field.value.length);
        }}
      />
    </div>
  );
}
