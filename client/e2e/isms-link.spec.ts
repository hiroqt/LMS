import { expectNoAxeViolations, expectReadableText } from "./a11y";
import { API, expect, test, type Page } from "./fixtures";

// /isms-link (D-030): the first server-backed page. Its ISMS states (down,
// unauthorised, …) cannot be produced by the Demo-mode API, so requests are mocked. The API is
// cross-origin (the suite's Demo-mode API port), so mocked responses carry
// the CORS header the real API must send too.

const syncedAt = "2026-10-23T08:30:00Z";
const list = (items: unknown[]) => ({ items, source: "isms", syncedAt });

// Fictional records only.
const responses: Record<string, unknown> = {
  "/api/isms/status": { reachable: true, authorized: true, checkedAt: "2026-10-23T08:59:00Z", detail: "Signed in to ISMS." },
  "/api/instructors": list([
    { id: "EMP-1", employeeNo: "1001", firstName: "Dana", middleName: "Cruz", lastName: "Reyes", suffix: "", honorific: "Prof.", departmentId: "IT", status: "Active" },
  ]),
  "/api/classes": list([
    { id: "C-1", scheduleId: "S-1", subjectId: 1, subjectCode: "IT101", subjectName: "Introduction to Computing", sectionId: 10, sectionName: "BSIT 1-A", instructorId: "EMP-1", instructorName: "Dana Reyes", schoolYearId: 2026, semesterId: 1, meetings: [{ day: "Mon", timeFrom: "08:00", timeTo: "09:30", roomId: 12, modality: 1 }] },
  ]),
  "/api/classes/C-1/students": list([
    { studentId: "2026-0001", enrollmentId: "E-1", firstName: "Ana", middleName: "Mae", lastName: "Abad" },
  ]),
  "/api/subjects": list([{ id: 1, code: "IT101", name: "Introduction to Computing", units: 3, status: "Active" }]),
};

async function mockApi(page: Page, mode: "up" | "down") {
  await page.route(`${API}/api/**`, async (route) => {
    if (mode === "down") return route.abort("connectionrefused");
    const body = responses[new URL(route.request().url()).pathname];
    if (body === undefined) return route.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, json: { title: "Not Found" } });
    return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, json: body });
  });
}

test.describe("ISMS connection (/isms-link)", () => {
  test("shows status, classes with their students, and subjects from the LMS API @all", async ({ page }) => {
    await mockApi(page, "up");
    await page.goto("/isms-link");
    await expect(page.getByRole("heading", { level: 1, name: "ISMS connection" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "About this data" })).toContainText("Read-only.");

    await expect(page.getByText("Authorized")).toBeVisible();
    const classes = page.getByRole("list", { name: "Classes from ISMS" });
    await expect(classes.getByRole("heading", { level: 3, name: "Introduction to Computing" })).toBeVisible();
    await expect(classes.getByText("Mon 08:00–09:30")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Instructor" })).toBeEnabled();
    await expect(page.getByRole("table", { name: "Subjects from ISMS" }).getByRole("rowheader", { name: "Introduction to Computing" })).toBeVisible();

    // Keyboard only: reach the roster toggle and open it.
    const toggle = page.getByRole("button", { name: "Show students for IT101 BSIT 1-A" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    const hide = page.getByRole("button", { name: "Hide students for IT101 BSIT 1-A" });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    await expect(hide).toBeFocused();
    await expect(page.getByRole("region", { name: "Students in IT101 BSIT 1-A" }).getByText("Abad, Ana Mae")).toBeVisible();

    await expectNoAxeViolations(page);
    await expectReadableText(page);
  });

  test("says plainly when the LMS API is not running @all", async ({ page }) => {
    await mockApi(page, "down");
    await page.goto("/isms-link");
    await expect(page.getByRole("heading", { level: 1, name: "ISMS connection" })).toBeVisible();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("The LMS API is not running");
    await expect(alert).toContainText(`No response from ${API}`);
    await expect(page.getByRole("button", { name: "Retry classes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry subjects" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("no sideways scroll at 320px @mobile", async ({ page }) => {
    await mockApi(page, "up");
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/isms-link");
    await expect(page.getByRole("list", { name: "Classes from ISMS" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Subjects from ISMS" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
