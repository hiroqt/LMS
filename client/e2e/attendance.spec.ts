import { expect, openRole, test, type Page } from "./fixtures";

// Monthly attendance (D-035): INSTRUCTOR_USER_FLOW AT and STUDENT_USER_FLOW CL-AT.
// Recorded only; attendance is not part of the gradebook yet.

const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });
const row = (page: Page, name: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name }) });

test.describe("Attendance @all", () => {
  test("AT → CL-AT: the instructor records October and the student sees their %", async ({ page }) => {
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology");
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    await tab(page, /^Attendance/).click();
    await expect(tab(page, /^Attendance/)).toHaveAttribute("aria-selected", "true");

    // The clock is pinned to October 23, 2026, so October is chosen.
    await expect(page.getByRole("combobox", { name: "Month" })).toHaveValue("2026-10");
    await page.getByRole("spinbutton", { name: "School days" }).fill("20");
    await page.getByRole("spinbutton", { name: "Days present, Alex Rivera" }).fill("18");
    await expect(row(page, "Alex Rivera").getByRole("cell", { name: "90%" })).toBeVisible();

    // Days present above the school days are refused with a field error and nothing is saved.
    await page.getByRole("spinbutton", { name: "Days present, Jamie Lee" }).fill("21");
    await page.getByRole("button", { name: "Save attendance" }).click();
    await expect(page.getByRole("spinbutton", { name: "Days present, Jamie Lee" })).toHaveAccessibleDescription("Enter days present from 0 to 20.");

    await page.getByRole("spinbutton", { name: "Days present, Jamie Lee" }).fill("19");
    await expect(row(page, "Jamie Lee").getByRole("cell", { name: "95%" })).toBeVisible();
    await page.getByRole("button", { name: "Save attendance" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Month" }).getByRole("option", { name: "October 2026 · recorded" })).toBeAttached();

    await openRole(page, "student");
    await page.goto("/student/classes/biology?tab=Attendance");
    await expect(page.getByRole("tab", { name: "Attendance" })).toHaveAttribute("aria-selected", "true");
    const october = row(page, "October 2026");
    await expect(october.getByRole("cell", { name: "90%" })).toBeVisible();
    await expect(october.getByRole("cell", { name: "18", exact: true })).toBeVisible();
    // Only Alex's own days reach Alex.
    await expect(page.getByRole("main").getByText("95%")).toHaveCount(0);
  });

  test("CL-AT: a class with nothing recorded says so", async ({ page }) => {
    await openRole(page, "student");
    await page.goto("/student/classes/biology?tab=Attendance");
    await expect(page.getByText("No attendance has been recorded for this class yet.")).toBeVisible();
  });
});
