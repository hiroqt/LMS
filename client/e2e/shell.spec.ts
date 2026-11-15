import { expect, openRole, test, type Page } from "./fixtures";

// Workspace-shell journeys (top bar, menus, summaries) that Phase 1's new
// AppShell must preserve. Written against the pre-revamp UI.

const QUIZ = /Quiz 02: Relational Data and Keys/;

async function submitQuiz(page: Page) {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Tasks" }).click();
  await page.getByRole("button", { name: QUIZ }).click();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.getByRole("dialog", { name: "Submit this assessment?" }).getByRole("button", { name: /Submit now/ }).click();
  await expect(page.getByText("ASSESSMENT SUBMITTED")).toBeVisible();
}

test.describe("Student · shell", () => {
  test("NO: a notification opens the assessment it is about", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("banner").getByRole("button", { name: "Notifications" }).click();
    await page.getByRole("banner").getByRole("button", { name: QUIZ }).click();
    await expect(page.getByRole("heading", { level: 1, name: QUIZ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start assessment" })).toBeVisible();
  });

  test("S1: search opens an assessment and a material", async ({ page }) => {
    await openRole(page, "student");
    const search = page.getByRole("textbox", { name: "Search student workspace" });
    await search.fill("Relational");
    await page.getByRole("banner").getByRole("button", { name: /^Quiz Quiz 02: Relational Data and Keys/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: QUIZ })).toBeVisible();

    await search.fill("Relational");
    await page.getByRole("banner").getByRole("button", { name: "Material Relational Database Design" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Relational Database Design" })).toBeVisible();
  });

  test("TW: the Due this week summary opens Tasks filtered to this week", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("main").getByRole("button", { name: /Due this week/ }).click();
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
    // The selected group's description is unique to "Due this week" and shown
    // by both UIs (the classic filter is a <details>, the rebuilt one a
    // segmented control; D-013).
    await expect(page.getByRole("main").getByText("Unfinished work due before the week ends").filter({ visible: true })).toHaveCount(1);
  });

  test("P: Reset demo data clears saved progress and returns to Today", async ({ page }) => {
    await openRole(page, "student");
    await submitQuiz(page);
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("button", { name: /^1 Assessments done/ })).toBeVisible();

    await page.getByRole("banner").getByRole("button", { name: /Alex Rivera/ }).click();
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^0 Assessments done/ })).toBeVisible();
  });

  test("ROLE: the profile menu switches workspace", async ({ page }) => {
    await openRole(page, "student");
    await page.getByRole("banner").getByRole("button", { name: /Alex Rivera/ }).click();
    await page.getByRole("group", { name: "Switch workspace" }).getByRole("button", { name: "Instructor workspace" }).click();
    await expect(page).toHaveURL(/\/instructor$/);
    await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toBeVisible();
  });
});

test.describe("Instructor · shell", () => {
  test("TOOLS: search opens a class on Stream", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("textbox", { name: "Search instructor workspace" }).fill("Intro");
    await page.getByRole("banner").getByRole("button", { name: /^Year 1 classroom Introduction to Programming/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Stream/ })).toHaveAttribute("aria-selected", "true");
  });

  test("TOOLS: notifications show an empty state when nothing needs review", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("banner").getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByRole("banner").getByText("Needs your attention")).toBeVisible();
    await expect(page.getByRole("banner").getByText("You’re all caught up.")).toBeVisible();
  });

  test("TOOLS: the breadcrumb returns to Overview", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("navigation", { name: "instructor navigation" }).getByRole("button", { name: "Gradebook" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toHaveCount(0);
    await page.getByRole("banner").getByRole("button", { name: "Workspace" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toBeVisible();
  });

  test("PICK: the year filter on Overview narrows the class list", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("combobox", { name: "Choose demo instructor" }).selectOption({ label: "Daniel Cruz" });
    const years = page.getByRole("main").getByRole("button", { name: /^Year \d$/ });
    await expect(years.first()).toBeVisible();
    await years.first().click();
    await expect(years.first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("main").getByRole("button", { name: "All years" })).toHaveAttribute("aria-pressed", "false");
  });
});
