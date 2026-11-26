import { expect, test } from "./fixtures";

// URL contract of the role router. Existing bookmarks, the GitHub Pages
// 404 fallback, and shared links depend on every one of these forms.

const STUDENT = /Good morning, Alex/;
const INSTRUCTOR = "Your teaching day";

const cases: Array<[path: string, expected: "student" | "instructor" | "admin"]> = [
  ["/student", "student"],
  ["/student/", "student"],
  ["/student.html", "student"],
  ["/instructor", "instructor"],
  ["/instructor/index.html", "instructor"],
  ["/admin", "admin"],
  ["/?role=instructor", "instructor"],
  ["/?role=ADMIN", "admin"],
  ["/#/instructor", "instructor"],
  ["/#admin", "admin"],
];

for (const [path, role] of cases) {
  test(`${path} opens the ${role} workspace`, async ({ page }) => {
    await page.goto(path);
    if (role === "student") await expect(page.getByRole("heading", { level: 1, name: STUDENT })).toBeVisible();
    if (role === "instructor") await expect(page.getByRole("heading", { level: 1, name: INSTRUCTOR })).toBeVisible();
    if (role === "admin") await expect(page.getByRole("navigation", { name: "admin navigation" })).toBeVisible();
  });
}

// D-066: the landing page is sign-in. Only a URL that names a role opens a workspace.
for (const path of ["/", "/index.html"]) {
  test(`${path} lands on the sign-in page`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page).toHaveTitle("TMCC LMS · Sign in");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });
}

test("an unknown path shows the role fallback, which can return to Student", async ({ page }) => {
  await page.goto("/not-a-role");
  await expect(page.getByRole("heading", { name: "Role path not found" })).toBeVisible();
  await expect(page.getByText("/not-a-role")).toBeVisible();
  await page.getByRole("button", { name: /Return to Student workspace/i }).click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { level: 1, name: STUDENT })).toBeVisible();
});

// D-066: there is no workspace switcher; another role is reached by logging out and signing in again.
test("switching role goes through Log out and sign-in, and Back returns to the previous role", async ({ page }) => {
  await page.goto("/student");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email", { exact: true }).fill("instructor@tmcc.edu.ph");
  await page.getByLabel("Password", { exact: true }).fill("instructor123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/instructor$/);
  await expect(page).toHaveTitle("TMCC LMS · Instructor Workspace");
  await expect(page.getByRole("heading", { level: 1, name: INSTRUCTOR })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
});

test("Admin smoke: overview loads and sidebar navigation works (Admin is out of revamp scope)", async ({ page }) => {
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "admin navigation" });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
  await nav.getByRole("button").nth(1).click();
  await expect(page.getByRole("main")).toBeVisible();
});
