/**
 * WCAG 2.1 AA, enforced rather than assumed.
 *
 * The interface is dense, themed twice over, and colours several things by
 * meaning — which is exactly where contrast quietly slips. When this was first
 * run it found 81 failures: muted text below the floor on every card surface,
 * an amber pill unreadable on white, settings fields with no label at all, and
 * the download button nested inside a `<summary>`, a control inside a control.
 *
 * Every disclosure is opened first: the app hides most of itself behind
 * `<details>`, and an audit of the closed page would pass by looking at almost
 * nothing.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function openEverything(page: import("@playwright/test").Page) {
  await page.goto("./");
  await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
  await page.evaluate(() => {
    for (const disclosure of document.querySelectorAll("details")) {
      disclosure.open = true;
    }
  });
  // Opening the module list mounts a hundred rows; give them a frame.
  await page.waitForTimeout(600);
}

for (const scheme of ["dark", "light"] as const) {
  test(`format item inheritance is accessible in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    await page.getByRole("button", { name: "Expand $os", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Expand format", exact: true }).press("Enter");
    await page.getByRole("button", { name: "Change the style of ${symbol}", exact: true }).press("Enter");

    for (const mode of ["Inherit", "Override"]) {
      const toggle = page.getByRole("button", { name: mode, exact: true });
      await toggle.press("Enter");
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      const { violations } = await new AxeBuilder({ page })
        .include('[data-option="format"]')
        .withTags(TAGS)
        .analyze();
      expect(violations).toEqual([]);
    }
  });

  test(`terminal appearance pickers are accessible in the ${scheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");

    for (const [triggerLabel, panelLabel] of [
      ["Terminal color scheme", "Terminal color schemes"],
      ["Terminal font", "Terminal fonts"],
    ] as const) {
      await page.getByLabel(triggerLabel).press("Enter");
      const panel = page.getByRole("dialog", { name: panelLabel });
      await expect(panel).toBeVisible();

      const { violations } = await new AxeBuilder({ page })
        .include(`[role="dialog"][aria-label="${panelLabel}"]`)
        .withTags(TAGS)
        .analyze();
      expect(violations).toEqual([]);

      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
    }
  });

  test(`the ${scheme} theme has no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openEverything(page);

    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    // Named in the failure, so a regression says which rule and where rather
    // than only how many.
    expect(
      violations.map(
        (violation) =>
          `${violation.id} (${violation.impact}) ×${violation.nodes.length}: ${violation.nodes[0]?.target.join(" ")}`,
      ),
    ).toEqual([]);
  });
}
