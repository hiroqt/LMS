import { test as base, expect, type Page } from "@playwright/test";

/**
 * The demo data is dated around October 2026, and the app reads the real
 * clock. Pinning the clock keeps due-date filters and timers deterministic
 * and lets specs fast-forward the per-question quiz timer.
 */
export const DEMO_NOW = new Date("2026-10-23T09:00:00");

export const test = base.extend<{ page: Page }>({
  // The fixture callback is named "run" because oxlint reads "use" as a React hook.
  page: async ({ page }, run) => {
    await page.clock.install({ time: DEMO_NOW });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await run(page);
    // Any uncaught exception during a journey is a regression.
    expect(errors, "uncaught page errors").toEqual([]);
  },
});

export { expect };
export type { Page };

/** Opens a role workspace with fresh browser storage (seed data). */
export async function openRole(page: Page, role: "student" | "instructor" | "admin") {
  await page.goto(`/${role}`);
  await expect(page.getByRole("main")).toBeVisible();
}
