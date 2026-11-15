import { CircleHelp } from "lucide-react";
import { cn } from "../lib/cn";
import { Dialog, DialogContent, DialogTrigger } from "../ui/Dialog";

/** Sidebar footer link to short, true guidance about using the workspace. */
export function HelpSupport({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger title={collapsed ? "Help & Support" : undefined} className={cn("flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent text-left", collapsed ? "justify-center px-0" : "px-3", "font-sans text-body font-medium text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus")}>
        <CircleHelp aria-hidden className="size-5 shrink-0 text-muted" />
        <span className={collapsed ? "sr-only" : undefined}>Help &amp; Support</span>
      </DialogTrigger>
      <DialogContent title="Help & Support" description="Quick answers for using the TMCC LMS workspace.">
        <dl className="m-0 flex flex-col gap-3 text-body">
          {[
            ["Where is my work saved?", "On this device, as you answer. It keeps saving if your connection drops."],
            ["Answering quizzes from a keyboard", "Press 1–4 to pick an answer, and use Previous and Next to move between questions."],
            ["Switching workspace", "Open your profile menu in the top bar and choose Student, Instructor, or Admin."],
            ["Something looks wrong?", "Ask your instructor in class, or tell the school's LMS administrator what you were doing when it happened."],
          ].map(([question, answer]) => (
            <div key={question} className="flex flex-col gap-0.5">
              <dt className="font-semibold">{question}</dt>
              <dd className="m-0 text-muted">{answer}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
