import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`terminal installation guide is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto("./terminal");
    await expect(page.getByRole("heading", { name: "Build your prompt in the terminal" })).toBeVisible();
    await expect(page.getByText("The CLI package is not yet published to npm.", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Build with an agent" })).toBeVisible();
    await expect(page.getByLabel("Agent guide command")).toContainText("agent-guide");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Copy starter prompt" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("starship-builder agent-guide");
    expect(await page.evaluate(() => window.innerWidth)).toBe(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
}
