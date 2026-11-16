import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, openRole, test } from "./fixtures";

// Display preferences added in D-024: cards or table for class lists, and a
// sidebar that narrows to icons. Neither changes a journey; both must stay
// operable by name.

test.describe("Class list view", () => {
  test("student: the dashboard class list switches to a table and the choice carries to My classes @all", async ({ page }) => {
    await openRole(page, "student");
    const view = page.getByRole("main").getByRole("group", { name: "Class list view" });
    await expect(view.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "true");
    await view.getByRole("button", { name: "Table" }).click();

    const table = page.getByRole("table", { name: "My classes" });
    await expect(table.getByRole("columnheader", { name: "Next class" })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Introduction to Programming" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Remembered on the My classes page, and a row opens its class.
    await page.goto("/student/classes");
    await expect(page.getByRole("heading", { level: 1, name: "My classes" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Class list view" }).getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("table", { name: "My classes" }).getByRole("button", { name: "Introduction to Programming" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
  });

  test("instructor: My classes switches to a table and back", async ({ page }) => {
    await openRole(page, "instructor");
    const view = page.getByRole("main").getByRole("group", { name: "Class list view" });
    await view.getByRole("button", { name: "Table" }).click();
    const table = page.getByRole("table", { name: "My classes" });
    await expect(table.getByRole("columnheader", { name: "Students" })).toBeVisible();
    await expectNoAxeViolations(page);
    await view.getByRole("button", { name: "Cards" }).click();
    await expect(table).toHaveCount(0);
  });
});

test.describe("Collapsible sidebar", () => {
  test("student: the sidebar narrows to icons, stays operable by name, and is remembered", async ({ page }) => {
    await openRole(page, "student");
    const sidebar = page.getByRole("complementary", { name: "Workspace" });
    const expanded = (await sidebar.boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    expect((await sidebar.boundingBox())?.width ?? 0).toBeLessThan(expanded / 2);
    await expectNoAxeViolations(page);

    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await sidebar.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/calendar/i);
    await sidebar.getByRole("navigation", { name: "My classes" }).getByRole("button", { name: "Introduction to Programming" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
  });

  test("student: the My classes list in the sidebar folds away", async ({ page }) => {
    await openRole(page, "student");
    const classes = page.getByRole("navigation", { name: "My classes" });
    const fold = classes.getByRole("button", { name: /^My classes/ });
    await expect(fold).toHaveAttribute("aria-expanded", "true");
    await fold.click();
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    await expect(classes.getByRole("button", { name: "Introduction to Programming" })).toHaveCount(0);
  });

  test("instructor: a collapsed sidebar still opens a class and Create class", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    const sidebar = page.getByRole("complementary", { name: "Workspace" });
    await sidebar.getByRole("button", { name: "+ Create class" }).click();
    await expect(page.getByRole("heading", { name: "Create a class" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await sidebar.getByRole("button", { name: /^IT101 Introduction to Programming/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
  });
});

test.describe("Adaptive layout (D-025)", () => {
  test("the page fills the area beside the sidebar and gains columns with room", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openRole(page, "student");
    const main = page.getByRole("main");
    const sidebar = page.getByRole("complementary", { name: "Workspace" });
    const width = async (target: typeof main) => (await target.boundingBox())?.width ?? 0;
    // The body's width excludes the always-present scrollbar track (index.css).
    const available = await page.evaluate(() => document.body.clientWidth);
    expect(await width(main)).toBeGreaterThanOrEqual(available - (await width(sidebar)) - 1);

    // Wide: tasks, classes, and calendar share one row.
    const top = async (name: string) => (await page.getByRole("heading", { name }).boundingBox())?.y ?? 0;
    expect(Math.abs((await top("Tasks & Assessments")) - (await top("Academic Calendar")))).toBeLessThan(60);
    expect(Math.abs((await top("My Classes")) - (await top("Academic Calendar")))).toBeLessThan(60);

    // Narrow window: the same panels stack instead of squeezing.
    await page.setViewportSize({ width: 1024, height: 768 });
    expect((await top("Academic Calendar")) - (await top("Tasks & Assessments"))).toBeGreaterThan(200);
    await expectNoAxeViolations(page);
  });
});
