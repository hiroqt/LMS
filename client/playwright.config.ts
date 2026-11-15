import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

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
