import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, openRole, test } from "./fixtures";

// Display preferences added in D-024: cards or table for class lists, and a
// sidebar that narrows to icons. Neither changes a journey; both must stay
// operable by name.

test.describe("Class list view", () => {
  test("student: My classes switches to a table, and a row opens its class @all", async ({ page }) => {
    await openRole(page, "student");
    // The dashboard has no cards-or-table switch: its classes are one row of tiles (D-071).
    await expect(page.getByRole("region", { name: "My Classes", exact: true }).getByRole("button", { name: /^Introduction to Programming/ })).toBeVisible();
    await expect(page.getByRole("main").getByRole("group", { name: "Class list view" })).toHaveCount(0);

    await page.goto("/student/classes");
    await expect(page.getByRole("heading", { level: 1, name: "My classes" })).toBeVisible();
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

    // A row opens its class.
    await table.getByRole("button", { name: "Introduction to Programming" }).click();
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

  test("instructor: a collapsed sidebar still opens a class", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    const sidebar = page.getByRole("complementary", { name: "Workspace" });
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

    // Wide: tasks and calendar share one row; the classes get their own row under them (D-071).
    const top = async (name: string) => (await page.getByRole("heading", { name }).boundingBox())?.y ?? 0;
    expect(Math.abs((await top("Tasks & Assessments")) - (await top("Academic Calendar")))).toBeLessThan(60);
    expect((await top("My Classes")) - (await top("Academic Calendar"))).toBeGreaterThan(200);

    // Narrow window: the same panels stack instead of squeezing.
    await page.setViewportSize({ width: 1024, height: 768 });
    expect((await top("Academic Calendar")) - (await top("Tasks & Assessments"))).toBeGreaterThan(200);
    await expectNoAxeViolations(page);
  });
});

// D-071: announcements beside Next due, the status buttons inside Tasks & Assessments, a
// calendar that does not repeat the tasks, and the classes in one row.
test.describe("Student dashboard (D-071)", () => {
  test("announcements sit beside Next due, above the tasks and the calendar", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRole(page, "student");
    const main = page.getByRole("main");
    const box = async (target: ReturnType<typeof main.getByRole>) => {
      const found = await target.boundingBox();
      if (!found) throw new Error("not on screen");
      return found;
    };
    const region = (name: string) => main.getByRole("region", { name, exact: true });
    const next = await box(region("Next due"));
    const announcements = await box(region("Announcements"));
    const tasks = await box(region("Tasks & Assessments"));
    const calendar = await box(region("Academic Calendar"));
    const classes = await box(region("My Classes"));

    // Top row: Next due, then announcements beside it, ending on one line.
    expect(announcements.x).toBeGreaterThan(next.x + 300);
    expect(Math.abs(announcements.y - next.y)).toBeLessThan(2);
    expect(Math.abs(announcements.height - next.height)).toBeLessThan(2);
    // Then tasks beside the calendar, then the classes across.
    expect(tasks.y).toBeGreaterThan(next.y + next.height);
    expect(Math.abs(calendar.y - tasks.y)).toBeLessThan(2);
    expect(calendar.x).toBeGreaterThan(tasks.x + 300);
    expect(classes.y).toBeGreaterThan(tasks.y + tasks.height);
    expect(classes.width).toBeGreaterThan(tasks.width + calendar.width);
    // The separate summary strip is gone: its counts are buttons inside Tasks.
    await expect(main.getByText("Active classes")).toHaveCount(0);
    await expectNoAxeViolations(page);
    await expectReadableText(page);

    // One column on a phone: next due, announcements, tasks, calendar, classes.
    await page.setViewportSize({ width: 390, height: 844 });
    const order = [];
    for (const name of ["Next due", "Announcements", "Tasks & Assessments", "Academic Calendar", "My Classes"]) order.push((await box(region(name))).y);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });

  test("the status buttons are colored, span the Tasks tile, and fill it when nothing is due", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRole(page, "student");
    const main = page.getByRole("main");
    const tasks = main.getByRole("region", { name: "Tasks & Assessments", exact: true });
    const group = tasks.getByRole("group", { name: "Work by status" });
    const box = async (target: typeof tasks) => {
      const found = await target.boundingBox();
      if (!found) throw new Error("not on screen");
      return found;
    };
    const height = async (name: string) => (await box(main.getByRole("region", { name, exact: true }))).height;
    const spansTheTile = async () => {
      const [tile, first, last] = [await box(tasks), await box(group.getByRole("button").first()), await box(group.getByRole("button").last())];
      // From the tile's left padding to its right padding (at most 24px a side), in equal thirds.
      expect(first.x - tile.x).toBeLessThan(26);
      expect(tile.x + tile.width - (last.x + last.width)).toBeLessThan(26);
      expect(Math.abs(first.width - last.width)).toBeLessThan(2);
      return first;
    };

    // Each name starts with its number; the three statuses are always there.
    await expect(group.getByRole("button")).toHaveText([/^\d+\s*Due this week$/, /^\d+\s*Missing$/, /^\d+\s*Done$/]);

    // Due this week is yellow, Missing red, Done green (a tint; the name is always written).
    const tints = await group.getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => (getComputedStyle(button).backgroundColor.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)),
    );
    const [yellow, red, green] = tints as [number[], number[], number[]];
    const channel = (rgb: number[], index: number) => rgb[index] ?? 0;
    expect(Math.min(channel(yellow, 0), channel(yellow, 1)) - channel(yellow, 2)).toBeGreaterThan(15);
    expect(channel(red, 0) - Math.max(channel(red, 1), channel(red, 2))).toBeGreaterThan(10);
    expect(channel(green, 1) - Math.max(channel(green, 0), channel(green, 2))).toBeGreaterThan(5);

    // Seed day: a full list, so the buttons are one short row over it and the tiles end level.
    expect((await spansTheTile()).height).toBeLessThan(60);
    expect(Math.abs((await height("Tasks & Assessments")) - (await height("Academic Calendar")))).toBeLessThan(2);

    // A month on, nothing is due but the calendar still lists dates.
    await page.clock.setFixedTime(new Date("2026-11-26T09:00:00+08:00"));
    await page.reload();
    await expect(tasks.getByText("Nothing is due.")).toBeVisible();
    await expect(main.getByRole("region", { name: "Academic Calendar", exact: true }).getByRole("listitem")).toHaveCount(4);
    // The tile still ends level with the calendar, and the buttons take the height the list left.
    expect(Math.abs((await height("Tasks & Assessments")) - (await height("Academic Calendar")))).toBeLessThan(2);
    expect((await spansTheTile()).height).toBeGreaterThan(120);
    await expectNoAxeViolations(page);
  });

  test("the calendar does not repeat the deadlines Next due and Tasks already list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRole(page, "student");
    const main = page.getByRole("main");
    const titles = async (name: string, item: string) =>
      (await main.getByRole("region", { name, exact: true }).locator(item).allInnerTexts()).map((text) => text.trim());
    const tasks = await titles("Tasks & Assessments", "li strong");
    const calendar = await titles("Academic Calendar", "li strong");
    expect(tasks).toHaveLength(4);
    expect(calendar.length).toBeGreaterThan(0);
    expect(calendar.filter((title) => tasks.includes(title))).toEqual([]);
    const nextDue = (await main.getByRole("region", { name: "Next due", exact: true }).innerText()).trim();
    expect(calendar.filter((title) => nextDue.includes(title))).toEqual([]);
  });

  test("the dashboard's classes stay in one row and scroll sideways when they outnumber the width", async ({ page }) => {
    // Too narrow for the seed's four classes side by side.
    await page.setViewportSize({ width: 1024, height: 768 });
    await openRole(page, "student");
    const classes = page.getByRole("region", { name: "My Classes", exact: true });
    const cards = classes.getByRole("listitem");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(2);
    const tops = await Promise.all((await cards.all()).map(async (card) => Math.round((await card.boundingBox())?.y ?? 0)));
    expect(new Set(tops).size).toBe(1);

    // The row scrolls; the page does not.
    const row = await classes.getByRole("list").evaluate((list) => ({ content: list.scrollWidth, shown: list.clientWidth }));
    expect(row.content).toBeGreaterThan(row.shown + 100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expectNoAxeViolations(page);

    // A card past the edge is still one click away.
    const last = cards.last().getByRole("button");
    await expect(last).not.toBeInViewport({ ratio: 1 });
    await last.click();
    await expect(page.getByRole("heading", { level: 1, name: "Computer Networking" })).toBeVisible();
  });
});
