import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axeViolations } from "../../../../test/axe";
import { GradeSummary, type GradeSummaryProps } from "./GradeSummary";

const rubric = {
  totalPoints: 15,
  criteria: [
    { id: 7, title: "Analysis", description: null, levels: [{ id: 21, title: "Complete", description: null, points: 10 }, { id: 22, title: "Partial", description: null, points: 5 }] },
    { id: 8, title: "Presentation", description: null, levels: [{ id: 24, title: "Clear", description: null, points: 5 }, { id: 25, title: "Unclear", description: null, points: 2 }] },
  ],
};
const graded: GradeSummaryProps["work"] = { status: "graded", score: 8, rawScore: 10, maxPoints: 15, daysLate: 2, penaltyPercent: 20, penaltyWaived: false, rubricScores: [{ criterionId: 7, levelId: 22, points: 5 }, { criterionId: 8, levelId: 24, points: 5 }] };

describe("GradeSummary", () => {
  it("shows the sum of a late grade and the level chosen for each criterion", async () => {
    render(<GradeSummary work={graded} rubric={rubric} />);
    const grade = screen.getByRole("region", { name: "Your grade" });
    expect(grade).toHaveTextContent("Points given:10 of 15 points");
    expect(grade).toHaveTextContent("Late penalty:20% off, 2 days late");
    expect(grade).toHaveTextContent("Your score:8 of 15 points");
    expect(grade).toHaveTextContent("The work was 2 days late, so 20% came off: 10 − 2 = 8.");
    const levels = within(grade).getByRole("region", { name: "Rubric" });
    expect(within(levels).getAllByText(/· Chosen$/).map((item) => item.textContent)).toEqual(["5 points · Chosen", "5 points · Chosen"]);
    expect(within(levels).getByText("10 of 15 points")).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });

  it("says when the late penalty was waived", () => {
    render(<GradeSummary work={{ ...graded, score: 10, penaltyPercent: 0, penaltyWaived: true, rubricScores: [] }} rubric={rubric} />);
    expect(screen.getByText("Late penalty waived. The work was 2 days late, and nothing came off.")).toBeVisible();
    expect(screen.queryByText(/Points given/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Rubric" })).toBeNull();
  });

  it("shows nothing for a held grade", () => {
    const { container } = render(<GradeSummary work={{ ...graded, status: "submitted", score: null, rawScore: null, rubricScores: [] }} rubric={rubric} />);
    expect(container).toBeEmptyDOMElement();
  });
});
