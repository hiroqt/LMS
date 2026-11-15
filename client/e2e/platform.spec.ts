import { expect, test } from "./fixtures";

// @all specs run on every project: desktop Chromium, iPhone WebKit, Pixel Chromium.

for (const role of ["student", "instructor"] as const) {
  test(`Poppins is loaded and applied in the ${role} workspace @all`, async ({ page }) => {
    await page.goto(`/${role}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const font = await page.evaluate(async () => {
      await document.fonts.ready;
      const heading = document.querySelector("h1");
      return {
        loaded: [...document.fonts].some((face) => face.family.replace(/"/g, "") === "Poppins" && face.status === "loaded"),
        family: heading ? getComputedStyle(heading).fontFamily : "",
      };
    });
    expect(font.loaded, "a Poppins face finished loading").toBe(true);
    expect(font.family.split(",")[0]?.replace(/"/g, "").trim()).toBe("Poppins");
  });
}
