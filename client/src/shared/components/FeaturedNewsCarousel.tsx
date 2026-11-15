import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLongDay } from "../lib/format";
import type { FeaturedSlide } from "../lib/schoolNews";
import { Button } from "../ui/Button";

/**
 * Featured school announcements. Auto-advances every 6s unless the person
 * prefers reduced motion, and pauses while hovered or focused.
 */
export function FeaturedNewsCarousel({ slides, onViewCalendar }: { slides: FeaturedSlide[]; onViewCalendar: () => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    if (reduceMotion || paused || slides.length < 2) return undefined;
    const id = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, slides.length]);

  const slide = slides[index % Math.max(slides.length, 1)];
  if (!slide) return null;
  const position = (index % slides.length) + 1;
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured school announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setPaused(false)}
      className="overflow-hidden rounded-card bg-primary-900 font-sans text-white shadow-card"
    >
      <div
        aria-roledescription="slide"
        aria-label={`${position} of ${slides.length}`}
        className="flex min-h-56 flex-col justify-end gap-2 bg-cover bg-center p-5 sm:p-7"
        style={{ backgroundImage: `linear-gradient(90deg, rgb(27 70 61 / 0.96), rgb(27 70 61 / 0.82) 55%, rgb(27 70 61 / 0.3)), url("${slide.image}")` }}
      >
        <p className="m-0 text-label font-semibold tracking-wide text-primary-100 uppercase">Featured · {slide.category}</p>
        <h3 className="m-0 text-section font-bold">{slide.title}</h3>
        <p className="m-0 text-body text-primary-100">{formatLongDay(new Date(`${slide.date}T00:00:00`))}</p>
        <p className="m-0 max-w-prose text-body">{slide.summary}</p>
        <Button variant="secondary" className="mt-2 self-start" onClick={onViewCalendar}>View calendar<ArrowRight aria-hidden className="size-4" /></Button>
      </div>
      <div className="flex items-center gap-1 bg-primary-800 px-3 py-1">
        <button type="button" aria-label="Previous announcement" onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)} className="grid size-touch place-items-center rounded-control border-0 bg-transparent text-white hover:bg-primary-700 focus-visible:outline-3 focus-visible:outline-white"><ChevronLeft aria-hidden className="size-5" /></button>
        <span className="text-body">{position} / {slides.length}</span>
        <button type="button" aria-label="Next announcement" onClick={() => setIndex((current) => (current + 1) % slides.length)} className="grid size-touch place-items-center rounded-control border-0 bg-transparent text-white hover:bg-primary-700 focus-visible:outline-3 focus-visible:outline-white"><ChevronRight aria-hidden className="size-5" /></button>
      </div>
    </section>
  );
}
