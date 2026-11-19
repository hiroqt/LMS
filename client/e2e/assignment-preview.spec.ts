import { expect, openRole, test } from "./fixtures";
import { seedAssignment } from "./assignmentFixtures";

// "Preview as student" (D-058): the instructor reads the assignment as the student's page words it.
test("an assignment's preview shows the instructions and the rules students will read", async ({ page, sandbox }) => {
  const { courseworkId, title } = await seedAssignment(page, sandbox, {
    title: "Preview me",
    settings: { status: "draft", submissionKinds: ["file", "link"], allowedFileTypes: ["pdf", "image"], maxFiles: 2, honorStatement: true, allowResubmission: true, gradeRelease: "returned" },
  });
  await openRole(page, "instructor");
  await page.goto(`/instructor/classes/biology/assignments/${courseworkId}/preview`);
  await expect(page.getByRole("heading", { level: 1, name: "Preview as student" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  await expect(page.getByText("Draw the diagram for the enrollment system.")).toBeVisible();
  await expect(page.getByText("You can hand in a link and up to 2 files.")).toBeVisible();
  await expect(page.getByText("Files: PDF, Photos (JPEG, PNG), up to 25 MB each.")).toBeVisible();
  await expect(page.getByText("You see your grade when your instructor returns your work.")).toBeVisible();
  await expect(page.getByText("You confirm that the work is your own when you turn it in.")).toBeVisible();
  await expect(page.getByRole("note")).toContainText("once you publish it");

  // Back goes to the builder for the same assignment.
  await page.getByRole("button", { name: "Back to the assignment" }).click();
  await expect(page).toHaveURL(new RegExp(`/assignments/${courseworkId}/edit`));
  await expect(page.getByRole("heading", { level: 1, name: "Preview as student" })).toHaveCount(0);
});

test("the preview of an assignment that isn't in the class goes back to Classwork", async ({ page }) => {
  await openRole(page, "instructor");
  await page.goto("/instructor/classes/biology/assignments/99999/preview");
  await expect(page.getByRole("tab", { name: /^Classwork/ })).toHaveAttribute("aria-selected", "true");
});
