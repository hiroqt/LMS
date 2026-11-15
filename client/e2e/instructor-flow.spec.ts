import { expect, openRole, test, type Page } from "./fixtures";

// Journeys from docs/INSTRUCTOR_USER_FLOW.md. Letters refer to the chart connectors.

const CLASS_BUTTON = /^IT101 Introduction to Programming/;

async function openClass(page: Page) {
  await openRole(page, "instructor");
  await page.getByRole("complementary").getByRole("button", { name: CLASS_BUTTON }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
}

function classTab(page: Page, name: RegExp) {
  return page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });
}

test.describe("Instructor · Overview", () => {
  test("HOME → OVERVIEW: teaching day dashboard and News & announcements", async ({ page }) => {
    await openRole(page, "instructor");
    await expect(page.getByRole("heading", { level: 1, name: "Your teaching day" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Classes in progress" })).toBeVisible();

    const views = page.getByRole("group", { name: "Dashboard content" });
    await views.getByRole("button", { name: "News & announcements" }).click();
    await expect(views.getByRole("button", { name: "News & announcements" })).toHaveAttribute("aria-pressed", "true");
  });

  test("CHOOSE: switching the demo instructor changes the assigned classes", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("combobox", { name: "Choose demo instructor" }).selectOption({ label: "Daniel Cruz" });
    await expect(page.getByRole("heading", { name: /Good morning, Daniel/ })).toBeVisible();
  });
});

test.describe("Instructor · Class workspace", () => {
  test("A → TABS: a class opens on Stream and every tab is reachable", async ({ page }) => {
    await openClass(page);
    await expect(classTab(page, /^Stream/)).toHaveAttribute("aria-selected", "true");
    for (const name of [/^Classwork/, /^Announcements/, /^Materials/, /^People/, /^Submissions/, /^Create content/]) {
      await classTab(page, name).click();
      await expect(classTab(page, name)).toHaveAttribute("aria-selected", "true");
    }
  });

  test("People: roster search filters enrolled students", async ({ page }) => {
    await openClass(page);
    await classTab(page, /^People/).click();
    await page.getByRole("textbox", { name: "Search students" }).fill("zzzz-no-match");
    await expect(page.getByText("No students match your search.")).toBeVisible();
  });

  test("B: posting an announcement shows it in the class and in the Student class Stream", async ({ page }) => {
    await openClass(page);
    await classTab(page, /^Announcements/).click();
    await page.getByRole("main").getByRole("button", { name: /New announcement|Post announcement|\+ Create/ }).first().click();

    const title = "Lab moved to Room 204";
    await page.getByPlaceholder("Announcement title").fill(title);
    await page.getByPlaceholder("Write an update for your students").fill("Bring your laptops on Friday.");
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(page.getByRole("main").getByText(title)).toBeVisible();
    await expect(classTab(page, /^Announcements\s?1/)).toBeVisible();

    // Student-facing result (connector B → STUDENTNOTICE).
    await page.goto("/student");
    await page.getByRole("navigation", { name: "My classes" }).getByRole("button", { name: /Introduction to Programming/ }).click();
    await expect(page.getByRole("main").getByRole("heading", { name: title })).toBeVisible();
  });

  test("K: creating a class opens it with a starter workspace", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("complementary").getByRole("button", { name: "+ Create class" }).click();
    await expect(page.getByRole("heading", { name: "Create a class" })).toBeVisible();

    await page.getByRole("combobox", { name: "Subject" }).selectOption({ label: "IT230 · Computer Networking" });
    await page.getByRole("combobox", { name: "Year level" }).selectOption({ label: "Year 2" });
    await page.getByRole("textbox", { name: "Section" }).fill("Section Z");
    await page.getByRole("button", { name: "Create class", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Computer Networking" })).toBeVisible();
    await expect(page.getByRole("complementary").getByRole("button", { name: "My classes 2" })).toBeVisible();
  });

  test("K: cancelling class creation closes the form", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("complementary").getByRole("button", { name: "+ Create class" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Create a class" })).toBeHidden();
  });
});

test.describe("Instructor · Grading round trip", () => {
  // Uses an assignment because exam feedback has no Student entry point after
  // the result screen (see docs/ui-memory/LEARNINGS.md, "exam feedback gap").
  test("E → I → F → J: instructor publishes an assignment, student submits, instructor grades, student sees feedback", async ({ page }) => {
    const title = "Trace a loop by hand";

    // E: publish an assignment from Create content.
    await openClass(page);
    await classTab(page, /^Create content/).click();
    await page.locator("header").filter({ hasText: "Collect student work and provide feedback" }).getByRole("button", { name: /Create/ }).click();
    await expect(page.getByRole("heading", { name: "Create an assignment" })).toBeVisible();
    await page.getByRole("textbox", { name: /^Assignment title/ }).fill(title);
    await page.getByRole("textbox", { name: "Instructions" }).fill("Write each iteration's variable values.");
    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(classTab(page, /^Classwork\s?4/)).toBeVisible();

    // I: the student opens the assignment and submits a filename and comment.
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Tasks" }).click();
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.getByRole("textbox", { name: "Attachment filename" }).fill("loop-trace.pdf");
    await page.getByRole("textbox", { name: "Comment for instructor" }).fill("Done on paper, scanned.");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText(/Waiting for instructor review/)).toBeVisible();

    // F: the submission is waiting in the instructor's review queue.
    await openClass(page);
    await expect(classTab(page, /^Submissions\s?1/)).toBeVisible();
    await classTab(page, /^Submissions/).click();
    await page.getByRole("main").getByRole("button", { name: new RegExp(title) }).first().click();

    // SCORE → VALID: an out-of-range score keeps it pending; a valid one saves.
    const score = page.getByRole("main").getByRole("spinbutton").first();
    await score.fill("9999");
    await page.getByRole("button", { name: "Save grade" }).click();
    await expect(classTab(page, /^Submissions\s?1/)).toBeVisible();
    await score.fill("8");
    await page.getByPlaceholder("Optional feedback").fill("Clear trace, check the last iteration.");
    await page.getByRole("button", { name: "Save grade" }).click();
    await expect(classTab(page, /^Submissions\s?0/)).toBeVisible();

    // J: the matching Student work detail (via CL → Classwork) shows the score and feedback.
    await openRole(page, "student");
    await page.getByRole("navigation", { name: "My classes" }).getByRole("button", { name: /Introduction to Programming/ }).click();
    await page.getByRole("tablist").getByRole("tab", { name: /^Classwork/ }).click();
    await page.getByRole("main").getByRole("button", { name: new RegExp(title) }).first().click();
    await expect(page.getByText(/8 \/ 10 points/)).toBeVisible();
    await expect(page.getByText(/Clear trace, check the last iteration\./)).toBeVisible();
  });
});

test.describe("Instructor · Gradebook", () => {
  test("G: gradebook shows classroom settings", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("navigation", { name: "instructor navigation" }).getByRole("button", { name: "Gradebook" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Gradebook/i);
    await expect(page.getByRole("main").getByRole("spinbutton").first()).toBeVisible();
  });
});

test.describe("Instructor · Mobile @mobile", () => {
  test("navigation drawer opens and reaches a class on a phone", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("complementary").getByRole("button", { name: CLASS_BUTTON }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
