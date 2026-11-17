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

    // The student sees the same tree, with each item under its submodule.
    await page.goto("/student/classes/biology?tab=Modules");
    await expect(page.getByRole("tab", { name: "Modules" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 3, name: UNIT })).toBeVisible();
    await expect(submodules(page).getByRole("heading", { level: 4 })).toHaveText(["1.1 Writing pseudocode", "1.2 Flowcharts"]);
    await expect(page.getByRole("list", { name: "Content in 1.2 Flowcharts" }).getByRole("button", { name: /Flowchart symbols/ })).toBeVisible();
    await page.getByRole("list", { name: "Content in 1.1 Writing pseudocode" }).getByRole("button", { name: /Programming Logic and Pseudocode/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Programming Logic and Pseudocode" })).toBeVisible();
  });

  test("the Modules tabs have no accessibility violations and no sideways scroll at 320px @all", async ({ page, sandbox }) => {
    const [unit] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
    await callApi(page, sandbox, INSTRUCTOR, "POST", "/api/classes/biology/modules", { title: "1.1 Pseudocode", parentModuleId: unit!.id });
    const narrow = async (path: string) => {
      const viewport = page.viewportSize();
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      await expect(submodules(page).getByRole("heading", { level: 4, name: "1.1 Pseudocode" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
      if (viewport) await page.setViewportSize(viewport);
    };

    // By URL: on phones the class list is in the navigation drawer.
    await page.goto("/instructor/classes/biology?tab=Modules");
    await expect(submodules(page).getByRole("heading", { level: 4, name: "1.1 Pseudocode" })).toBeVisible();
    await expectNoAxeViolations(page);
    await narrow("/instructor/classes/biology?tab=Modules");

    await page.goto("/student/classes/biology?tab=Modules");
    await expect(submodules(page).getByRole("heading", { level: 4, name: "1.1 Pseudocode" })).toBeVisible();
    await expectNoAxeViolations(page);
    await narrow("/student/classes/biology?tab=Modules");
  });
});
