import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { API, callApi, demoMaterial, expect, INSTRUCTOR, STUDENT, test, type Page } from "./fixtures";

// Class material files and their previews (D-067). The API runs with the converter off
// (playwright.config.ts), so an Office upload here has no preview; the seeded Office materials
// carry ready-made ones.

const CLASS = "/instructor/classes/biology";

/** One of the demo seed's files (server/src/Lms.Api/Demo/files), as a file to choose. */
function demoFile(name: string, mimeType: string, as = name) {
  return { name: as, mimeType, buffer: readFileSync(fileURLToPath(new URL(`../../server/src/Lms.Api/Demo/files/${name}`, import.meta.url))) };
}

async function openMaterial(page: Page, title: string) {
  await page.goto(`${CLASS}?tab=Materials`);
  await page.getByRole("main").getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test.describe("Instructor · class material files", () => {
  test("a new material is published with its PDF, which previews and downloads @all", async ({ page }) => {
    await page.goto(`${CLASS}?tab=Create+content&create=material`);
    await page.getByRole("textbox", { name: /Material title/ }).fill("Loops guide");
    await page.getByLabel("Attach file / document").setInputFiles(demoFile("programming-logic-and-pseudocode.pdf", "application/pdf", "loops-guide.pdf"));
    await expect(page.getByText("loops-guide.pdf (5 KB)")).toBeVisible();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Material published" })).toBeVisible();

    await openMaterial(page, "Loops guide");
    const preview = page.getByRole("region", { name: "Preview of Loops guide" });
    await expect(preview.getByRole("group", { name: "Page 1 of 2" })).toBeVisible();
    // The text over the drawn page can be read and selected.
    await expect(preview.getByRole("group", { name: "Page 1 of 2" })).toContainText("What an algorithm is");
    await expect(page.getByText("PDF · 5 KB · 2 pages")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download loops-guide.pdf" }).click();
    expect((await download).suggestedFilename()).toBe("loops-guide.pdf");
  });

  test("a file the server refuses keeps the form open with its reason", async ({ page }) => {
    await page.goto(`${CLASS}?tab=Create+content&create=material`);
    await page.getByRole("textbox", { name: /Material title/ }).fill("Code bundle");
    // Named like a PDF, but the bytes are not one.
    await page.getByLabel("Attach file / document").setInputFiles({ name: "bundle.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(page.getByText("This file type is not accepted.", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Material title/ })).toHaveValue("Code bundle");
  });

  test("an Office file is saved without a preview when the server has no converter", async ({ page }) => {
    await page.goto(`${CLASS}?tab=Create+content&create=material`);
    await page.getByRole("textbox", { name: /Material title/ }).fill("Semantic HTML handout");
    await page.getByLabel("Attach file / document").setInputFiles(demoFile("semantic-html-reference.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Material published" })).toBeVisible();

    await openMaterial(page, "Semantic HTML handout");
    await expect(page.getByText("Previews of Word, PowerPoint, and Excel files are turned off on this server.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Download semantic-html-reference.docx" })).toBeEnabled();
  });

  test("the file can be replaced, then removed after confirming", async ({ page }) => {
    await openMaterial(page, "Programming Logic and Pseudocode");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Replace file" }).click();
    await (await chooser).setFiles(demoFile("variables-and-data-types.png", "image/png", "symbols.png"));
    await expect(page.getByRole("status").filter({ hasText: "File replaced" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Programming Logic and Pseudocode" })).toBeVisible();
    await expect(page.getByText(/^PNG · \d+ KB$/)).toBeVisible();

    await page.getByRole("button", { name: "Remove file" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove this file?" });
    await expect(dialog).toContainText("“symbols.png”");
    await dialog.getByRole("button", { name: "Remove file" }).click();
    await expect(page.getByText("No file is attached yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload file" })).toBeVisible();
  });

  test("a seeded PowerPoint shows its PDF copy", async ({ page }) => {
    // Daniel Cruz teaches the class with the seeded PowerPoint.
    await page.addInitScript(() => sessionStorage.setItem("tmcc-viewing-instructor", "instructor-2"));
    await page.goto("/instructor/classes/math?tab=Materials");
    await page.getByRole("main").getByRole("button", { name: "Relational Database Design", exact: true }).click();
    await expect(page.getByRole("region", { name: "Preview of Relational Database Design" }).getByRole("group", { name: /^Page 1 of \d+$/ })).toContainText("Relational Database");
    await expect(page.getByText(/^PowerPoint · 32 KB · \d+ slides$/)).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("the material page has no axe violations, readable text, and no sideways scroll at 320px @mobile", async ({ page }) => {
    await openMaterial(page, "Programming Logic and Pseudocode");
    await expect(page.getByRole("group", { name: "Page 1 of 2" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});

const STUDENT_MATERIALS = "/student/classes/biology?tab=Materials";

test.describe("Student · class materials", () => {
  test("materials are grouped by module, filtered by type, ordered newest first, and searched @all", async ({ page }) => {
    await page.goto(STUDENT_MATERIALS);
    const unit = page.getByRole("region", { name: /^Unit 1 · Foundations/ });
    await expect(unit.getByRole("list", { name: "Materials in Unit 1 · Foundations" }).getByRole("listitem")).toHaveCount(3);
    // Each row says what the file is, how big, and when it was added; no read time.
    await expect(unit.getByRole("button", { name: /^Programming Logic and Pseudocode Study guide · PDF · 5 KB · / })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("min read");

    const rows = page.getByRole("list", { name: /^Materials/ }).getByRole("listitem");
    await page.getByRole("group", { name: "Filter by resource type" }).getByRole("button", { name: /^Reference sheet/ }).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Variables and Data Types/ })).toBeVisible();
    await page.getByRole("group", { name: "Filter by resource type" }).getByRole("button", { name: "All types" }).click();

    await page.getByRole("button", { name: "Newest first" }).click();
    await expect(page.getByRole("list", { name: "Materials, newest first" }).getByRole("listitem")).toHaveCount(3);
    await page.getByRole("searchbox", { name: "Search materials" }).fill("pseudocode");
    await expect(rows).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search materials" }).fill("zzzz-no-match");
    await expect(page.getByRole("main").getByText("No materials found.")).toBeVisible();
  });

  test("a material page previews the file, downloads it, and steps to the next and previous material @all", async ({ page }) => {
    await page.goto(STUDENT_MATERIALS);
    await page.getByRole("button", { name: /^Variables and Data Types/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Variables and Data Types" })).toBeVisible();
    await expect(page.getByText("Introduction to Programming › Unit 1 · Foundations")).toBeVisible();
    await expect(page.getByRole("img", { name: "Variables and Data Types" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark as reviewed/ })).toHaveCount(0);

    await page.getByRole("navigation", { name: "Other materials in this class" }).getByRole("button", { name: /^Next/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Control Flow Practice" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Preview of Control Flow Practice" })).toContainText("Trace each program by hand.");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download control-flow-practice.txt" }).click();
    expect((await download).suggestedFilename()).toBe("control-flow-practice.txt");

    await page.getByRole("navigation", { name: "Other materials in this class" }).getByRole("button", { name: /^Previous/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Variables and Data Types" })).toBeVisible();

    // A page count stays with its own file: back to a PDF, then on to the image again.
    await page.getByRole("navigation", { name: "Other materials in this class" }).getByRole("button", { name: /^Previous/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Programming Logic and Pseudocode" })).toBeVisible();
    await expect(page.getByText("PDF · 5 KB · 2 pages")).toBeVisible();
    await page.getByRole("navigation", { name: "Other materials in this class" }).getByRole("button", { name: /^Next/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Variables and Data Types" })).toBeVisible();
    await expect(page.getByText("PNG · 71 KB", { exact: true })).toBeVisible();
  });

  test("an Office file shows the PDF copy the server made", async ({ page }) => {
    await page.goto("/student/classes/math?tab=Materials");
    await page.getByRole("button", { name: /^SQL Query Workbook/ }).click();
    await expect(page.getByRole("region", { name: "Preview of SQL Query Workbook" }).getByRole("group", { name: /^Page 1 of \d+$/ })).toContainText("customer_id");
    await expect(page.getByText(/^Excel · 6 KB · \d+ pages?$/)).toBeVisible();
  });

  test("a file over 5 MB waits until the student asks for it", async ({ page, sandbox }) => {
    const [module] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
    // A real PNG with 6 MB after its end, which image viewers ignore.
    const png = readFileSync(fileURLToPath(new URL("../../server/src/Lms.Api/Demo/files/variables-and-data-types.png", import.meta.url)));
    const response = await page.request.post(`${API}/api/classes/biology/materials/upload`, {
      headers: { "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": INSTRUCTOR.id, "X-Demo-Role": INSTRUCTOR.role },
      multipart: { moduleId: String(module!.id), title: "Big poster", kind: "Reference sheet", description: "", file: { name: "poster.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]) } },
    });
    expect(response.status()).toBe(201);

    await page.goto(STUDENT_MATERIALS);
    await page.getByRole("button", { name: /^Big poster/ }).click();
    await expect(page.getByText("This file is 6.1 MB.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Big poster" })).toHaveCount(0);
    await page.getByRole("button", { name: "Load preview (6.1 MB)" }).click();
    await expect(page.getByRole("img", { name: "Big poster" })).toBeVisible();
  });

  test("an archived material and its file are gone for students", async ({ page, sandbox }) => {
    const id = demoMaterial("biology-material-1");
    await callApi(page, sandbox, INSTRUCTOR, "PATCH", `/api/classes/biology/materials/${id}`, { status: "archived" });
    await page.goto(STUDENT_MATERIALS);
    await expect(page.getByRole("button", { name: /^Programming Logic and Pseudocode/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Variables and Data Types/ })).toHaveCount(0);
    const file = await page.request.get(`${API}/api/classes/biology/materials/${id}/file`, { headers: { "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": STUDENT.id, "X-Demo-Role": STUDENT.role } });
    expect(file.status()).toBe(404);
  });

  test("the Materials tab and a material page have no axe violations, readable text, and no sideways scroll at 320px @all", async ({ page }) => {
    await page.goto(STUDENT_MATERIALS);
    await expect(page.getByRole("region", { name: /^Unit 1 · Foundations/ })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
    await page.getByRole("button", { name: /^Programming Logic and Pseudocode/ }).click();
    await expect(page.getByRole("group", { name: "Page 1 of 2" })).toBeVisible();
    await expectNoAxeViolations(page);
    await expectReadableText(page);
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.goto(STUDENT_MATERIALS);
    await expect(page.getByRole("region", { name: /^Unit 1 · Foundations/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});

