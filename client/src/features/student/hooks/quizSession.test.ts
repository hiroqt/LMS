import { describe, expect, it } from "vitest";
import { expire, goTo, secondsLeft, startClock } from "./quizSession";

const T0 = 1_000_000;

describe("quiz clock", () => {
  it("counts down only the question on screen", () => {
    let clock = startClock(3, T0);
    expect(secondsLeft(clock, T0)).toBe(60);
    expect(secondsLeft(clock, T0 + 15_000)).toBe(45);

    clock = goTo(clock, 1, T0 + 15_000); // Q1 paused at 45s
    expect(secondsLeft(clock, T0 + 25_000)).toBe(50);

    clock = goTo(clock, 0, T0 + 25_000); // back to Q1: still 45s
    expect(secondsLeft(clock, T0 + 25_000)).toBe(45);
  });

  it("is correct after a long gap, e.g. a sleeping phone", () => {
    const clock = startClock(2, T0);
    expect(secondsLeft(clock, T0 + 5 * 60_000)).toBe(0);
  });

  it("advances on expiry, and submits on the last question", () => {
    const first = expire(startClock(2, T0), T0 + 60_000);
    expect(first.submit).toBe(false);
    expect(first.clock.index).toBe(1);
    expect(secondsLeft(first.clock, T0 + 60_000)).toBe(60);

    const last = expire(first.clock, T0 + 120_000);
    expect(last.submit).toBe(true);
  });

  it("returning to an expired question expires again at once, like the classic quiz", () => {
    let clock = expire(startClock(3, T0), T0 + 60_000).clock; // on Q2
    clock = goTo(clock, 0, T0 + 61_000); // back to the expired Q1
    expect(secondsLeft(clock, T0 + 61_000)).toBe(0);
    expect(expire(clock, T0 + 61_000).clock.index).toBe(1);
  });
});
