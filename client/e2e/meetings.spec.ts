import type { Browser, TestInfo } from "@playwright/test";
import { expectNoAxeViolations } from "./a11y";
import { API, DEMO_NOW, expect, openRole, test, type Page } from "./fixtures";

/*
 * Class meetings (D-070): INSTRUCTOR_USER_FLOW MT and STUDENT_USER_FLOW CL-MT. The journeys that
 * join a meeting need a LiveKit media server (E2E_LIVEKIT_URL; meet-server/ locally, a service in
 * CI) and a camera and mic, which only Chromium fakes, so they skip on WebKit.
 */

const live = Boolean(process.env.E2E_LIVEKIT_URL);
if (process.env.E2E_REQUIRE_LIVEKIT === "1" && !live) throw new Error("E2E_REQUIRE_LIVEKIT is set, but E2E_LIVEKIT_URL is not.");
const needsMedia = (browserName: string) => !live || browserName !== "chromium";
const skipReason = "Joining needs a LiveKit server (E2E_LIVEKIT_URL) and Chromium's fake camera and mic.";

const classTab = (page: Page, role: "instructor" | "student", name: RegExp) =>
  page.getByRole("tablist", { name: role === "instructor" ? "Classroom sections" : "Class sections" }).getByRole("tab", { name });
const people = (page: Page) => page.getByRole("list", { name: "People in the meeting" }).getByRole("listitem");

const headers = (sandbox: string, id: string, role: "instructor" | "student") => ({ "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": id, "X-Demo-Role": role });

/** A meeting made straight through the API, as the instructor of Introduction to Programming. */
async function apiMeeting(page: Page, sandbox: string, body: Record<string, unknown>): Promise<number> {
  const response = await page.request.post(`${API}/api/classes/biology/meetings`, { headers: headers(sandbox, "instructor-1", "instructor"), data: body });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: number }).id;
}

/** A second person in the same sandbox: their own browser context (the project's device), clock, and camera permission. */
async function secondPerson(browser: Browser, info: TestInfo, sandbox: string): Promise<{ page: Page; done: () => Promise<void> }> {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, timezoneId } = info.project.use;
  const context = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, timezoneId, permissions: ["camera", "microphone"] });
  const page = await context.newPage();
  await page.clock.install({ time: DEMO_NOW });
  await page.addInitScript((value) => localStorage.setItem("tmcc-demo-sandbox", value), sandbox);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return {
    page,
    done: async () => {
      await context.close();
      expect(errors, "uncaught page errors (second person)").toEqual([]);
    },
  };
}

