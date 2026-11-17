import { expectNoAxeViolations } from "./a11y";
import { expect, test } from "./fixtures";

// The sign-in page (D-044). Frontend only: a filled-in form leads to the workspace choice.

test("/login shows the sign-in form and the college's goal and core values", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page).toHaveTitle("TMCC LMS · Sign in");
  await expect(page.getByRole("heading", { level: 2, name: "Trece Martires City College" })).toBeVisible();
  // The core values are a billboard slide (D-051): open it, then count them.
  const billboard = page.getByRole("region", { name: "College highlights" });
  await billboard.getByRole("button", { name: "Show Core Values" }).click();
  await expect(billboard.getByRole("list", { name: "Core values" }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("navigation", { name: "Connect with us" }).getByRole("link")).toHaveCount(2);
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

test("the sign-in page does not scroll sideways at 320px @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
