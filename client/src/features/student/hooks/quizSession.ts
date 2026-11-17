/**
 * Per-question quiz timers (the classic rules): every question has its own
 * 60 seconds, or its own time limit when the instructor set one; only the question on screen counts down; leaving a question
 * pauses its timer; when the current question's time runs out the quiz moves
 * to the next question, and on the last question it submits.
 *
 * Time is derived from timestamps, not from counting interval ticks, so a
 * throttled background tab or a sleeping phone cannot slow the clock (L-011).
 */
export const SECONDS_PER_QUESTION = 60;

export interface QuizClock {
  index: number;
  /** Milliseconds left per question, as of `since` for the current one. */
  remaining: number[];
  since: number;
}

/** Each question's seconds: its own time limit when the instructor set one, otherwise the default. */
export function questionSeconds(limits: Array<number | null | undefined>): number[] {
  return limits.map((limit) => (limit && limit > 0 ? limit : SECONDS_PER_QUESTION));
}

/** A clock for `questions` questions of the default length, or for the given seconds per question. */
export function startClock(questions: number | number[], now: number): QuizClock {
  const seconds = typeof questions === "number" ? Array<number>(questions).fill(SECONDS_PER_QUESTION) : questions;
  return { index: 0, remaining: seconds.map((value) => value * 1000), since: now };
}

export function msLeft(clock: QuizClock, now: number): number {
  return Math.max((clock.remaining[clock.index] ?? 0) - (now - clock.since), 0);
}

export function secondsLeft(clock: QuizClock, now: number): number {
  return Math.ceil(msLeft(clock, now) / 1000);
}

/** Pauses the current question's timer and shows another question. */
export function goTo(clock: QuizClock, index: number, now: number): QuizClock {
  const remaining = [...clock.remaining];
  remaining[clock.index] = msLeft(clock, now);
  return { index: Math.min(Math.max(index, 0), remaining.length - 1), remaining, since: now };
}

export type Expiry = { clock: QuizClock; submit: false } | { clock: QuizClock; submit: true };

/** What happens when the current question's time is up. */
export function expire(clock: QuizClock, now: number): Expiry {
  const last = clock.index >= clock.remaining.length - 1;
  return last ? { clock: goTo(clock, clock.index, now), submit: true } : { clock: goTo(clock, clock.index + 1, now), submit: false };
}
