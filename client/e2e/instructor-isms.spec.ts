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
  await page.route(`${API}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
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

    // A reload keeps the class and its announcement.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Database Systems 1" })).toBeVisible();
  });

  test("the Classes page says the list comes from ISMS and offers no Create class @all", async ({ page }) => {
    await mockIsms(page);
    await page.goto("/instructor/classes");
    await expect(page.getByRole("status").filter({ hasText: "Classes and class lists come from ISMS · 2026-2027 · 1st Semester" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create class/ })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
});
