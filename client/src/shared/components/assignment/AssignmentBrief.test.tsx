import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axeViolations } from "../../../test/axe";
import { handInRules, type HandInSettings } from "../../lib/assignmentRules";
import { AssignmentBrief } from "./AssignmentBrief";

const settings: HandInSettings = {
  submissionKinds: ["text", "file"], allowedFileTypes: ["pdf"], maxFiles: 2, honorStatement: true,
  dueAt: null, allowLate: false, closeAt: null, allowResubmission: true, gradeRelease: "returned",
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

  it("says so when there are no instructions", () => {
    render(<AssignmentBrief instructions="  " settings={settings} />);
    expect(screen.getByText("Your instructor did not add instructions.")).toBeVisible();
  });
});
