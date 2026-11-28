import { defineConfig, devices } from "@playwright/test";

// An uncommon port, so a dev server left running on 4173 or 5173 is never reused by mistake.
// E2E_PORT / E2E_API_PORT let two checkouts run the suite at once without reusing each other's servers.
const PORT = Number(process.env.E2E_PORT ?? 4317);
const BASE_URL = `http://localhost:${PORT}`;
/** The LMS API in Demo mode (server/README.md): fictional seed, one database per test sandbox. */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 5299);
const API_URL = `http://localhost:${API_PORT}`;
/** The fixtures pin the browser clock to this moment; the API's clock starts at the same instant. */
const DEMO_NOW = "2026-10-23T09:00:00+08:00";
/**
 * Class meetings (D-070) need a LiveKit media server: `meet-server/` locally (ws://127.0.0.1:7880),
 * a service container in CI. Without E2E_LIVEKIT_URL the meeting specs that join skip.
 */
const LIVEKIT: Record<string, string> = process.env.E2E_LIVEKIT_URL
  ? {
      Lms__Meet__Url: process.env.E2E_LIVEKIT_URL,
      Lms__Meet__ApiKey: process.env.E2E_LIVEKIT_KEY ?? "lms-dev",
      Lms__Meet__ApiSecret: process.env.E2E_LIVEKIT_SECRET ?? "dev_only_livekit_secret_change_me_0123",
    }
  : {};
/** Chromium's stand-in camera (a test pattern), microphone (a beep), and screen to share, with no prompts. */
const fakeMedia = { launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen"] } };

/**
 * Flow-parity suite. The flow specs encode the journeys in
 * docs/STUDENT_USER_FLOW.md and docs/INSTRUCTOR_USER_FLOW.md. They were
 * written against the classic UI and proved the rebuilt UI kept every
 * journey (Phases 0–4); since cutover (D-021) they guard the rebuilt UI.
 * Selectors use roles and accessible names only, never CSS classes.
 */
export default defineConfig({
  testDir: "./e2e",
  // Starts after the web servers: warms the API and each workspace once (L-071).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // The demo seed's dates are Manila times; pin the zone so every machine and CI agree.
    timezoneId: "Asia/Manila",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], ...fakeMedia }, grepInvert: /@mobile/ },
    // Phone projects run the @mobile journeys (layout-specific navigation) and @all checks.
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] }, grep: /@mobile|@all/ },
    { name: "android-chromium", use: { ...devices["Pixel 7"], ...fakeMedia }, grep: /@mobile|@all/ },
  ],
  // E2E_PREVIEW=1 runs against the production build (vite preview), which is
  // where the generated 404.html and role.html fallbacks are exercised.
  webServer: [
    {
      command: "dotnet run --project ../server/src/Lms.Api --no-launch-profile",
      url: `${API_URL}/api/lms/status`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        ASPNETCORE_ENVIRONMENT: "Demo",
        ASPNETCORE_URLS: API_URL,
        Lms__Demo__Now: DEMO_NOW,
        Lms__Demo__DataDirectory: `${process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? "/tmp"}/lms-e2e-${API_PORT}`,
        // Adds this run's client origin to the Demo CORS list (appsettings.Demo.json has 4317).
        Cors__AllowedOrigins__3: BASE_URL,
        // Office uploads get no preview, whether or not this machine has LibreOffice (D-067). The
        // seeded Office materials carry ready-made previews, so previews are still tested.
        Lms__Files__Converter: "none",
        ...LIVEKIT,
      },
    },
    {
      command: process.env.E2E_PREVIEW
        ? `npm run build && npm run preview -- --port ${PORT} --strictPort`
        : `npm run dev -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/student`,
      reuseExistingServer: !process.env.CI,
      env: { VITE_LMS_API_URL: API_URL },
    },
  ],
});
