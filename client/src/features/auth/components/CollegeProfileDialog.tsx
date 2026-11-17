import { ChevronRight, Compass, HeartHandshake, Landmark, Lightbulb, Target, Telescope, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "../../../shared/ui/Dialog";
import { collegeProfile, type CollegeStatement } from "../data/collegeProfile";
import { CoreValueList } from "./CoreValueList";

const ICONS: Record<CollegeStatement["id"], LucideIcon> = {
  vision: Telescope,
  mission: Compass,
  goal: Target,
  philosophy: Lightbulb,
  "core-values": HeartHandshake,
};

const sectionId = (statement: CollegeStatement) => `profile-${statement.id}`;

/**
 * "Institutional profile": one dialog that lists every college statement in the college's
 * own wording and order (D-048, D-049). The body scrolls; a row of section buttons stays at
 * its top and jumps to a section, moving focus to its heading. Esc, the close button, and a
 * click outside close it (Radix). On phones it is a bottom sheet.
 */
export function CollegeProfileDialog({ statements }: { statements: CollegeStatement[] }) {
  const jumpTo = (statement: CollegeStatement) => {
    const heading = document.getElementById(`${sectionId(statement)}-heading`);
    if (!heading) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    heading.closest("section")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  };

  return (
    <Dialog>
      <DialogTrigger className="group flex min-h-14 w-full items-center gap-3 rounded-control border border-primary-300 px-4 py-2 text-left font-sans text-white transition-colors duration-150 hover:border-white hover:bg-primary-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-400 text-primary-900">
          <Landmark className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-body-lg font-semibold">Institutional profile</span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-primary-200 transition-colors duration-150 group-hover:text-white" />
      </DialogTrigger>
      <DialogContent title={collegeProfile.name} description="Institutional profile" className="h-[85dvh] sm:h-[min(48rem,88dvh)] sm:max-w-3xl">
        <div className="@container flex flex-col">
          {/* Stays at the top while the body scrolls; -top-4 undoes the body's padding, which sticky offsets count from. */}
          <nav aria-label="Sections" className="sticky -top-4 z-10 -mx-5 -mt-4 border-b border-line bg-surface px-5 py-2">
            <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
              {statements.map((statement) => {
                const Icon = ICONS[statement.id];
                return (
                  <li key={statement.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => jumpTo(statement)}
                      className="inline-flex min-h-touch items-center gap-2 rounded-control px-3 font-sans text-body font-medium text-muted transition-colors duration-150 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {statement.heading}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-col divide-y divide-line">
            {statements.map((statement) => {
              const Icon = ICONS[statement.id];
              const id = sectionId(statement);
              return (
                <section key={statement.id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-16 flex-col gap-4 py-6 last:pb-2">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-primary-100 text-primary-700">
                      <Icon className="size-5" />
                    </span>
                    <h3 id={`${id}-heading`} tabIndex={-1} className="text-section font-semibold tracking-tight text-primary-800 focus:outline-none">
                      {statement.heading}
                    </h3>
                  </div>
                  <StatementBody statement={statement} />
                </section>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatementBody({ statement }: { statement: CollegeStatement }) {
  if (statement.id === "core-values") return <CoreValueList />;
  return (
    <>
      {statement.title && (
        <p className="text-page-mobile leading-tight font-semibold tracking-tight text-ink @md:text-page">{statement.title}</p>
      )}
      {statement.paragraphs && (
        <div className="flex max-w-prose flex-col gap-4">
          {statement.paragraphs.map((paragraph) => (
            // A single paragraph (the vision) reads as one statement, so it is set larger.
            <p key={paragraph} className={statement.paragraphs?.length === 1 ? "text-section leading-relaxed text-ink" : "text-body-lg leading-relaxed text-ink"}>
              {paragraph}
            </p>
          ))}
        </div>
      )}
      {statement.lists?.map((list, index) => (
        <section key={list.heading} aria-labelledby={`${statement.id}-list-${index}`} className="flex max-w-prose flex-col gap-3">
          <h4 id={`${statement.id}-list-${index}`} className="text-card-title font-semibold text-primary-800">{list.heading}</h4>
          <ol className="flex list-decimal flex-col gap-2 pl-6 text-body-lg leading-relaxed text-ink marker:font-semibold marker:text-primary-700">
            {list.items.map((item) => (
              <li key={item} className="pl-1">{item}</li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
