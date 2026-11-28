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

/** An instructor and a student in a live meeting together: the instructor on `page`, the student in their own context. */
async function together(page: Page, browser: Browser, info: TestInfo, sandbox: string, settings: Record<string, unknown> = {}) {
  const id = await apiMeeting(page, sandbox, { title: "Lecture 7", startNow: true, settings });
  await openRole(page, "instructor");
  await page.goto(`/instructor/meet/biology/${id}`);
  await page.getByRole("button", { name: "Join now" }).click();
  const second = await secondPerson(browser, info, sandbox);
  await openRole(second.page, "student");
  await second.page.goto(`/student/meet/biology/${id}`);
  await second.page.getByRole("button", { name: "Join now" }).click();
  await expect(people(page)).toHaveCount(2);
  await expect(people(second.page)).toHaveCount(2);
  return { id, student: second.page, done: second.done };
}

const controls = (page: Page) => page.getByRole("navigation", { name: "Meeting controls" });

/** Closes the chat or people panel: a column on wide screens, a sheet on phones (which hides the rest of the page). */
async function closePanel(page: Page, name: "Chat" | "People") {
  const sheet = page.getByRole("dialog", { name });
  if (await sheet.isVisible()) await sheet.getByRole("button", { name: "Close" }).click();
  else await page.getByRole("button", { name: `Close ${name.toLowerCase()}` }).click();
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
    // Camera on, then Join at once: Join waits for the camera, so it joins with it (and doesn't leave it on behind).
    await page.getByRole("button", { name: "Camera" }).click();
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
    await expect(student.getByLabel("Angela Reyes's camera")).toBeVisible();
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

  test("CL-MT: in the meeting, chat goes both ways, links open, and everyone sees when it is saved", async ({ page, browser, browserName, sandbox }, info) => {
    test.skip(needsMedia(browserName), skipReason);
    const { id, student, done } = await together(page, browser, info, sandbox);

    await controls(student).getByRole("button", { name: "Chat" }).click();
    const box = student.getByRole("textbox", { name: "Message" });
    await box.fill("Is the quiz on Friday? The notes: https://example.org/notes");
    await box.press("Enter");
    const studentLog = student.getByRole("log", { name: "Chat messages" });
    await expect(studentLog.getByText("Is the quiz on Friday?")).toBeVisible();
    await expect(box).toHaveValue("");

    // The instructor sees an unread count on Chat, and the link is a link.
    await expect(controls(page).getByRole("button", { name: "Chat 1 unread" })).toBeVisible();
    await controls(page).getByRole("button", { name: "Chat 1 unread" }).click();
    const log = page.getByRole("log", { name: "Chat messages" });
    await expect(log.getByText("Alex Rivera")).toBeVisible();
    await expect(log.getByRole("link", { name: "https://example.org/notes (opens in a new tab)" })).toHaveAttribute("href", "https://example.org/notes");
    // On a phone the panel is a sheet over the controls; on a computer Chat shows as pressed beside it.
    if (!info.project.use.isMobile) await expect(controls(page).getByRole("button", { name: "Chat", exact: true })).toHaveAttribute("aria-pressed", "true");

    // Saving turned on (the instructor's settings come in Phase 2c; here through the API): everyone is told.
    const saved = await page.request.patch(`${API}/api/classes/biology/meetings/${id}`, { headers: headers(sandbox, "instructor-1", "instructor"), data: { settings: { saveChat: true } } });
    expect(saved.status()).toBe(200);
    await expect(student.getByText("This chat is being saved.")).toBeVisible();
    await expect(page.getByText("This chat is being saved.")).toBeVisible();
    await page.getByRole("textbox", { name: "Message" }).fill("Yes, at 9.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(studentLog.getByText("Yes, at 9.")).toBeVisible();
    await expectNoAxeViolations(page);
    await done();
  });

  test("CL-MT: a raised hand and a reaction reach the instructor", async ({ page, browser, browserName, sandbox }, info) => {
    test.skip(needsMedia(browserName), skipReason);
    const { student, done } = await together(page, browser, info, sandbox);

    await controls(student).getByRole("button", { name: "Raise hand" }).click();
    await expect(controls(student).getByRole("button", { name: "Raise hand" })).toHaveAttribute("aria-pressed", "true");
    await expect(people(page).filter({ hasText: "Hand raised" })).toHaveAccessibleName("Alex Rivera, hand raised");
    await controls(page).getByRole("button", { name: "People" }).click();
    // Raised hands come first, with when they went up.
    const first = page.getByRole("list", { name: "People", exact: true }).getByRole("listitem").first();
    await expect(first).toContainText("Alex Rivera");
    await expect(first).toContainText("Hand raised");
    await closePanel(page, "People");

    await controls(student).getByRole("button", { name: "Raise hand" }).click();
    await expect(people(page).filter({ hasText: "Hand raised" })).toHaveCount(0);

    await controls(student).getByRole("button", { name: "Reactions" }).click();
    await student.getByRole("button", { name: "Clapping" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alex Rivera reacted: Clapping" })).toBeAttached();
    await expect(people(page).filter({ hasText: "Clapping" })).toHaveCount(1);
    await done();
  });

  test("CL-MT: a shared screen fills the meeting for everyone", async ({ page, browser, browserName, sandbox, isMobile }, info) => {
    test.skip(needsMedia(browserName) || isMobile, "Sharing a screen needs a computer's browser.");
    const { student, done } = await together(page, browser, info, sandbox);
    await controls(page).getByRole("button", { name: "Share screen" }).click();
    await expect(page.getByText("You're sharing your screen.")).toBeVisible();
    await expect(student.getByRole("region", { name: "Angela Reyes's shared screen" })).toBeVisible();
    await expect(student.getByText("Angela Reyes is presenting")).toBeVisible();
    // Everyone stays in the strip beside it.
    await expect(people(student)).toHaveCount(2);
    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(student.getByRole("region", { name: "Angela Reyes's shared screen" })).toHaveCount(0);
    // Students can't share unless the instructor lets them.
    await expect(controls(student).getByRole("button", { name: "Share screen" })).toHaveAttribute("aria-disabled", "true");
    await done();
  });

  test("CL-MT: pin someone, and Data saver stops other people's video", async ({ page, browser, browserName, sandbox }, info) => {
    test.skip(needsMedia(browserName), skipReason);
    const { student, done } = await together(page, browser, info, sandbox);
    await controls(student).getByRole("button", { name: "Camera" }).click();
    await expect(page.getByLabel("Alex Rivera's camera")).toBeVisible();

    await page.getByRole("button", { name: "Pin Alex Rivera" }).click();
    await expect(page.getByRole("group", { name: "Alex Rivera" })).toBeVisible();
    await page.getByRole("button", { name: "Unpin Alex Rivera" }).first().click();
    await expect(page.getByRole("group", { name: "Alex Rivera" })).toHaveCount(0);

    await controls(page).getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Data saver" }).click();
    await expect(page.getByRole("button", { name: "Data saver" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Video paused (Data saver)")).toBeVisible();
    await expect(page.getByLabel("Alex Rivera's camera")).toHaveCount(0);
    await page.getByRole("button", { name: "Data saver" }).click();
    await expect(page.getByLabel("Alex Rivera's camera")).toBeVisible();

    // Speaker view puts one person large.
    await page.getByRole("group", { name: "Layout" }).getByRole("button", { name: "Speaker" }).click();
    await expect(page.getByRole("group", { name: "Alex Rivera" })).toBeVisible();
    await done();
  });

  test("CL-MT: on a phone, chat opens as a sheet and the controls fit at 320px @mobile", async ({ page, browser, browserName, sandbox }, info) => {
    test.skip(needsMedia(browserName), skipReason);
    const { student, done } = await together(page, browser, info, sandbox);
    await student.setViewportSize({ width: 320, height: 640 });
    await controls(student).getByRole("button", { name: "Chat" }).click();
    const sheet = student.getByRole("dialog", { name: "Chat" });
    await sheet.getByRole("textbox", { name: "Message" }).fill("On my phone");
    await sheet.getByRole("button", { name: "Send" }).click();
    await expect(sheet.getByRole("log", { name: "Chat messages" }).getByText("On my phone")).toBeVisible();
    await expect(page.getByRole("button", { name: "Chat 1 unread" })).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    expect(await student.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expectNoAxeViolations(student);
    await done();
  });
});
