import { Save, Send } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "../../../shared/ui/Button";
import { Field, Textarea } from "../../../shared/ui/Field";
import { describeMeetingError, type ChatMessage } from "../api/meetings";
import { formatClock } from "../api/time";
import { linkParts } from "./metadata";

const MAX = 1000;

/**
 * The meeting's chat: every message, newest at the bottom, with clickable links; a box to write
 * in (Enter sends, Shift+Enter starts a new line). Everyone sees when the chat is being saved
 * (D-070, decision 4). A student can't write when the instructor has turned chat off.
 */
export function ChatPanel({ messages, onSend, saving, canWrite, viewerId }: {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<void>;
  saving: boolean;
  canWrite: boolean;
  viewerId: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const log = useRef<HTMLOListElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(value);
      setText("");
    } catch (failure) {
      const problem = describeMeetingError(failure);
      setError([problem.title, problem.detail].filter(Boolean).join(" "));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {saving && (
        <p className="m-0 flex items-start gap-2 rounded-control bg-info-soft p-3 text-body text-info">
          <Save aria-hidden className="mt-0.5 size-4 shrink-0" />This chat is being saved.
        </p>
      )}
      {messages.length === 0 ? (
        <p className="m-0 text-body text-muted">No messages yet.</p>
      ) : (
        <div role="log" aria-label="Chat messages" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-3 focus-visible:outline-focus">
        <ol ref={log} className="m-0 flex list-none flex-col gap-3 p-0">
          {messages.map((message) => (
            <li key={message.id ?? message.key} className="flex flex-col gap-0.5">
              <p className="m-0 text-body">
                <strong className="font-semibold">{message.senderId === viewerId ? "You" : message.senderName}</strong>
                {message.senderRole === "instructor" && <span className="text-muted"> · Instructor</span>}
                <span className="text-muted"> · <time dateTime={message.sentAt}>{formatClock(message.sentAt)}</time></span>
              </p>
              <p className="m-0 text-body whitespace-pre-wrap break-words">
                {linkParts(message.text).map((part, index) =>
                  part.href ? (
                    <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{part.text}<span className="sr-only"> (opens in a new tab)</span></a>
                  ) : (
                    <span key={index}>{part.text}</span>
                  ),
                )}
              </p>
            </li>
          ))}
        </ol>
        </div>
      )}
      {canWrite ? (
        <form onSubmit={(event) => void send(event)} className="flex flex-col gap-2">
          <Field label="Message" hint={text.length > MAX - 100 ? `${MAX - text.length} characters left` : undefined} error={error ?? undefined}>
            <Textarea
              value={text}
              rows={2}
              maxLength={MAX}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
          </Field>
          <Button type="submit" loading={sending} loadingLabel="Sending" disabled={!text.trim()} icon={<Send aria-hidden className="size-4" />} className="self-end">Send</Button>
        </form>
      ) : (
        <p className="m-0 rounded-control bg-canvas p-3 text-body text-muted">The instructor has turned off chat for students.</p>
      )}
    </div>
  );
}
