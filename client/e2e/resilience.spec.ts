import { expect, test, demoAssessment } from "./fixtures";

// Phase 4: slow and lost connections, reduced motion, and forced colors.
// Offline and Slow 3G need the production build (service worker, bundled
// assets): run with E2E_PREVIEW=1, as CI does. They use Chromium-only APIs.

const preview = Boolean(process.env.E2E_PREVIEW);

test.describe("Lost connection (production build)", () => {
  test.skip(!preview, "Needs the service worker from the production build (E2E_PREVIEW=1).");

  // Changed with D-032: work is saved by the LMS API, so taking a quiz needs a connection until the
  // persisted cache and outbox arrive (D-020). Offline, the cached app still opens and says why it waits.
  test("after one visit, the Student UI opens offline and says it needs a connection", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Service worker control is only automated in Chromium.");
    await page.goto("/student");
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // now controlled by the service worker
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    });

    await context.setOffline(true);
    await page.goto(`/student/assessments/${demoAssessment("math-0")}/quiz`);
    await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    const poppins = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((face) => face.family.replace(/"/g, "") === "Poppins" && face.status === "loaded");
    });
    expect(poppins, "Poppins is served from the cache offline").toBe(true);

    // Back online, Try again loads the workspace without a reload.
    await context.setOffline(false);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Quiz 02/ })).toBeVisible();
  });

  test("on Slow 3G the first visit shows content within 10 seconds", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Network throttling uses the Chrome DevTools Protocol.");
    test.slow();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    // Chrome DevTools "Slow 3G": 400 ms latency, ~50 KB/s down.
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 });
    const started = Date.now();
    await page.goto("/student", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { level: 1, name: /Good morning, Alex/ })).toBeVisible({ timeout: 20_000 });
    const elapsed = Date.now() - started;
    test.info().annotations.push({ type: "slow-3g-first-content-ms", description: String(elapsed) });
    expect(elapsed).toBeLessThan(10_000);
  });
});

test.describe("Comfort settings", () => {
  test("with reduced motion, the featured carousel does not move on its own", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/student/news");
    const slide = page.locator('[aria-roledescription="slide"]');
    await expect(slide).toHaveAttribute("aria-label", /^1 of/);
    await page.clock.runFor(13_000);
    await expect(slide).toHaveAttribute("aria-label", /^1 of/);
  });

  test("in Windows high contrast, selected states stay visible @all", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/student/tasks?status=Missing");
    const pressed = page.getByRole("button", { name: /^Missing/ });
    await expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(await pressed.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
    const notPressed = page.getByRole("button", { name: /^Done/ });
    expect(await notPressed.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  });
});
