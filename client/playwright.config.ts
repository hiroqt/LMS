import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/** Opens the rebuilt Student UI (D-014) while Instructor stays classic. */
const studentNew = {
  cookies: [],
  origins: [{ origin: BASE_URL, localStorage: [{ name: "tmcc-ui-version:student", value: "new" }] }],
};
/** Opens the rebuilt Instructor UI while Student stays classic. */
const instructorNew = {
  cookies: [],
  origins: [{ origin: BASE_URL, localStorage: [{ name: "tmcc-ui-version:instructor", value: "new" }] }],
};
/** Both rebuilt UIs: the state after cutover (Phase 5). */
const bothNew = {
  cookies: [],
  origins: [{ origin: BASE_URL, localStorage: [{ name: "tmcc-ui-version:student", value: "new" }, { name: "tmcc-ui-version:instructor", value: "new" }] }],
};
// The flow specs that must pass on every combination of classic and rebuilt UIs (D-007, D-013).
const studentParity = /[\\/](student-flow|shell|instructor-flow|instructor-more)\.spec\.ts$/;
const instructorParity = /[\\/](instructor-flow|instructor-more|shell)\.spec\.ts$/;

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
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    // Phone projects run the @mobile journeys (layout-specific navigation) and @all checks.
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] }, grep: /@mobile|@all/ },
    { name: "android-chromium", use: { ...devices["Pixel 7"] }, grep: /@mobile|@all/ },
    // Flow parity on the rebuilt Student UI: the same specs, unchanged.
    { name: "student-new", use: { ...devices["Desktop Chrome"], storageState: studentNew }, testMatch: studentParity, grepInvert: /@mobile/ },
    { name: "student-new-iphone", use: { ...devices["iPhone 15"], storageState: studentNew }, testMatch: studentParity, grep: /@mobile/ },
    { name: "instructor-new", use: { ...devices["Desktop Chrome"], storageState: instructorNew }, testMatch: instructorParity, grepInvert: /@mobile/ },
    { name: "instructor-new-iphone", use: { ...devices["iPhone 15"], storageState: instructorNew }, testMatch: instructorParity, grep: /@mobile/ },
    { name: "both-new", use: { ...devices["Desktop Chrome"], storageState: bothNew }, testMatch: studentParity, grepInvert: /@mobile/ },
  ],
  // E2E_PREVIEW=1 runs against the production build (vite preview), which is
  // where the generated 404.html and role.html fallbacks are exercised.
  webServer: {
    command: process.env.E2E_PREVIEW
      ? `npm run build && npm run preview -- --port ${PORT} --strictPort`
      : `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/student`,
    reuseExistingServer: !process.env.CI,
  },
});
