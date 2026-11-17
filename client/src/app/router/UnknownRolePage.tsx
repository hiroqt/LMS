import { BookOpen, GraduationCap, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Button } from "../../shared/ui/Button";

/** Shown for a path that is not a workspace. Loaded lazily, so it adds nothing to the entry bundle. */
export default function UnknownRolePage({ unknownPath, onNavigateRole }: { unknownPath: string; onNavigateRole: (role: string) => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4 font-sans text-ink">
      <section aria-labelledby="unknown-title" className="flex w-full max-w-lg flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8">
        <span className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-full bg-primary-700 text-white"><GraduationCap className="size-5" /></span>
          <span className="text-section font-semibold">TMCC LMS</span>
        </span>
        <div className="flex flex-col gap-2">
          <h1 id="unknown-title" className="m-0 text-page-mobile font-semibold sm:text-page">Role path not found</h1>
          <p className="m-0 text-body text-muted">
            <code className="rounded-chip bg-canvas px-1.5 py-0.5 break-all text-ink">{unknownPath || window.location.pathname}</code> is not a workspace in this prototype. Choose one below.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button size="lg" icon={<LayoutDashboard aria-hidden className="size-5" />} onClick={() => onNavigateRole("student")}>Return to Student workspace</Button>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="secondary" icon={<BookOpen aria-hidden className="size-4" />} onClick={() => onNavigateRole("instructor")}>Instructor workspace</Button>
            <Button variant="secondary" icon={<ShieldCheck aria-hidden className="size-4" />} onClick={() => onNavigateRole("admin")}>Admin workspace</Button>
          </div>
        </div>
        <p className="m-0 text-body text-muted">Direct addresses: <code>/student</code>, <code>/instructor</code>, <code>/admin</code></p>
      </section>
    </main>
  );
}
