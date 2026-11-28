import { demoAssessment, demoMaterial, expect, test, type Page } from "./fixtures";

// Class and private comments on materials and coursework (D-073).

async function post(page: Page, label: string, text: string) {
  const form = page.getByRole("form", { name: label });
  await form.getByRole("textbox", { name: label }).fill(text);
  await form.getByRole("button", { name: "Post" }).click();
}

test.describe("Discussion on a material and an assessment", () => {
  test("a student comments in class and privately; the instructor reads both and replies privately", async ({ page }) => {
    await page.goto(`/student/materials/${demoMaterial("biology-material-0")}`);
    await expect(page.getByRole("heading", { name: "File", exact: true })).toBeVisible({ timeout: 15_000 });

    await post(page, "Add a class comment", "Is the pseudocode section on the quiz?");
    await expect(page.getByRole("list", { name: "Class comments" })).toContainText("Is the pseudocode section on the quiz?");
    await post(page, "Add a private comment", "I was absent on Monday.");
    await expect(page.getByRole("list", { name: "Private comments" })).toContainText("I was absent on Monday.");

    await page.goto("/instructor/classes/biology?tab=Materials");
    await page.getByRole("button", { name: "Comments on Programming Logic and Pseudocode" }).click();
    const dialog = page.getByRole("dialog", { name: "Comments on Programming Logic and Pseudocode" });
    await expect(dialog.getByRole("list", { name: "Class comments" })).toContainText("Is the pseudocode section on the quiz?");
    await dialog.getByRole("tab", { name: "Private comments" }).click();
    await expect(dialog.getByRole("list", { name: /^Private comments with / })).toContainText("I was absent on Monday.");
    await post(page, "Reply privately to Alex Rivera", "Noted. Review slides 1 to 6.");
    await expect(dialog.getByRole("list", { name: "Private comments with Alex Rivera" })).toContainText("Noted. Review slides 1 to 6.");

    await page.goto(`/student/materials/${demoMaterial("biology-material-0")}`);
    const mine = page.getByRole("list", { name: "Private comments" });
    await expect(mine).toContainText("Noted. Review slides 1 to 6.");
    await expect(mine.getByText("Instructor")).toBeVisible();
  });

  test("an assessment has class comments and private comments under its details @all", async ({ page }) => {
    await page.goto(`/student/assessments/${demoAssessment("biology-0")}`);
    await expect(page.getByRole("heading", { name: "Assessment details" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Class comments" })).toBeVisible();
    await expect(page.getByText("Only you and your instructor can see these.")).toBeVisible();

    await post(page, "Add a private comment", "Can I have one more attempt?");
    await expect(page.getByRole("list", { name: "Private comments" })).toContainText("Can I have one more attempt?");
    await page.getByRole("button", { name: /^Delete comment by you/ }).click();
    await page.getByRole("dialog", { name: "Delete this comment?" }).getByRole("button", { name: "Delete comment" }).click();
    await expect(page.getByText("No private comments yet.")).toBeVisible();
  });
});
