import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`builder hands the current design to an agent at ${width}px`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width, height: 850 });
    await page.goto("./");
    expect(await page.evaluate(() => window.innerWidth)).toBe(width);

    const trigger = page.getByRole("button", { name: "Continue with AI" });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Continue with an AI assistant" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("What would you like to change?").fill("Make a compact prompt with a red error indicator.");

    const { violations } = await new AxeBuilder({ page })
      .include("dialog")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.flatMap((violation) => violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} ${node.failureSummary}`))).toEqual([]);

    await dialog.getByRole("button", { name: "Copy agent instructions" }).click();
    await expect(dialog.getByRole("status")).toContainText("Instructions copied");
    const handoff = await page.evaluate(() => navigator.clipboard.readText());
    expect(handoff).toContain("Make a compact prompt with a red error indicator.");
    expect(handoff).toContain("Current browser TOML:");
    expect(handoff).toContain("Current simulated environment:");
    expect(handoff).toContain("--scenario-file scenario.json");
    expect(handoff).toContain("--review-hash");

    const copiedUrl = handoff.match(/Browser review link: (\S+)/)?.[1];
    expect(copiedUrl).toContain("#review=");
    const reviewUrl = new URL(page.url());
    reviewUrl.hash = new URL(copiedUrl!).hash;
    await page.goto(reviewUrl.href);
    await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
    expect(await page.evaluate(() => window.location.hash.startsWith("#review="))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
