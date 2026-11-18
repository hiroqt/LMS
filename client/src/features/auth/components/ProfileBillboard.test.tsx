import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import { collegeProfile } from "../data/collegeProfile";
import { ProfileBillboard } from "./ProfileBillboard";

/** The one slide screen readers can reach: inactive slides are aria-hidden and inert. */
const currentSlide = () => screen.getByRole("group", { name: / of 5$/ });
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** Moves the pointer and focus off the billboard, so only the Pause button can hold it. */
async function leave(user: ReturnType<typeof userEvent.setup>) {
  await user.hover(document.body);
  act(() => (document.activeElement as HTMLElement).blur());
}

function setup() {
  render(<ProfileBillboard statements={collegeProfile.statements} />);
  // Testing Library waits on a real setTimeout after each action, so the fake clock also runs
  // in real time (shouldAdvanceTime) and user-event advances it during its own pauses.
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ProfileBillboard", () => {
  it("starts on the vision and turns to the next slide on its own, after at least 5 s", async () => {
    setup();
    expect(currentSlide()).toHaveAccessibleName("Vision, 1 of 5");
    expect(screen.getAllByRole("group", { name: / of 5$/ })).toHaveLength(1);
    await wait(4900);
    expect(currentSlide()).toHaveAccessibleName("Vision, 1 of 5");
    await wait(16000 - 4900);
    expect(currentSlide()).toHaveAccessibleName("Mission, 2 of 5");
    expect(screen.getByRole("button", { name: "Show Mission" })).toHaveAttribute("aria-current", "true");
  });

  it("gives the long mission more time than the short core values", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Show Mission" }));
    await leave(user);
    await wait(12000);
    expect(currentSlide()).toHaveAccessibleName("Mission, 2 of 5");

    await user.click(screen.getByRole("button", { name: "Show Core Values" }));
    await leave(user);
    await wait(5500);
    expect(currentSlide()).toHaveAccessibleName("Vision, 1 of 5");
  });

  it("holds the slide while the pointer is over it", async () => {
    const user = setup();
    const billboard = screen.getByRole("region", { name: "College highlights" });
    await user.hover(billboard);
    await wait(60000);
    expect(currentSlide()).toHaveAccessibleName("Vision, 1 of 5");
    await user.unhover(billboard);
    await wait(16000);
    expect(currentSlide()).toHaveAccessibleName("Mission, 2 of 5");
  });

  it("has no Pause or Play button", () => {
    setup();
    expect(screen.queryByRole("button", { name: /rotating slides/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Show Vision",
      "Show Mission",
      "Show Goal",
      "Show Philosophy",
      "Show Core Values",
      "Previous slide",
      "Next slide",
    ]);
  });

  it("changes slides at once with the arrows and the slide buttons, wrapping at the ends", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Next slide" }));
    expect(currentSlide()).toHaveAccessibleName("Mission, 2 of 5");
    await user.click(screen.getByRole("button", { name: "Previous slide" }));
    await user.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(currentSlide()).toHaveAccessibleName("Core Values, 5 of 5");
    await user.click(screen.getByRole("button", { name: "Show Goal" }));
    expect(currentSlide()).toHaveAccessibleName("Goal, 3 of 5");
    // Focus is inside, so rotation waits and the change is announced.
    expect(currentSlide().parentElement).toHaveAttribute("aria-live", "polite");
    await wait(60000);
    expect(currentSlide()).toHaveAccessibleName("Goal, 3 of 5");
  });

  it("shows the college's exact words", async () => {
    const user = setup();
    expect(currentSlide()).toHaveTextContent(
      "To be a premier institution of sustainable higher learning, producing globally competitive, God-loving, empowered, and holistic citizens who enrich society through their knowledge, skills, and values.",
    );
    await user.click(screen.getByRole("button", { name: "Show Mission" }));
    expect(currentSlide().querySelectorAll("p")).toHaveLength(3);
    expect(currentSlide()).toHaveTextContent(/who embody truth, excellence, competence, and community-service\.$/);
    await user.click(screen.getByRole("button", { name: "Show Goal" }));
    expect(currentSlide()).toHaveTextContent(/^GoalInclusive high-quality educationGeneral Objectives/);
    expect(within(currentSlide()).getAllByRole("listitem")).toHaveLength(2);
    expect(currentSlide()).not.toHaveTextContent("Specific Objectives");
    await user.click(screen.getByRole("button", { name: "Show Philosophy" }));
    expect(currentSlide()).toHaveAccessibleName("Philosophy, 4 of 5");
    expect(currentSlide().querySelectorAll("p")).toHaveLength(2);
    expect(currentSlide()).toHaveTextContent(
      /^PhilosophyThe Trece Martires City College is based on the philosophy that education should be accessible to all individuals regardless of background, abilities or socioeconomic status\./,
    );
    expect(currentSlide()).toHaveTextContent(/become active and engaged citizens who can contribute positively to society\.$/);
    await user.click(screen.getByRole("button", { name: "Show Core Values" }));
    expect(within(screen.getByRole("list", { name: "Core Values" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "TTruth and Integrity",
      "MModel of Excellence",
      "CCompetence and Commitment",
      "CCommunity-Service",
    ]);
    vi.useRealTimers();
    expect(await axeViolations()).toEqual([]);
  });

  it("does not rotate on its own when the person prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }));
    setup();
    await wait(60000);
    expect(currentSlide()).toHaveAccessibleName("Vision, 1 of 5");
  });
});
