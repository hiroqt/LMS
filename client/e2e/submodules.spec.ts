import { expectNoAxeViolations } from "./a11y";
import { callApi, expect, INSTRUCTOR, openRole, test, type Page } from "./fixtures";

// Submodules (D-033): an instructor organizes a module into submodules and
// places content in them; the student sees the same tree on the class page.

const UNIT = "Unit 1 · Foundations";

const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });
const submodules = (page: Page) => page.getByRole("list", { name: `Submodules of ${UNIT}` });

async function openModules(page: Page) {
  await openRole(page, "instructor");
  await page.getByRole("complementary").getByRole("button", { name: /^IT101 Introduction to Programming/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
  await tab(page, /^Modules/).click();
  await expect(page.getByRole("heading", { level: 3, name: UNIT })).toBeVisible();
}

async function addSubmodule(page: Page, title: string) {
  await page.getByRole("button", { name: `Add submodule to ${UNIT}` }).click();
  const dialog = page.getByRole("dialog", { name: `Add a submodule to ${UNIT}` });
  await dialog.getByRole("textbox", { name: /Submodule title/ }).fill(title);
  await dialog.getByRole("button", { name: "Add submodule" }).click();
  await expect(dialog).toBeHidden();
  await expect(submodules(page).getByRole("heading", { level: 4, name: title })).toBeVisible();
}

// The student's Modules tab lists one button per module; each opens the module's own page (D-073).
const moduleList = (page: Page) => page.getByRole("list", { name: "Modules" });

async function openModulePage(page: Page) {
  await moduleList(page).getByRole("button", { name: UNIT }).click();
  await expect(page.getByRole("heading", { level: 1, name: UNIT })).toBeFocused();
}

test.describe("Submodules", () => {
  test("instructor adds, reorders, and renames submodules and files content in them; the student sees them nested", async ({ page }) => {
    await openModules(page);
    await addSubmodule(page, "1.1 Pseudocode");
    await addSubmodule(page, "1.2 Flowcharts");
    await expect(submodules(page).getByRole("heading", { level: 4 })).toHaveText(["1.1 Pseudocode", "1.2 Flowcharts"]);

    // Reorder, then put it back.
    await page.getByRole("button", { name: "Move 1.2 Flowcharts up" }).click();
    await expect(submodules(page).getByRole("heading", { level: 4 })).toHaveText(["1.2 Flowcharts", "1.1 Pseudocode"]);
    await expect(page.getByRole("button", { name: "Move 1.2 Flowcharts up" })).toBeDisabled();
    await page.getByRole("button", { name: "Move 1.2 Flowcharts down" }).click();
    await expect(submodules(page).getByRole("heading", { level: 4 })).toHaveText(["1.1 Pseudocode", "1.2 Flowcharts"]);

    await page.getByRole("button", { name: "Rename 1.1 Pseudocode" }).click();
    const rename = page.getByRole("dialog", { name: "Rename 1.1 Pseudocode" });
    await rename.getByRole("textbox", { name: /Submodule title/ }).fill("1.1 Writing pseudocode");
    await rename.getByRole("button", { name: "Save name" }).click();
    await expect(submodules(page).getByRole("heading", { level: 4 })).toHaveText(["1.1 Writing pseudocode", "1.2 Flowcharts"]);

    // A new material goes straight into a submodule.
    await tab(page, /^Create content/).click();
    await page.getByRole("button", { name: "Create material" }).click();
    await page.getByRole("combobox", { name: /Curriculum Unit \/ Module/ }).selectOption({ label: `${UNIT} › 1.2 Flowcharts` });
    await page.getByRole("textbox", { name: /Material title/ }).fill("Flowchart symbols");
    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(tab(page, /^Materials/)).toHaveAttribute("aria-selected", "true");

    // An existing material moves from the module into a submodule.
    await tab(page, /^Modules/).click();
    await expect(page.getByRole("list", { name: "Content in 1.2 Flowcharts" }).getByText("Flowchart symbols")).toBeVisible();
    await page.getByRole("list", { name: `Content in ${UNIT}` }).getByRole("button", { name: "Move Programming Logic and Pseudocode" }).click();
    const move = page.getByRole("dialog", { name: "Move Programming Logic and Pseudocode" });
    await move.getByRole("combobox", { name: "Module or submodule" }).selectOption({ label: `${UNIT} › 1.1 Writing pseudocode` });
    await move.getByRole("button", { name: "Move here" }).click();
    await expect(move).toBeHidden();
    await expect(page.getByRole("list", { name: "Content in 1.1 Writing pseudocode" }).getByText("Programming Logic and Pseudocode")).toBeVisible();
    await expect(page.getByRole("list", { name: `Content in ${UNIT}` }).getByText("Programming Logic and Pseudocode")).toHaveCount(0);

    // The student sees the module as a button that opens its own page (D-073); the page lists the
    // submodules, and each column groups its items under the submodule they sit in (D-074).
    await page.goto("/student/classes/biology?tab=Modules");
    await expect(page.getByRole("tab", { name: "Modules" })).toHaveAttribute("aria-selected", "true");
    await openModulePage(page);
    const submoduleCard = page.getByRole("list", { name: "Submodules" });
    await expect(submoduleCard.getByRole("heading", { level: 3 })).toHaveText(["1.1 Writing pseudocode", "1.2 Flowcharts"]);
    // Each submodule shows only its title until opened, then what it holds (D-075, D-076).
    const flowcharts = submoduleCard.getByRole("button", { name: "1.2 Flowcharts" });
    await expect(flowcharts).toHaveAttribute("aria-expanded", "false");
    await expect(submoduleCard.getByRole("list", { name: "Items in 1.2 Flowcharts" })).toBeHidden();
    await flowcharts.click();
    await expect(flowcharts).toHaveAttribute("aria-expanded", "true");
    await expect(submoduleCard.getByRole("list", { name: "Items in 1.2 Flowcharts" }).getByRole("button")).toHaveText([/^Flowchart symbols/]);
    await expect(submoduleCard.getByRole("list", { name: "Items in 1.1 Writing pseudocode" })).toBeHidden();
    await submoduleCard.getByRole("button", { name: "1.1 Writing pseudocode" }).click();
    await expect(submoduleCard.getByRole("list", { name: "Items in 1.1 Writing pseudocode" }).getByRole("button")).toHaveText([/^Programming Logic and Pseudocode/]);
    await flowcharts.click();
    await expect(submoduleCard.getByRole("list", { name: "Items in 1.2 Flowcharts" })).toBeHidden();
    await expect(page.getByRole("list", { name: "Materials in 1.2 Flowcharts", exact: true }).getByRole("button", { name: /Flowchart symbols/ })).toBeVisible();
    await page.getByRole("list", { name: "Materials in 1.1 Writing pseudocode", exact: true }).getByRole("button", { name: /Programming Logic and Pseudocode/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Programming Logic and Pseudocode" })).toBeVisible();
  });

  test("student opens a module's own page from the Modules tab, sees four columns, and goes back @all", async ({ page }) => {
    await page.goto("/student/classes/biology?tab=Modules");
    await expect(moduleList(page).getByRole("button")).toHaveText([UNIT]);
    await openModulePage(page);
    await expect(page).toHaveURL(/\/student\/classes\/biology\/modules\/[^/?]+$/);
    await expect(page.getByRole("tablist", { name: "Class sections" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([/^Assessments/, /^Activities/, /^Assignments/, /^Materials/]);
    await expect(page.getByRole("list", { name: "Assessments" }).getByRole("button").first()).toBeVisible();

    // Back returns to the Modules tab without adding a history entry.
    await page.getByRole("button", { name: "Back to modules" }).click();
    await expect(page.getByRole("heading", { level: 1, name: UNIT })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Modules" })).toHaveAttribute("aria-selected", "true");
    await expect(moduleList(page).getByRole("button", { name: UNIT })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: UNIT })).toBeVisible();

    // Opened by URL (no Modules tab behind it), Back still lands on the Modules tab. Going to the
    // same URL would be a reload, which keeps the router state, so leave the page first.
    const moduleUrl = page.url();
    await page.goto("/student");
    await page.goto(moduleUrl);
    await page.getByRole("button", { name: "Back to modules" }).click();
    await expect(page.getByRole("tab", { name: "Modules" })).toHaveAttribute("aria-selected", "true");
    await expect(moduleList(page).getByRole("button", { name: UNIT })).toBeVisible();
  });

  test("student opens a material and an assessment from a module page, and Back returns to that module @all", async ({ page }) => {
    await page.goto("/student/classes/biology?tab=Modules");
    await openModulePage(page);
    const modulePage = page.url();

    // A material opened from the module page goes back to the module, not the Materials tab (D-077).
    await page.getByRole("list", { name: "Materials", exact: true }).getByRole("button").first().click();
    await expect(page).toHaveURL(/\/student\/materials\/[^/?]+$/);
    await page.getByRole("button", { name: `Back to ${UNIT}` }).click();
    await expect(page).toHaveURL(modulePage);
    await expect(page.getByRole("heading", { level: 1, name: UNIT })).toBeVisible();
    // Back stepped back in history instead of adding an entry.
    await page.goForward();
    await expect(page).toHaveURL(/\/student\/materials\/[^/?]+$/);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: UNIT })).toBeVisible();

    // So does an assessment, instead of the Classwork tab.
    await page.getByRole("list", { name: "Assessments", exact: true }).getByRole("button").first().click();
    await expect(page).toHaveURL(/\/student\/assessments\/[^/?]+$/);
    await page.getByRole("button", { name: `Back to ${UNIT}` }).click();
    await expect(page).toHaveURL(modulePage);

    // Opened by URL (no module page behind it), Back keeps going to the class tab.
    await page.goForward();
    const assessmentUrl = page.url();
    await page.goto("/student");
    await page.goto(assessmentUrl);
    await expect(page.getByRole("button", { name: "Back to classwork" })).toBeVisible();
  });

  test("the Modules tabs have no accessibility violations and no sideways scroll at 320px @all", async ({ page, sandbox }) => {
    const [unit] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
    await callApi(page, sandbox, INSTRUCTOR, "POST", "/api/classes/biology/modules", { title: "1.1 Pseudocode", parentModuleId: unit!.id });
    const narrow = async (path: string, ready = () => expect(submodules(page).getByRole("heading", { level: 4, name: "1.1 Pseudocode" })).toBeVisible()) => {
      const viewport = page.viewportSize();
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await ready();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
      if (viewport) await page.setViewportSize(viewport);
    };

    // By URL: on phones the class list is in the navigation drawer.
    await page.goto("/instructor/classes/biology?tab=Modules");
    await expect(submodules(page).getByRole("heading", { level: 4, name: "1.1 Pseudocode" })).toBeVisible();
    await expectNoAxeViolations(page);
    await narrow("/instructor/classes/biology?tab=Modules");

    await page.goto("/student/classes/biology?tab=Modules");
    const topicButton = moduleList(page).getByRole("button", { name: UNIT });
    await expect(topicButton).toBeVisible();
    await expectNoAxeViolations(page);
    await narrow("/student/classes/biology?tab=Modules", () => expect(topicButton).toBeVisible());
    await openModulePage(page);
    // A submodule with nothing in it yet still shows on the student's module page (D-074).
    const empty = page.getByRole("list", { name: "Submodules" }).getByRole("button", { name: "1.1 Pseudocode" });
    await expect(page.getByText("Nothing posted yet")).toBeHidden();
    await empty.click();
    await expect(page.getByText("Nothing posted yet")).toBeVisible();
    await expectNoAxeViolations(page);
    await narrow(page.url(), () => expect(page.getByRole("heading", { level: 1, name: UNIT })).toBeVisible());
  });
});
