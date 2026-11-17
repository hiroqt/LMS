import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { expect, test, type Page } from "./fixtures";

// The Admin journeys of docs/ADMIN_USER_FLOW.md. Written against the classic Admin UI
// before its rebuild (D-037), so the rebuild could prove it kept every journey; the
// only change since is that confirmations moved from window.confirm to a dialog (D-038).
// Admin data is browser-local: each test starts from the fictional seed.
// Names are matched case-insensitively because the rebuild uses sentence case.

const nav = (page: Page) => page.getByRole("navigation", { name: "admin navigation" });

/** Opens a page from the sidebar, expanding its category first when the shell has one. */
async function openPage(page: Page, item: RegExp, category?: string) {
  const link = nav(page).getByRole("button", { name: item });
  if (category && !(await link.isVisible())) await nav(page).getByRole("button", { name: category, exact: true }).click();
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: item })).toBeVisible();
}

async function openAdmin(page: Page) {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Academic overview" })).toBeVisible();
}

test.describe("Admin", () => {
  test("OVERVIEW: totals open the matching directory with its filter", async ({ page }) => {
    await openAdmin(page);
    await page.getByRole("button", { name: /^Total Students: \d+/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^user management$/i })).toBeVisible();
    await expect(page.getByRole("combobox", { name: /^role\b/i })).toHaveValue("student");
    await expect(page.getByRole("row", { name: /taylor morgan/i })).toHaveCount(0);
  });

  test("USERS: validate, add, find, and deactivate a person; the audit log records it", async ({ page }) => {
    await openAdmin(page);
    await page.getByRole("button", { name: /add person/i }).click();
    await page.getByLabel(/^full name/i).fill("Jordan Rivera");
    await page.getByLabel(/^email address/i).fill("taylor.morgan@tmcc.edu");
    await page.getByRole("button", { name: /^save record$/i }).click();
    await expect(page.getByText("That email address is already registered.")).toBeVisible();

    await page.getByLabel(/^email address/i).fill("jordan.rivera@tmcc.edu");
    await page.getByLabel(/^user role/i).selectOption("instructor");
    await page.getByRole("button", { name: /^save record$/i }).click();

    await page.getByRole("textbox", { name: "Search users" }).fill("jordan");
    const row = page.getByRole("row", { name: /jordan rivera/i });
    await expect(row).toContainText(/instructor/i);
    await row.getByRole("button", { name: /^deactivate/i }).click();
    await expect(row).toContainText(/inactive/i);

    await openPage(page, /^audit logs$/i, "Oversight");
    await page.getByLabel(/^category/i).selectOption("users");
    await expect(page.getByRole("row", { name: /created.*user/i }).first()).toBeVisible();
    await expect(page.getByRole("row", { name: /deactivated/i }).first()).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /export audit csv/i }).click();
    expect((await download).suggestedFilename()).toBe("audit-logs.csv");
  });

  test("SUBJECTS: a duplicate code is refused; an unused subject can be deleted", async ({ page }) => {
    await openAdmin(page);
    await openPage(page, /^course management$/i, "Courses");
    await expect(page.getByRole("tab", { name: "Subjects" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: /add subject/i }).click();
    await page.getByLabel(/^subject code/i).fill("IT101");
    await page.getByLabel(/^subject title/i).fill("Duplicate");
    await page.getByRole("button", { name: /^save record$/i }).click();
    await expect(page.getByText("That subject code already exists in catalog.")).toBeVisible();

    await page.getByLabel(/^subject code/i).fill("CS201");
    await page.getByLabel(/^subject title/i).fill("Data Structures");
    await page.getByRole("button", { name: /^save record$/i }).click();
    const row = page.getByRole("row", { name: /CS201/ });
    await expect(row).toContainText("Data Structures");

    // Destructive actions confirm in a dialog that names the item (C-013, D-038).
    await row.getByRole("button", { name: /^delete/i }).click();
    await page.getByRole("dialog", { name: "Delete CS201?" }).getByRole("button", { name: "Delete subject" }).click();
    await expect(page.getByRole("row", { name: /CS201/ })).toHaveCount(0);
  });

  test("CLASSROOMS and ENROLLMENTS: add a classroom, enroll a student once, then remove them", async ({ page }) => {
    await openAdmin(page);
    await openPage(page, /^course management$/i, "Courses");
    await page.getByRole("tab", { name: "Classrooms" }).click();
    await page.getByRole("button", { name: /add classroom/i }).click();
    await page.getByRole("combobox", { name: /^subject\b/i }).selectOption({ index: 1 });
    await page.getByLabel(/^section name/i).fill("BSIT 1-Z");
    await expect(page.getByLabel(/^enrollment code/i)).not.toHaveValue("");
    await page.getByRole("button", { name: /^save record$/i }).click();
    await expect(page.getByRole("row", { name: /BSIT 1-Z/ })).toContainText(/active/i);

    await openPage(page, /^enrollments$/i, "Courses");
    for (const attempt of ["first", "duplicate"]) {
      await page.getByRole("button", { name: /add enrollment/i }).click();
      await page.getByLabel(/^target classroom/i).selectOption({ label: await optionLabel(page, /BSIT 1-Z/) });
      await page.getByLabel(/^student/i).selectOption({ index: 1 });
      await page.getByRole("button", { name: /^save record$/i }).click();
      if (attempt === "duplicate") await expect(page.getByText("Student is already enrolled in this classroom.")).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await page.getByRole("textbox", { name: "Search enrollments" }).fill("BSIT 1-Z");
    const row = page.getByRole("row", { name: /BSIT 1-Z/ });
    await expect(row).toHaveCount(1);
    await row.getByRole("button", { name: /^remove/i }).click();
    await expect(row).toContainText(/inactive/i);
  });

  test("TERMS: dates are validated, a new term becomes current, the old one is archived", async ({ page }) => {
    await openAdmin(page);
    await openPage(page, /^academic term/i, "Academic Terms");
    await page.getByLabel(/^term name/i).fill("Spring 2027");
    await page.getByLabel(/^start date/i).fill("2027-05-01");
    await page.getByLabel(/^end date/i).fill("2027-01-15");
    await page.getByRole("button", { name: /^add term$/i }).click();
    await expect(page.getByText("The end date must be after the start date.")).toBeVisible();

    await page.getByLabel(/^start date/i).fill("2027-01-10");
    await page.getByLabel(/^end date/i).fill("2027-05-20");
    await page.getByRole("button", { name: /^add term$/i }).click();
    await expect(page.getByText("Academic term added as planned.")).toBeVisible();
    const spring = page.getByRole("row", { name: /spring 2027/i });
    await expect(spring).toContainText(/planned/i);

    await spring.getByRole("button", { name: /^make current/i }).click();
    await expect(page.getByText("Spring 2027 is now the default for new classrooms.")).toBeVisible();
    await expect(spring).toContainText(/current/i);
    await page.getByRole("row", { name: /fall 2026/i }).getByRole("button", { name: /^archive/i }).click();
    await expect(page.getByRole("row", { name: /fall 2026/i })).toContainText(/archived/i);
  });

  test("ROLES: the demo permission matrix saves and survives a reload", async ({ page }) => {
    await openAdmin(page);
    await openPage(page, /^role management$/i, "People & Access");
    await page.getByRole("group", { name: "Select a role" }).getByRole("button", { name: /^instructor$/i }).click();
    const box = page.getByRole("checkbox", { name: "instructor export Reports" });
    const before = await box.isChecked();
    await box.setChecked(!before);
    await page.getByRole("button", { name: /^save permission matrix$/i }).click();
    await expect(page.getByText(/Demo permission matrix saved/)).toBeVisible();

    await openAdmin(page);
    await openPage(page, /^role management$/i, "People & Access");
    await page.getByRole("group", { name: "Select a role" }).getByRole("button", { name: /^instructor$/i }).click();
    await expect(page.getByRole("checkbox", { name: "instructor export Reports" })).toBeChecked({ checked: !before });
  });

  test("SETTINGS: save defaults, back up, download, and reset the demo after confirming", async ({ page }) => {
    await openAdmin(page);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel(/^institution name/i).fill("TMCC Test Campus");
    await page.getByRole("button", { name: /^save configuration$/i }).click();
    await expect(page.getByText("System configuration saved in this browser.")).toBeVisible();

    await page.getByRole("button", { name: /^create backup$/i }).click();
    await expect(page.getByText("Backup saved in this browser. Download it to keep a separate copy.")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /^download json$/i }).click();
    expect((await download).suggestedFilename()).toMatch(/^tmcc-lms-backup-.+\.json$/);

    await page.getByRole("button", { name: /^reset demo data$/i }).click();
    await page.getByRole("dialog", { name: "Reset demo data?" }).getByRole("button", { name: /^reset demo data$/i }).click();
    await expect(page.getByText(/^Demo data reset\. A backup from/)).toBeVisible();
    // What was stored, not what the form still shows: reload and look again.
    await openAdmin(page);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel(/^institution name/i)).not.toHaveValue("TMCC Test Campus");
  });

  test("REPORTS: each report downloads a CSV", async ({ page }) => {
    await openAdmin(page);
    await openPage(page, /^system reports$/i, "Oversight");
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Export users" }) });
    const download = page.waitForEvent("download");
    await card.getByRole("button", { name: /download csv/i }).click();
    expect((await download).suggestedFilename()).toBe("users.csv");
  });

  test("SEARCH: a person found in the top bar opens User Management", async ({ page }) => {
    await openAdmin(page);
    await page.getByRole("textbox", { name: "Search admin workspace" }).fill("Taylor");
    await page.getByRole("button", { name: /taylor morgan/i }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^user management$/i })).toBeVisible();
  });

  test("MOBILE: the menu reaches Audit Logs on a phone @mobile", async ({ page }) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Open menu" }).click();
    await openPage(page, /^audit logs$/i, "Oversight");
  });
});

/** The full label of the first option matching `pattern` in the target-classroom list. */
async function optionLabel(page: Page, pattern: RegExp): Promise<string> {
  const select = page.getByLabel(/^target classroom/i);
  await expect(select).toBeVisible();
  const labels = await select.locator("option").allTextContents();
  const match = labels.find((label) => pattern.test(label));
  if (!match) throw new Error(`No classroom option matches ${pattern}`);
  return match;
}

// Added with the rebuild (D-038): the same bar as the rebuilt Student and Instructor screens.
const ADMIN_PAGES = ["/admin", "/admin/users", "/admin/courses", "/admin/courses?tab=classrooms", "/admin/enrollments", "/admin/roles", "/admin/audit", "/admin/reports", "/admin/terms", "/admin/settings"];

test("every Admin page: zero axe violations and text of at least 14px @all", async ({ page }) => {
  test.slow(); // many page loads, each with a full axe scan (L-030)
  for (const path of ADMIN_PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
  }
  await page.goto("/admin/users?create=1");
  await expect(page.getByRole("dialog", { name: "Create new person" })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("no Admin page scrolls sideways at 320px @mobile", async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ADMIN_PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
