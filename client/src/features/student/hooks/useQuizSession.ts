import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { expire, goTo, msLeft, secondsLeft, startClock, type QuizClock } from "./quizSession";

/**
 * Drives the quiz timers. `onTimeUp` is called once when the last question's
 * time runs out; earlier expiries advance to the next question by themselves.
 */
export function useQuizSession(questionSeconds: number[], onTimeUp: () => void) {
  const [clock, setClock] = useState<QuizClock>(() => startClock(questionSeconds, Date.now()));
  const [now, setNow] = useState(Date.now);
  const submitted = useRef(false);
  const timeUp = useRef(onTimeUp);
  useLayoutEffect(() => {
    timeUp.current = onTimeUp;
  });

  // Re-render often enough for a smooth countdown; correctness comes from timestamps.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (submitted.current || msLeft(clock, now) > 0) return;
    const next = expire(clock, now);
    if (next.submit) {
      submitted.current = true;
      timeUp.current();
    } else {
      // oxlint-disable-next-line react/set-state-in-effect -- advancing on expiry is the point of this effect
      setClock(next.clock);
    }
  }, [clock, now]);

  const goToQuestion = useCallback((index: number) => setClock((current) => goTo(current, index, Date.now())), []);

  return { index: clock.index, seconds: secondsLeft(clock, now), goToQuestion };
}
