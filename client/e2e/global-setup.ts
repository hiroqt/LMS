import { chromium, type FullConfig } from "@playwright/test";

/**
 * Warms both servers once before any test, so no test pays the cold start (L-071):
 * - the LMS API builds its EF model and seeds a sandbox on the first request;
 * - the Vite dev server compiles each workspace the first time a browser opens it.
 * On a 2-core CI runner the two together could exceed a test's 5 s wait for the first
 * page, so whichever spec ran first failed at random.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  const api = `http://localhost:${process.env.E2E_API_PORT ?? 5299}`;
  const viewers = [
    { id: "instructor-1", role: "instructor" },
    { id: "s0", role: "student" },
  ];
  for (const viewer of viewers) {
    await fetch(`${api}/api/me/overview`, {
      headers: { "X-Demo-Sandbox": `warm-up-${viewer.role}`, "X-Demo-User-Id": viewer.id, "X-Demo-Role": viewer.role },
    }).catch(() => undefined);
  }
  if (!baseURL) return;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const role of ["instructor", "student", "admin"]) {
      await page.addInitScript(() => localStorage.setItem("tmcc-demo-sandbox", "warm-up"));
      await page.goto(`${baseURL}/${role}`);
      await page.getByRole("main").waitFor({ timeout: 120_000 }).catch(() => undefined);
    }
    // The sign-in page is its own chunk too; WebKit timed out on its first visit (D-066).
    await page.goto(`${baseURL}/login`);
    await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 120_000 }).catch(() => undefined);
  } finally {
    await browser.close();
  }
}
