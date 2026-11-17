import { expect, openRole, test, type Page, seedHandedInAssignment } from "./fixtures";

// Instructor journeys that FLOW_PARITY marked ✖, written against the classic
// UI before Phase 3 rebuilds it. Letters refer to INSTRUCTOR_USER_FLOW.md.

async function openClass(page: Page) {
  await openRole(page, "instructor");
  await page.getByRole("complementary").getByRole("button", { name: /^IT101 Introduction to Programming/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
}

const tab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Classroom sections" }).getByRole("tab", { name });

async function createBlock(page: Page, note: string) {
  await tab(page, /^Create content/).click();
  await page.locator("header").filter({ hasText: note }).getByRole("button", { name: /Create/ }).click();
}

/** Student submits an instructor-created exam so the instructor has something to review. */
test.describe("Instructor · review entry points (F)", () => {
  // D-032: a multiple-choice exam is graded on submit, so a handed-in assignment is what waits.
  test("a notification opens the pending submission in the class Submissions tab", async ({ page, sandbox }) => {
    const { title } = await seedHandedInAssignment(page, sandbox);
    await openRole(page, "instructor");
    await page.getByRole("banner").getByRole("button", { name: /^Notifications/ }).click();
    await page.getByRole("banner").getByRole("button", { name: new RegExp(title) }).click();
    await expect(tab(page, /^Submissions/)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Save grade" })).toBeVisible();
  });

  test("Review student work on Overview opens the review queue", async ({ page, sandbox }) => {
    await seedHandedInAssignment(page, sandbox);
    await openRole(page, "instructor");
    await expect(page.getByRole("main").getByText("Awaiting review")).toBeVisible();
    await page.getByRole("button", { name: "Review student work" }).click();
    await expect(tab(page, /^Submissions\s?1/)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("Instructor · class content (B, C, D, E)", () => {
  test("NEWS → B1: a teacher announcement opens its class Announcements tab", async ({ page }) => {
    await openClass(page);
    await tab(page, /^Announcements/).click();
    await page.getByRole("main").getByRole("button", { name: /New announcement|Post announcement|\+ Create/ }).first().click();
    await page.getByPlaceholder("Announcement title").fill("Quiz moved to Monday");
    await page.getByPlaceholder("Write an update for your students").fill("Same time and room.");
    await page.getByRole("button", { name: "Post announcement" }).click();

    await page.getByRole("banner").getByRole("button", { name: "Workspace" }).click();
    await page.getByRole("group", { name: "Dashboard content" }).getByRole("button", { name: "News & announcements" }).click();
    await page.getByRole("main").getByRole("button", { name: /Quiz moved to Monday/ }).click();
    await expect(tab(page, /^Announcements/)).toHaveAttribute("aria-selected", "true");
  });

  test("COMPOSE: an announcement needs a title and message; Cancel closes the composer", async ({ page }) => {
    await openClass(page);
    await tab(page, /^Announcements/).click();
    await page.getByRole("main").getByRole("button", { name: /New announcement|Post announcement|\+ Create/ }).first().click();
    await page.getByRole("button", { name: "Post announcement" }).click();
    await expect(tab(page, /^Announcements\s?0/)).toBeVisible();
    await expect(page.getByPlaceholder("Announcement title")).toHaveAttribute("maxlength", "120");
    await expect(page.getByPlaceholder("Write an update for your students")).toHaveAttribute("maxlength", "1200");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("Announcement title")).toHaveCount(0);
  });

  test("E: material form adds a material to the Materials tab", async ({ page }) => {
    await openClass(page);
    await createBlock(page, "Readings, guides, lecture slides, and files");
    await page.getByRole("textbox", { name: /Material title/ }).fill("Recursion cheat sheet");
    await page.getByRole("combobox", { name: "Resource type" }).selectOption("Reference sheet");
    await page.getByRole("button", { name: "Save and publish" }).click();
    await expect(tab(page, /^Materials/)).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, /^Materials\s?4/)).toBeVisible();
    await expect(page.getByRole("main").getByText("Recursion cheat sheet")).toBeVisible();
  });

  // D-040: assessments moved from the inline form to the assessment builder page; the journey's intent is unchanged.
  test("E: the assessment builder adds a one-question assessment to Classwork", async ({ page }) => {
    await openClass(page);
    await createBlock(page, "Build and publish a quiz or exam");
    await expect(page.getByRole("heading", { level: 1, name: "New assessment" })).toBeVisible();
    await page.getByRole("textbox", { name: /^Assessment title/ }).fill("Pop quiz: loops");
    await page.getByRole("button", { name: /^Add question/ }).click();
    await page.getByRole("menuitem", { name: /^Multiple choice/ }).click();
    await page.getByRole("textbox", { name: "Question 1", exact: true }).fill("Which loop always runs at least once?");
    for (const [letter, text] of [["a", "do…while"], ["b", "for"], ["c", "while"], ["d", "for…of"]] as const) {
      await page.getByRole("textbox", { name: `Question 1, choice ${letter}` }).fill(text);
    }
    await page.getByRole("radio", { name: "Choice a of question 1 is Correct" }).check();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(tab(page, /^Classwork\s?4/)).toBeVisible();
    await expect(page.getByRole("main").getByText("Pop quiz: loops")).toBeVisible();
  });

  test("D: Classwork search and type filter narrow the list", async ({ page }) => {
    await openClass(page);
    await tab(page, /^Classwork/).click();
    const main = page.getByRole("main");
    await expect(main.getByText("Unit Exam: Programming Fundamentals")).toBeVisible();
    await main.getByRole("textbox", { name: "Search classwork" }).fill("variables");
    await expect(main.getByText("Unit Exam: Programming Fundamentals")).toHaveCount(0);
    await expect(main.getByText("Quiz 03: Variables and Data Types")).toBeVisible();
    await main.getByRole("textbox", { name: "Search classwork" }).fill("");
    await main.getByRole("button", { name: /^Assignments/ }).click();
    await expect(main.getByText("Quiz 03: Variables and Data Types")).toHaveCount(0);
  });

  test("C: a material can be archived and restored", async ({ page }) => {
    await openClass(page);
    await tab(page, /^Materials/).click();
    const main = page.getByRole("main");
    await main.getByRole("button", { name: /^Archive/ }).first().click();
    await expect(main.getByRole("button", { name: /^Restore/ })).toHaveCount(1);
    await main.getByRole("button", { name: /^Restore/ }).click();
    await expect(main.getByRole("button", { name: /^Restore/ })).toHaveCount(0);
  });
});

test.describe("Instructor · gradebook (G)", () => {
  test("SETTINGS: weights and passing score are saved per classroom", async ({ page }) => {
    await openRole(page, "instructor");
    await page.getByRole("navigation", { name: "instructor navigation" }).getByRole("button", { name: "Gradebook" }).click();
    const activity = page.getByRole("spinbutton", { name: "Activity weight" });
    await expect(activity).toHaveValue("40");
    await activity.fill("30");
    await page.getByRole("spinbutton", { name: "Exam weight" }).fill("70");
    // Saved once the weights add up to 100 (D-032).
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
    await page.reload();
    await page.getByRole("navigation", { name: "instructor navigation" }).getByRole("button", { name: "Gradebook" }).click();
    await expect(page.getByRole("spinbutton", { name: "Activity weight" })).toHaveValue("30");
    await expect(page.getByRole("spinbutton", { name: "Exam weight" })).toHaveValue("70");
    await expect(page.getByRole("spinbutton", { name: "Passing score" })).toHaveValue("60");
  });
});
