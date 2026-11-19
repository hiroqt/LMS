import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { chosenLevels, criterionMax, rubricTotal, type Rubric } from "../../api/rubrics";
import { axeViolations } from "../../../test/axe";
import { RubricView } from "./RubricView";

const rubric: Rubric = {
  id: 3, title: "Lab report", totalPoints: 15, locked: false, usedBy: 1,
  criteria: [
    { id: 7, title: "Analysis", description: "How well the data is explained.", levels: [{ id: 21, title: "Complete", description: null, points: 10 }, { id: 22, title: "Partial", description: "Some gaps.", points: 5 }, { id: 23, title: "Missing", description: null, points: 0 }] },
    { id: 8, title: "Presentation", description: null, levels: [{ id: 24, title: "Clear", description: null, points: 5 }, { id: 25, title: "Unclear", description: null, points: 1 }] },
  ],
};

describe("rubric sums", () => {
  it("adds the chosen levels and knows when a criterion has none", () => {
    expect(rubric.criteria.map(criterionMax)).toEqual([10, 5]);
    expect(rubricTotal(rubric, {})).toEqual({ points: 0, complete: false });
    expect(rubricTotal(rubric, { 7: 22 })).toEqual({ points: 5, complete: false });
    expect(rubricTotal(rubric, { 7: 22, 8: 24 })).toEqual({ points: 10, complete: true });
    // A level of another criterion is not a choice.
    expect(rubricTotal(rubric, { 7: 24, 8: 24 })).toEqual({ points: 5, complete: false });
    expect(chosenLevels([{ criterionId: 7, levelId: 21, points: 10 }])).toEqual({ 7: 21 });
    expect(chosenLevels(undefined)).toEqual({});
  });
});

describe("RubricView", () => {
  it("shows each criterion with its levels and what the rubric is worth", async () => {
    render(<RubricView rubric={rubric} />);
    const analysis = screen.getByRole("group", { name: /Analysis · up to 10 points/ });
    expect(within(analysis).getByText("How well the data is explained.")).toBeVisible();
    expect(within(analysis).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Complete10 points", "Partial5 pointsSome gaps.", "Missing0 points"]);
    expect(screen.getByRole("group", { name: /Presentation · up to 5 points/ })).toBeVisible();
    expect(screen.getByText("15 points in all")).toBeVisible();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(await axeViolations()).toEqual([]);
  });

  it("says which level was chosen in words, and the points earned", () => {
    render(<RubricView rubric={rubric} chosen={{ 7: 22, 8: 25 }} />);
    expect(screen.getByText("5 points · Chosen")).toBeVisible();
    expect(screen.getByText("1 point · Chosen")).toBeVisible();
    expect(screen.getByText("6 of 15 points")).toBeVisible();
  });

  it("lets a grader choose a level for each criterion, and shows a criterion's error", async () => {
    const onChoose = vi.fn();
    render(<RubricView rubric={rubric} chosen={{ 7: 21 }} onChoose={onChoose} errors={{ 8: "Choose a level for Presentation." }} />);
    const analysis = screen.getByRole("group", { name: /Analysis/ });
    expect(within(analysis).getByRole("radio", { name: /Complete/ })).toBeChecked();
    expect(within(analysis).getByRole("radio", { name: /Partial/ })).not.toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Unclear/ }));
    expect(onChoose).toHaveBeenCalledWith(8, 25);
    expect(screen.getByRole("group", { name: /Presentation/ })).toHaveAccessibleDescription("Choose a level for Presentation.");
    expect(screen.getByText("10 of 15 points so far")).toBeVisible();
    expect(await axeViolations()).toEqual([]);
  });

  it("can't be changed while disabled", () => {
    render(<RubricView rubric={rubric} onChoose={() => {}} disabled />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});
