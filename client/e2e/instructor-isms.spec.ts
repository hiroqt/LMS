import { expectNoAxeViolations } from "./a11y";
import { expect, openRole, test, type Page } from "./fixtures";

// D-031: the Instructor workspace takes its classes and class lists from ISMS
// through the LMS API. The API is not part of this suite, so it is mocked.

const API = "http://localhost:5200";
const syncedAt = "2026-10-23T08:30:00Z";
const term = { schoolYearId: 2, schoolYearName: "2026-2027", semesterId: 1, semesterName: "1st Semester" };

// Fictional records only.
const klass = { id: "C-1", scheduleId: "S-1", subjectId: 5, subjectCode: "IT202", subjectName: "Database Systems 1", sectionId: 2, sectionName: "BSIT 2-A", instructorId: "EMP-3", instructorName: "Nerissa Asterwood", schoolYearId: 2, semesterId: 1, meetings: [{ day: "TTH", timeFrom: "10:00", timeTo: "11:30", roomId: 203, modality: 1 }] };
const students = [
  { studentId: "STU-1", enrollmentId: "E-1", firstName: "Ana", middleName: "Mae", lastName: "Abad" },
  { studentId: "STU-2", enrollmentId: "E-2", firstName: "Ben", middleName: "Luis", lastName: "Cortez" },
];

async function mockIsms(page: Page) {
  const requests: string[] = [];
  const content = { modules: [] as object[], materials: [] as object[], announcements: [] as object[], nextOffset: null };
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Demo-Instructor-Id", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };
  await page.route(`${API}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.pathname.startsWith("/api/classes/C-1/content")) {
      expect(request.headers()["x-demo-instructor-id"]).toBe("EMP-3");
      if (request.method() === "POST") {
        const input = request.postDataJSON();
        const item = { ...input, id: 1, classId: "C-1", status: "active", createdBy: "EMP-3", createdAt: syncedAt };
        if (url.pathname.endsWith("/modules")) content.modules.push(item);
        if (url.pathname.endsWith("/materials")) content.materials.push(item);
        if (url.pathname.endsWith("/announcements")) content.announcements.push(item);
        return route.fulfill({ status: 201, headers: cors, json: item });
      }
      return route.fulfill({ status: 200, headers: cors, json: content });
    }
    const body =
      url.pathname === "/api/classes" ? { items: [klass], source: "isms", syncedAt, term }
      : url.pathname === "/api/classes/C-1/students" ? { items: students, source: "isms", syncedAt }
      : undefined;
    return body
      ? route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, json: body })
      : route.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, json: { title: "Not Found" } });
  });
  return requests;
}

test.describe("Instructor · classes from ISMS", () => {
  test("an ISMS instructor sees their ISMS class with its class list and can add work to it", async ({ page }) => {
    const requests = await mockIsms(page);
    await openRole(page, "instructor");

    // The ISMS instructor joins the demo instructors.
    await page.getByRole("combobox", { name: "Choose demo instructor" }).selectOption({ label: "Nerissa Asterwood" });
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("button", { name: "My classes 1" })).toBeVisible();
    expect(requests).toContain("/api/classes?term=current");

    await sidebar.getByRole("button", { name: /IT202 Database Systems 1/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Database Systems 1" })).toBeVisible();
    await expect(page.getByRole("main").getByText("BSIT 2-A").first()).toBeVisible();
    await expect(page.getByRole("main").getByText("TTH 10:00–11:30")).toBeVisible();
    await expect(page.getByRole("main").getByText("This class and its class list come from ISMS.")).toBeVisible();

    // The class list is the ISMS enrollment.
    await page.getByRole("tab", { name: /^People/ }).click();
    await expect(page.getByRole("main").getByText("Ana Abad")).toBeVisible();
    await expect(page.getByRole("main").getByText("Ben Cortez")).toBeVisible();

    // LMS-owned work can be added to an ISMS class.
    await page.getByRole("tab", { name: /^Announcements/ }).click();
    await page.getByRole("button", { name: "New announcement" }).click();
    await page.getByRole("textbox", { name: "Title" }).fill("Bring your laptops");
    await page.getByRole("textbox", { name: "Message" }).fill("We start SQL on Thursday.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByRole("main").getByText("Bring your laptops")).toBeVisible();

    if (!process.env.E2E_PREVIEW) {
      expect(requests).toContain("/api/classes/C-1/content/announcements");
      await page.getByRole("tab", { name: /^Create content/ }).click();
      await page.getByRole("textbox", { name: "New module title" }).fill("SQL basics");
      await page.getByRole("button", { name: "Create module", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Module created" })).toBeVisible();
      await page.getByRole("button", { name: /Create material/ }).click();
      await page.getByRole("combobox", { name: "Curriculum Unit / Module" }).selectOption({ label: "SQL basics" });
      await page.getByRole("textbox", { name: "Material title" }).fill("SQL reference");
      await page.getByRole("button", { name: "Save and publish" }).click();
      await expect(page.getByRole("button", { name: "SQL reference", exact: true })).toBeVisible();
      expect(requests).toContain("/api/classes/C-1/content/materials");
    }

    // A reload keeps the class and its announcement.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Database Systems 1" })).toBeVisible();
    if (!process.env.E2E_PREVIEW) {
      await expect(page.getByRole("button", { name: "SQL reference", exact: true })).toBeVisible();
    }
    await page.getByRole("tab", { name: /^Announcements/ }).click();
    await expect(page.getByRole("main").getByText("Bring your laptops")).toBeVisible();
  });

  test("content forms keep their values while a save is pending or rejected", async ({ page }) => {
    test.skip(Boolean(process.env.E2E_PREVIEW), "The content API is development-only.");
    await mockIsms(page);
    await openRole(page, "instructor");
    await page.getByRole("combobox", { name: "Choose demo instructor" }).selectOption({ label: "Nerissa Asterwood" });
    await page.getByRole("complementary").getByRole("button", { name: /IT202 Database Systems 1/ }).click();
    await page.getByRole("tab", { name: /^Announcements/ }).click();
    await page.getByRole("button", { name: "New announcement" }).click();
    const title = page.getByRole("textbox", { name: "Title", exact: true });
    const message = page.getByRole("textbox", { name: "Message", exact: true });
    await title.fill("Keep this draft");
    await message.fill("The server may reject this request.");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`${API}/api/classes/C-1/content/announcements`, async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Demo-Instructor-Id", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
      await pending;
      return route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" }, json: { title: "Content unavailable" } });
    });
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(title).toBeDisabled();
    await expect(message).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    release();
    await expect(title).toBeEnabled();
    await expect(message).toBeEnabled();
    await expect(title).toHaveValue("Keep this draft");
    await expect(message).toHaveValue("The server may reject this request.");
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
  });

  test("the Classes page says the list comes from ISMS and offers no Create class @all", async ({ page }) => {
    await mockIsms(page);
    await page.goto("/instructor/classes");
    await expect(page.getByRole("status").filter({ hasText: "Classes and class lists come from ISMS · 2026-2027 · 1st Semester" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create class/ })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
});
