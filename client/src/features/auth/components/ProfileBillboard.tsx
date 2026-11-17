import { ChevronLeft, ChevronRight, Compass, HeartHandshake, Lightbulb, Target, Telescope, type LucideIcon } from "lucide-react";
import { useMemo, useState, type FocusEvent, type ReactNode } from "react";
import { cn } from "../../../shared/lib/cn";
import { collegeProfile, type CollegeStatement } from "../data/collegeProfile";
import { useRotation } from "../hooks/useRotation";
import { CoreValueList } from "./CoreValueList";

interface Slide {
  id: string;
  heading: string;
  icon: LucideIcon;
  /** The words a reader has to get through; sets how long the slide stays up. */
  words: number;
  body: ReactNode;
}

const ICONS: Partial<Record<CollegeStatement["id"], LucideIcon>> = { vision: Telescope, mission: Compass, goal: Target, philosophy: Lightbulb };

const countWords = (...texts: (string | undefined)[]) => texts.join(" ").split(/\s+/).filter(Boolean).length;

/** About 4 s to find the place plus 150 ms a word, kept between 5 s and 16 s. */
const slideDuration = (words: number) => Math.min(16000, Math.max(5000, 4000 + words * 150));

/** Vision, Mission, Goal, and Philosophy from the college's statements (exact wording, D-048), then Core Values. */
function buildSlides(statements: CollegeStatement[]): Slide[] {
  const slides: Slide[] = [];
  for (const statement of statements) {
    const icon = ICONS[statement.id];
    if (!icon) continue;
    // The goal shows its name and the General Objectives; the rest is in the profile dialog.
    const lists = statement.lists?.slice(0, 1) ?? [];
    slides.push({
      id: statement.id,
      heading: statement.heading,
      icon,
      words: countWords(statement.title, ...(statement.paragraphs ?? []), ...lists.flatMap((list) => list.items)),
      body: (
        // Each block caps its own line length (max-w-prose counts its own font's characters, C-017),
        // so the large vision still spans the billboard while long paragraphs stay readable.
        <div className="flex flex-col gap-4">
          {statement.title && <p className="text-page-mobile leading-tight font-semibold tracking-tight @md:text-page @3xl:text-display">{statement.title}</p>}
          {statement.paragraphs?.map((paragraph) => (
            <p
              key={paragraph}
              className={
                statement.paragraphs?.length === 1
                  ? "max-w-prose text-section leading-relaxed font-medium @6xl:text-page @6xl:leading-snug"
                  : "max-w-prose text-body-lg leading-relaxed text-primary-50 @5xl:text-section @5xl:leading-relaxed"
              }
            >
              {paragraph}
            </p>
          ))}
          {lists.map((list) => (
            <div key={list.heading} className="flex flex-col gap-2">
              <p className="text-body-lg font-semibold text-primary-200 @5xl:text-section">{list.heading}</p>
              <ol className="flex max-w-prose list-decimal flex-col gap-2 pl-6 text-body-lg leading-relaxed text-primary-50 marker:font-semibold marker:text-accent-400 @5xl:text-section @5xl:leading-relaxed">
                {list.items.map((item) => (
                  <li key={item} className="pl-1">{item}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ),
    });
  }
  slides.push({
    id: "core-values",
    heading: "Core Values",
    icon: HeartHandshake,
    words: countWords(...collegeProfile.coreValues),
    body: <CoreValueList onDark labelledBy="billboard-core-values" />,
  });
  return slides;
}

const prefersReducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * The college's statements as a rotating billboard on the green panel (D-051, D-052, D-053), following
 * the WAI-ARIA carousel pattern but without a Pause button, which the college asked to remove.
 * Each slide stays up for a time based on its length. Rotation pauses while the pointer is over
 * the billboard or focus is inside it (tapping a slide button holds it on phones), and never
 * starts for people who prefer reduced motion. The slide buttons and the arrows change slides at
 * once. Slides cross-fade with a 150 ms opacity change (C-019).
 */
export function ProfileBillboard({ statements }: { statements: CollegeStatement[] }) {
  const slides = useMemo(() => buildSlides(statements), [statements]);
  const durations = useMemo(() => slides.map((slide) => slideDuration(slide.words)), [slides]);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = reducedMotion || hovered || focused;
  const { index, show, progressRef } = useRotation(durations, paused);

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="College highlights"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
      className="@container flex flex-1 flex-col overflow-hidden rounded-card bg-primary-900"
    >
      <div className="flex flex-wrap gap-1 border-b border-primary-700 px-3 pt-2">
        {slides.map((slide, slideIndex) => {
          const Icon = slide.icon;
          const current = slideIndex === index;
          return (
            <button
              key={slide.id}
              type="button"
              aria-current={current || undefined}
              aria-label={`Show ${slide.heading}`}
              onClick={() => show(slideIndex)}
              className={cn(
                "-mb-px inline-flex min-h-touch items-center gap-2 border-b-2 px-3 font-sans text-body font-medium transition-colors duration-150 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-white",
                current ? "border-accent-400 text-white" : "border-transparent text-primary-200 hover:text-white",
              )}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              {slide.heading}
            </button>
          );
        })}
      </div>

      {/* Announces the new slide only when the person changed it, not on every automatic turn. */}
      <div aria-live={paused ? "polite" : "off"} className="grid flex-1 px-5 py-6 @md:px-8 @md:py-8 @3xl:px-12">
        {slides.map((slide, slideIndex) => {
          const Icon = slide.icon;
          const current = slideIndex === index;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slide.heading}, ${slideIndex + 1} of ${slides.length}`}
              aria-hidden={!current}
              inert={!current}
              // From the billboard's @md width the slides share one cell, so its height never
              // changes. Narrower, only the current slide is laid out: on a phone the mission
              // is so long that sharing its height would leave the short slides mostly empty.
              className={cn(
                "col-start-1 row-start-1 flex-col justify-center gap-5 transition-opacity duration-150 motion-reduce:transition-none",
                current ? "flex opacity-100" : "hidden @md:invisible @md:flex @md:opacity-0",
              )}
            >
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-400 text-primary-900 @3xl:size-12">
                  <Icon className="size-5 @3xl:size-6" />
                </span>
                <h3 id={slide.id === "core-values" ? "billboard-core-values" : undefined} className="text-section font-semibold tracking-tight @3xl:text-page">
                  {slide.heading}
                </h3>
              </div>
              {slide.body}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 px-3 pb-2">
        <button
          type="button"
          onClick={() => show(index - 1)}
          aria-label="Previous slide"
          title="Previous"
          className="grid size-touch place-items-center rounded-control text-primary-100 transition-colors duration-150 hover:bg-primary-800 hover:text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-white"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => show(index + 1)}
          aria-label="Next slide"
          title="Next"
          className="grid size-touch place-items-center rounded-control text-primary-100 transition-colors duration-150 hover:bg-primary-800 hover:text-white focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-white"
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
        <p className="ml-auto pr-2 text-body text-primary-200">
          {index + 1} of {slides.length}
          {paused && <span className="sr-only">, paused</span>}
        </p>
      </div>

      {/* Time left on this slide. Decorative: the slide number carries the position. */}
      <div aria-hidden className="h-1 bg-primary-700">
        <div
          ref={(element) => {
            progressRef.current = element;
          }}
          className={cn("h-full origin-left bg-accent-400 transition-transform duration-100 ease-linear motion-reduce:transition-none", paused && "bg-primary-300")}
          style={{ transform: "scaleX(0)" }}
        />
      </div>
    </section>
  );
}
