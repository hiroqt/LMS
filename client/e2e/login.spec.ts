import { expectNoAxeViolations } from "./a11y";
import { expect, test } from "./fixtures";

// The sign-in page (D-044). Frontend only: a filled-in form leads to the workspace choice.

test("/login shows only the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page).toHaveTitle("TMCC LMS · Sign in");
  // The college panel was removed (D-066).
  await expect(page.getByRole("heading")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Connect with us" })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("an empty sign-in names the missing fields and stays on the page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("signing in asks for a workspace and opens the chosen one", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose a workspace" });
  await expect(dialog).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: /Admin workspace/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page).toHaveTitle("TMCC LMS · Admin Workspace");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "admin navigation" })).toBeVisible();
});

test("Forgot password starts from the typed email and says no email was sent", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset password" });
  await expect(dialog.getByLabel("Registered email")).toHaveValue("alex@example.com");
  await dialog.getByRole("button", { name: "Send reset link" }).click();
  await expect(dialog.getByRole("status")).toContainText("no email was sent to alex@example.com");
});

test("signing in with student mockup credentials goes directly to the student dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("student@tmcc.edu.ph");
  await page.getByLabel("Password", { exact: true }).fill("student123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(page).toHaveTitle("TMCC LMS · Student Workspace");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("signing in with instructor mockup credentials goes directly to the instructor dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("instructor@tmcc.edu.ph");
  await page.getByLabel("Password", { exact: true }).fill("instructor123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/instructor$/);
  await expect(page).toHaveTitle("TMCC LMS · Instructor Workspace");
  await expect(page.getByRole("navigation", { name: "instructor navigation" })).toBeVisible();
});

test("signing in with admin mockup credentials goes directly to the admin dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@tmcc.edu.ph");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page).toHaveTitle("TMCC LMS · Admin Workspace");
  await expect(page.getByRole("navigation", { name: "admin navigation" })).toBeVisible();
});

test("clicking a demo account from the dropdown fills the email and password fields", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Demo accounts" }).click();
  await page.getByRole("menuitem", { name: /Instructor/ }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("instructor@tmcc.edu.ph");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("instructor123");
});

test("logging out from the sidebar returns to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("navigation", { name: "admin navigation" })).toBeVisible();

  const logoutButton = page.getByRole("button", { name: "Log out" });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("TMCC LMS · Sign in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

// D-066: the profile opens nothing; Student phones, which have no sidebar, log out from the top bar.
test("on a phone, the Student top bar's Log out returns to the login page @mobile", async ({ page }) => {
  await page.goto("/student");
  await expect(page.getByRole("banner")).toContainText("Alex Rivera");
  await expect(page.getByRole("banner").getByRole("button", { name: /Alex Rivera|Profile/ })).toHaveCount(0);

  await page.getByRole("banner").getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle("TMCC LMS · Sign in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

// Portrait and landscape phones and tablets, plus the narrowest supported width (D-066).
const SIZES = [
  { name: "320px portrait", width: 320, height: 640 },
  { name: "phone portrait", width: 390, height: 844 },
  // Held sideways, the heading sits beside the form so the whole card fits (landscape-short).
  { name: "phone landscape", width: 844, height: 390, fits: true },
  { name: "small phone landscape", width: 640, height: 360, fits: true },
  { name: "smallest phone landscape", width: 568, height: 320 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

test("the sign-in form is centered and usable in portrait and landscape @all", async ({ page }) => {
  await page.goto("/login");
  const heading = page.getByRole("heading", { level: 1, name: "Sign in" });
  await expect(heading).toBeVisible();
  // One page load, then each size in turn, as when a phone is rotated: the layout must follow
  // without a reload.
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(heading, size.name).toBeVisible();

    const metrics = await page.evaluate(() => {
      const card = document.querySelector("h1")?.closest("main > div");
      const box = card?.getBoundingClientRect();
      // Measured against <main>: desktop Chromium's always-on scrollbar gutter makes
      // innerWidth and even clientWidth wider than the laid-out page.
      const main = document.querySelector("main")?.getBoundingClientRect();
      const { scrollWidth, scrollHeight } = document.documentElement;
      return {
        overflow: scrollWidth - (main?.width ?? 0),
        scrolls: scrollHeight > window.innerHeight,
        left: box && main ? box.left - main.left : -1,
        right: box && main ? main.right - box.right : -1,
        top: box?.top ?? -1,
        bottom: box ? window.innerHeight - box.bottom : -1,
      };
    });
    expect(metrics.overflow, `${size.name}: no sideways scroll`).toBeLessThanOrEqual(1);
    expect(Math.abs(metrics.left - metrics.right), `${size.name}: centered across`).toBeLessThanOrEqual(2);
    // The card's top is never cut off; when it fits, it is centered down the page as well.
    expect(metrics.top, `${size.name}: top in view`).toBeGreaterThanOrEqual(0);
    if ("fits" in size) expect(metrics.scrolls, `${size.name}: fits without scrolling`).toBe(false);
    if (!metrics.scrolls) expect(Math.abs(metrics.top - metrics.bottom), `${size.name}: centered down`).toBeLessThanOrEqual(80);

    // Everything stays reachable, scrolling where the screen is short.
    await page.getByLabel("Email", { exact: true }).fill("student@tmcc.edu.ph");
    await page.getByLabel("Password", { exact: true }).fill("student123");
    const submit = page.getByRole("button", { name: "Sign in to portal" });
    await submit.scrollIntoViewIfNeeded();
    await expect(submit, size.name).toBeInViewport();
    await expect(page.getByRole("button", { name: "Demo accounts" }), size.name).toBeVisible();
  }
});

