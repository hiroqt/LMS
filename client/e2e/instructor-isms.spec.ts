import { expectNoAxeViolations } from "./a11y";
import { expect, openRole, test } from "./fixtures";

// D-031, D-032: the Instructor workspace takes its classes and class lists from
// ISMS through the LMS API. The suite's Demo-mode API serves the fictional seed
// through its built-in fake ISMS.

test.describe("Instructor · classes from ISMS", () => {
  test("an instructor sees their ISMS class with its class list and can add work to it", async ({ page }) => {
    await openRole(page, "instructor");
    const sidebar = page.getByRole("complementary");
    await expect(sidebar.getByRole("button", { name: "My classes 1" })).toBeVisible();

    await sidebar.getByRole("button", { name: /IT101 Introduction to Programming/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    await expect(page.getByRole("main").getByText("This class and its class list come from ISMS.")).toBeVisible();

    // The class list is the ISMS enrollment.
    await page.getByRole("tab", { name: /^People/ }).click();
    await expect(page.getByRole("main").getByText("Alex Rivera")).toBeVisible();
    await expect(page.getByRole("main").getByText("Elijah Dela Cruz")).toBeVisible();

    // LMS-owned work can be added to an ISMS class, and it is saved on the server.
    await page.getByRole("tab", { name: /^Announcements/ }).click();
    await page.getByRole("main").getByRole("button", { name: /New announcement|Post announcement|\+ Create/ }).first().click();
    await page.getByPlaceholder("Announcement title").fill("Bring your laptops");
    await page.getByPlaceholder("Write an update for your students").fill("We start loops on Thursday.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByRole("main").getByText("Bring your laptops")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    await page.getByRole("tab", { name: /^Announcements/ }).click();
    await expect(page.getByRole("main").getByText("Bring your laptops")).toBeVisible();
  });

  test("the Classes page says the list comes from ISMS and offers no Create class @all", async ({ page }) => {
    await page.goto("/instructor/classes");
    await expect(page.getByRole("status").filter({ hasText: "Classes and class lists come from ISMS · 2026-2027 · 1st Semester" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create class/ })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
});
