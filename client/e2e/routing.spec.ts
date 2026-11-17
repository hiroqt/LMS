import { expect, test } from "./fixtures";

// URL contract of the role router. Existing bookmarks, the GitHub Pages
// 404 fallback, and shared links depend on every one of these forms.

const STUDENT = /Good morning, Alex/;
const INSTRUCTOR = "Your teaching day";

const cases: Array<[path: string, expected: "student" | "instructor" | "admin"]> = [
  ["/", "student"],
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

test("an unknown path shows the role fallback, which can return to Student", async ({ page }) => {
  await page.goto("/not-a-role");
  await expect(page.getByRole("heading", { name: "Role path not found" })).toBeVisible();
  await expect(page.getByText("/not-a-role")).toBeVisible();
  await page.getByRole("button", { name: /Return to Student workspace/i }).click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { level: 1, name: STUDENT })).toBeVisible();
});

test("switching role updates the URL and title, and Back returns to the previous role", async ({ page }) => {
  await page.goto("/student");
  await page.getByRole("button", { name: "Profile: Alex Rivera" }).click();
  await page.getByRole("group", { name: "Switch workspace" }).getByRole("button", { name: "Instructor workspace" }).click();
  await expect(page).toHaveURL(/\/instructor$/);
  await expect(page).toHaveTitle("TMCC LMS · Instructor Workspace");
  await expect(page.getByRole("heading", { level: 1, name: INSTRUCTOR })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { level: 1, name: STUDENT })).toBeVisible();
});

test("Admin smoke: overview loads and sidebar navigation works (Admin is out of revamp scope)", async ({ page }) => {
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "admin navigation" });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
  await nav.getByRole("button").nth(1).click();
  await expect(page.getByRole("main")).toBeVisible();
});
