import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

/** The Demo-mode LMS API the suite runs against (playwright.config.ts). */
export const API = `http://localhost:${process.env.E2E_API_PORT ?? 5299}`;

/**
 * The demo data is dated around October 2026, and the app reads the real
 * clock (in Asia/Manila, playwright.config.ts). Pinning the clock keeps due-date filters and timers deterministic
 * and lets specs fast-forward the per-question quiz timer.
 */
// The same instant on every machine: 09:00 in Manila (the suite's time zone).
export const DEMO_NOW = new Date("2026-10-23T09:00:00+08:00");

export const test = base.extend<{ page: Page; sandbox: string }>({
  // Each test gets its own freshly seeded database in the Demo-mode LMS API (D-032).
  // oxlint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their first argument
  sandbox: async ({}, run) => {
    await run(`t-${randomUUID()}`);
  },
  // The fixture callback is named "run" because oxlint reads "use" as a React hook.
  page: async ({ page, sandbox }, run) => {
    await page.clock.install({ time: DEMO_NOW });
    await page.addInitScript((value) => {
      try {
        localStorage.setItem("tmcc-demo-sandbox", value);
      } catch {
        // Storage blocked: the API's default sandbox is used.
      }
    }, sandbox);
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

/*
 * Database ids of the demo seed (D-032). Each test's sandbox is seeded from
 * src/data.js in order (client/scripts/demo-seed.ts), so the n-th assessment
 * or material there has id n.
 */
import { assessments as demoAssessments, materials as demoMaterials } from "../src/data.js";

/** e.g. demoAssessment("math-0") → "4" */
export function demoAssessment(key: string): string {
  const index = demoAssessments.findIndex((item) => item.id === key);
  if (index < 0) throw new Error(`No demo assessment ${key}`);
  return String(index + 1);
}

/** e.g. demoMaterial("biology-material-0") → "1" */
export function demoMaterial(key: string): string {
  const index = demoMaterials.findIndex((item) => item.id === key);
  if (index < 0) throw new Error(`No demo material ${key}`);
  return String(index + 1);
}

export interface DemoViewer {
  id: string;
  role: "instructor" | "student";
}

export const INSTRUCTOR: DemoViewer = { id: "instructor-1", role: "instructor" };
export const STUDENT: DemoViewer = { id: "s0", role: "student" };

/** Calls the Demo-mode LMS API as someone, inside this test's sandbox, to set up a journey. */
export async function callApi<T = unknown>(page: Page, sandbox: string, viewer: DemoViewer, method: string, path: string, data?: unknown): Promise<T> {
  const response = await page.request.fetch(`${API}${path}`, {
    method,
    headers: { "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": viewer.id, "X-Demo-Role": viewer.role },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

/** An assignment in Introduction to Programming that Alex Rivera has handed in, waiting for a grade. */
export async function seedHandedInAssignment(page: Page, sandbox: string, title = "Lab report: loops") {
  const [module] = await callApi<Array<{ id: number }>>(page, sandbox, INSTRUCTOR, "GET", "/api/classes/biology/modules");
  const work = await callApi<{ id: number }>(page, sandbox, INSTRUCTOR, "POST", "/api/classes/biology/coursework", {
    type: "assignment", moduleId: module!.id, title, maxPoints: 10, status: "published", instructions: "Trace each loop.",
  });
  // Real work through the draft API (D-061): a note and an uploaded PDF, then turn in.
  const base = `/api/classes/biology/coursework/${work.id}`;
  await callApi(page, sandbox, STUDENT, "PUT", `${base}/draft`, { text: "Done on paper, scanned.", link: null });
  await uploadAsStudent(page, sandbox, `${base}/draft/files`, {
    name: "loops.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<< /Title (Loops) >>\nendobj\ntrailer\n<< >>\n%%EOF\n", "latin1"),
  });
  const { submission } = await callApi<{ submission: { id: number } }>(page, sandbox, STUDENT, "POST", `${base}/draft/turn-in`, { honorStatement: true });
  return { courseworkId: String(work.id), submissionId: String(submission.id), title };
}

/** Adds one file to a student's draft (multipart), as the student page does. */
export async function uploadAsStudent(page: Page, sandbox: string, path: string, file: { name: string; mimeType: string; buffer: Buffer }, viewer: DemoViewer = STUDENT) {
  const response = await page.request.post(`${API}${path}`, {
    headers: { "X-Demo-Sandbox": sandbox, "X-Demo-User-Id": viewer.id, "X-Demo-Role": viewer.role },
    multipart: { file },
  });
  expect(response.ok(), `upload ${file.name}: ${response.status()} ${await response.text()}`).toBe(true);
}
