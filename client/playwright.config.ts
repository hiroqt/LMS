import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

/**
 * Flow-parity suite. These specs encode the journeys in
 * docs/STUDENT_USER_FLOW.md and docs/INSTRUCTOR_USER_FLOW.md and must keep
 * passing, unchanged, while the UI is rebuilt. Selectors use roles and
 * accessible names only, never CSS classes, so a restyle cannot break them.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    // Phone projects run only the @mobile journeys (layout-specific navigation).
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] }, grep: /@mobile/ },
    { name: "android-chromium", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/student`,
    reuseExistingServer: !process.env.CI,
  },
});
