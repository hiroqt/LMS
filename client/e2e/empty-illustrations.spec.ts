import { callApi, expect, INSTRUCTOR, test, type Page } from "./fixtures";

// D-057: an illustration appears only where nothing exists yet. A search or filter
// miss keeps its plain message, and assistive technology never hears the picture.

const STUDENT_MATERIALS = "/student/classes/biology?tab=Materials";
const INSTRUCTOR_MATERIALS = "/instructor/classes/biology?tab=Materials";

async function removeEveryMaterial(page: Page, sandbox: string) {
  const { items } = await callApi<{ items: Array<{ id: number }> }>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/materials?pageSize=100");
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) await callApi(page, sandbox, INSTRUCTOR, "DELETE", `/api/classes/biology/materials/${item.id}`);
}

/** The decorative picture: loaded, and not exposed as an image. */
async function expectIllustration(page: Page) {
  const picture = page.getByRole("main").locator('img[alt=""]');
  await expect(picture).toBeVisible();
  await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("main").getByRole("img")).toHaveCount(0);
}

test.describe("Empty-state illustrations (D-057)", () => {
  test("Student Materials: a class with no materials shows the picture @all", async ({ page, sandbox }) => {
    await removeEveryMaterial(page, sandbox);
    await page.goto(STUDENT_MATERIALS);
    await expect(page.getByRole("main").getByText("No materials found.")).toBeVisible();
    await expectIllustration(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Student Materials: a search that finds nothing has no picture", async ({ page }) => {
    await page.goto(STUDENT_MATERIALS);
    await page.getByRole("searchbox", { name: "Search materials" }).or(page.getByRole("textbox", { name: "Search materials" })).fill("zzzz-no-match");
    await expect(page.getByRole("main").getByText("No materials found.")).toBeVisible();
    await expect(page.getByRole("main").locator("img")).toHaveCount(0);
  });

  test("Instructor Materials: no materials shows the picture and Add material opens the form", async ({ page, sandbox }) => {
    await removeEveryMaterial(page, sandbox);
    await page.goto(INSTRUCTOR_MATERIALS);
    await expect(page.getByRole("main").getByText("No materials yet")).toBeVisible();
    await expectIllustration(page);
    // The tab's heading has its own Add material; this is the one inside the empty state.
    await page.getByRole("button", { name: "Add material" }).last().click();
    await expect(page.getByRole("textbox", { name: /Material title/ })).toBeVisible();
  });

  test("Instructor Materials: a filter miss keeps the icon", async ({ page }) => {
    await page.goto(INSTRUCTOR_MATERIALS);
    await page.getByRole("searchbox", { name: "Search materials" }).or(page.getByRole("textbox", { name: "Search materials" })).fill("zzzz-no-match");
    await expect(page.getByRole("main").getByText("No materials match these filters")).toBeVisible();
    await expect(page.getByRole("main").locator("img")).toHaveCount(0);
  });
});