test.describe("Class meetings @all", () => {
  test("MT → CL-MT: the instructor schedules a meeting, the class sees it, and the instructor deletes it", async ({ page }) => {
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology");
    await classTab(page, "instructor", /^Meetings/).click();
    await expect(page.getByText("No meetings are scheduled.")).toBeVisible();

    await page.getByRole("button", { name: "Schedule a meeting" }).click();
    const dialog = page.getByRole("dialog", { name: "Schedule a meeting" });
    await dialog.getByRole("textbox", { name: "Title" }).fill("Loops review");
    // The clock is pinned to Friday, October 23, 2026, 9:00 in Manila.
    await dialog.getByLabel("Starts").fill("2026-10-26T10:00");
    await dialog.getByRole("button", { name: "Schedule" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Meeting scheduled" })).toBeVisible();
    const loops = page.getByRole("list", { name: "Upcoming meetings" }).getByRole("listitem").filter({ hasText: "Loops review" });
    await expect(loops).toContainText("Mon, Oct 26 · 10:00 AM");

    // Students see it, without the instructor's controls.
    await openRole(page, "student");
    await page.goto("/student/classes/biology?tab=Meetings");
    await expect(page.getByRole("list", { name: "Upcoming meetings" }).getByRole("listitem").filter({ hasText: "Loops review" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start|Delete|Schedule/ })).toHaveCount(0);
    // The class's own meetings replace the Discord link (D-070).
    await expect(page.getByRole("link", { name: /Discord/ })).toHaveCount(0);

    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology?tab=Meetings");
    await page.getByRole("button", { name: "Delete Loops review" }).click();
    await page.getByRole("dialog", { name: "Delete this meeting?" }).getByRole("button", { name: "Delete meeting" }).click();
    await expect(page.getByText("No meetings are scheduled.")).toBeVisible();
  });

  test("MT → CL-MT: the instructor starts a meeting and a student joins from the class page", async ({ page, browser, browserName, sandbox }, info) => {
    test.skip(needsMedia(browserName), skipReason);
    await openRole(page, "instructor");
    await page.goto("/instructor/classes/biology");
    await page.getByRole("button", { name: "Start meeting" }).click();

    // The meeting page is full screen, in the same tab, and opens on the pre-join screen.
    await expect(page).toHaveURL(/\/instructor\/meet\/biology\/\d+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Introduction to Programming meeting" })).toBeFocused();
    await expect(page.getByRole("navigation", { name: "instructor navigation" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Microphone" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Camera" })).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(people(page)).toHaveCount(1);
    await expect(people(page).first()).toHaveAccessibleName("Angela Reyes (you), instructor");

    const { page: student, done } = await secondPerson(browser, info, sandbox);
    await openRole(student, "student");
    await student.goto("/student/classes/biology");
    const banner = student.getByRole("region", { name: "Introduction to Programming meeting" });
    await expect(banner.getByText("Live now")).toBeVisible();
    await banner.getByRole("button", { name: "Join meeting" }).click();
    await expect(student.getByText("Joining as Alex Rivera")).toBeVisible();
    // Students start with the mic off (decision 7); the camera is their choice.
    await expect(student.getByRole("button", { name: "Microphone" })).toHaveAttribute("aria-pressed", "false");
    await student.getByRole("button", { name: "Camera" }).click();
    await expect(student.getByRole("button", { name: "Camera" })).toHaveAttribute("aria-pressed", "true");
    await expect(student.getByLabel("Your camera preview")).toBeVisible();
    await student.getByRole("button", { name: "Join now" }).click();

    await expect(people(student)).toHaveCount(2);
    await expect(people(page)).toHaveCount(2);
    await expect(people(page).filter({ has: page.getByLabel("Alex Rivera's camera") })).toHaveCount(1);
    await expect(people(student).getByText("Angela Reyes")).toBeVisible();
    await expectNoAxeViolations(student);

    await student.getByRole("navigation", { name: "Meeting controls" }).getByRole("button", { name: "Leave" }).click();
    await expect(student.getByRole("heading", { name: "You left the meeting" })).toBeVisible();
    await expect(people(page)).toHaveCount(1);
    await student.getByRole("button", { name: "Back to class" }).click();
    await expect(student.getByRole("heading", { level: 1, name: "Introduction to Programming" })).toBeVisible();
    await expect(classTab(student, "student", /^Meetings/)).toHaveAttribute("aria-selected", "true");
    await done();
  });

  test("CL-MT: a student who opens a meeting before it starts waits, then joins when the instructor starts it", async ({ page, sandbox, browserName }) => {
    test.skip(needsMedia(browserName), skipReason);
    const id = await apiMeeting(page, sandbox, { title: "Lab check-in", scheduledStart: "2026-10-23T09:30:00+08:00" });
    await openRole(page, "student");
    await page.goto(`/student/meet/biology/${id}`);
    await expect(page.getByText("The instructor hasn't started this meeting yet.")).toBeVisible();
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(page.getByRole("heading", { name: "Waiting for the instructor" })).toBeVisible();

    const started = await page.request.post(`${API}/api/classes/biology/meetings/${id}/start`, { headers: headers(sandbox, "instructor-1", "instructor") });
    expect(started.status()).toBe(200);
    await expect(people(page)).toHaveCount(1, { timeout: 15_000 });
    await expect(people(page).first()).toHaveAccessibleName("Alex Rivera (you)");
  });

  test("CL-MT: when students may not turn on their mic or camera, each says why and stays off", async ({ page, sandbox, browserName }) => {
    test.skip(needsMedia(browserName), skipReason);
    // Nothing to publish: the pass says can't-publish, not an empty source list (D-070).
    const id = await apiMeeting(page, sandbox, { startNow: true, settings: { studentsMayUnmute: false, studentsMayVideo: false, studentsJoinMuted: false } });
    await openRole(page, "student");
    await page.goto(`/student/meet/biology/${id}`);
    const mic = page.getByRole("button", { name: "Microphone" });
    await expect(mic).toHaveAttribute("aria-disabled", "true");
    // aria-disabled keeps it focusable and pressable, so it can say why; Playwright would wait for "enabled".
    await mic.click({ force: true });
    await expect(page.getByRole("status").filter({ hasText: "The instructor decides when students can speak." })).toBeVisible();
    await expect(mic).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(people(page)).toHaveCount(1);
    const inMeeting = page.getByRole("navigation", { name: "Meeting controls" }).getByRole("button", { name: "Microphone" });
    await expect(inMeeting).toHaveAttribute("aria-disabled", "true");
    await inMeeting.click({ force: true });
    await expect(page.getByRole("status").filter({ hasText: "The instructor decides when students can speak." })).toBeVisible();
    await expect(inMeeting).toHaveAttribute("aria-pressed", "false");
    const camera = page.getByRole("navigation", { name: "Meeting controls" }).getByRole("button", { name: "Camera" });
    await expect(camera).toHaveAttribute("aria-disabled", "true");
    await camera.click({ force: true });
    await expect(page.getByRole("status").filter({ hasText: "The instructor has turned off cameras for students." })).toBeVisible();
    await expect(camera).toHaveAttribute("aria-pressed", "false");
  });

  test("The meeting page and the live banner don't scroll sideways at 320px", async ({ page, sandbox, browserName }) => {
    test.skip(needsMedia(browserName), skipReason);
    const id = await apiMeeting(page, sandbox, { title: "A meeting with a long title that has to wrap on a small phone", startNow: true });
    await page.setViewportSize({ width: 320, height: 640 });
    await openRole(page, "student");
    await page.goto("/student/classes/biology");
    await expect(page.getByRole("button", { name: "Join meeting" })).toBeVisible();
    const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await sideways(), "class page").toBeLessThanOrEqual(0);

    await page.goto(`/student/meet/biology/${id}`);
    await expect(page.getByRole("button", { name: "Join now" })).toBeVisible();
    expect(await sideways(), "pre-join").toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
    await page.getByRole("button", { name: "Join now" }).click();
    await expect(people(page)).toHaveCount(1);
    expect(await sideways(), "in the meeting").toBeLessThanOrEqual(0);
    await expectNoAxeViolations(page);
  });
});
