import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../../test/axe";
import { handInRules, type HandInSettings } from "../../lib/assignmentRules";
import { formatDue } from "../../lib/format";
import { AssignmentBrief } from "./AssignmentBrief";

const settings: HandInSettings = {
  submissionKinds: ["text", "file"], allowedFileTypes: ["pdf"], maxFiles: 2, honorStatement: true,
  dueAt: null, allowLate: false, closeAt: null, allowResubmission: true, gradeRelease: "returned", latePenaltyPercentPerDay: 0, latePenaltyMaxPercent: 100,
};

describe("AssignmentBrief", () => {
  it("shows the instructions and exactly the rules the builder shows", async () => {
    render(<AssignmentBrief instructions={"Draw the diagram.\nLabel each key."} settings={settings} />);
    expect(screen.getByRole("region", { name: "Instructions" })).toHaveTextContent("Draw the diagram. Label each key.");
    const rules = within(screen.getByRole("region", { name: "How to hand in" })).getAllByRole("listitem").map((item) => item.textContent);
    expect(rules).toEqual(handInRules(settings));
    expect(rules).toContain("You confirm that the work is your own when you turn it in.");
    expect(await axeViolations()).toEqual([]);
  });

  it("states the student's own due date as theirs, never the class's", () => {
    const own = { ...settings, dueAt: "2026-11-06T15:59:00Z", allowLate: true };
    const { rerender } = render(<AssignmentBrief instructions="x" settings={own} ownDueDate />);
    const rules = () => within(screen.getByRole("region", { name: "How to hand in" })).getAllByRole("listitem").map((item) => item.textContent);
    expect(rules()).toContain(`Your due date: ${formatDue(own.dueAt)} (your instructor gave you more time).`);
    expect(rules()).not.toContain(`Due ${formatDue(own.dueAt)}.`);
    rerender(<AssignmentBrief instructions="x" settings={own} />);
    expect(rules()).toContain(`Due ${formatDue(own.dueAt)}.`);
  });

  it("shows the rubric read-only, and its loading and error states; nothing without one", async () => {
    const rubric = { totalPoints: 15, criteria: [{ id: 7, title: "Analysis", description: null, levels: [{ id: 21, title: "Complete", description: null, points: 10 }, { id: 22, title: "Partial", description: null, points: 5 }] }, { id: 8, title: "Presentation", description: null, levels: [{ id: 24, title: "Clear", description: null, points: 5 }] }] };
    const { rerender } = render(<AssignmentBrief instructions="x" settings={settings} />);
    expect(screen.queryByRole("region", { name: "Rubric" })).toBeNull();

    rerender(<AssignmentBrief instructions="x" settings={settings} rubric={{ rubric }} />);
    const section = screen.getByRole("region", { name: "Rubric" });
    expect(within(section).getByRole("group", { name: /Analysis · up to 10 points/ })).toBeVisible();
    expect(within(section).getByText("15 points in all")).toBeVisible();
    expect(within(section).queryByRole("radio")).toBeNull();
    expect(await axeViolations()).toEqual([]);

    rerender(<AssignmentBrief instructions="x" settings={settings} rubric={{ loading: true }} />);
    expect(screen.getByRole("region", { name: "Rubric" })).toBeVisible();

    const onRetry = vi.fn();
    rerender(<AssignmentBrief instructions="x" settings={settings} rubric={{ error: "Try again in a moment.", onRetry }} />);
    expect(screen.getByText("The rubric could not be loaded. Try again in a moment.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("says so when there are no instructions", () => {
    render(<AssignmentBrief instructions="  " settings={settings} />);
    expect(screen.getByText("Your instructor did not add instructions.")).toBeVisible();
  });
});
