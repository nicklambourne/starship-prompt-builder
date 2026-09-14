/**
 * The pictures in the README, taken from the built site.
 *
 * Generated rather than hand-captured so they cannot quietly go stale: run
 * against a local `serve:export` and commit what comes out.
 *
 *   pnpm build && pnpm serve:export &
 *   pnpm build:screenshots
 */

import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";

const PORT = process.env.PORT ?? 4321;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = "docs/images";

/** Settles the page: fonts swap in late, and a half-drawn prompt looks broken. */
async function ready(page) {
  await page.waitForSelector("[aria-label='Simulated terminal prompt']");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function shot(name, { width, height, scheme, prepare, capture }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await ready(page);
  if (prepare) await prepare(page);
  const screenshot = capture ? await capture(page) : await page.screenshot();
  await writeFile(`${OUT}/${name}.png`, screenshot);
  await context.close();
  console.log(`  ${name}.png`);
}

async function sectionShot(page, section, maxHeight) {
  const card = page.locator(`[data-section='${section}']`);
  if (maxHeight) {
    await card.evaluate((element, height) => {
      element.style.maxHeight = `${height}px`;
      element.style.overflow = "hidden";
    }, maxHeight);
  }
  return card.screenshot();
}

console.log("screenshots:");

await shot("builder-dark", { width: 1440, height: 900, scheme: "dark" });
await shot("builder-light", { width: 1440, height: 900, scheme: "light" });

await shot("mobile", { width: 390, height: 844, scheme: "dark" });

await shot("module-settings", {
  width: 1440,
  height: 900,
  scheme: "dark",
  async prepare(page) {
    // A module opened on its own settings is the part people ask about.
    await page.getByRole("button", { name: /^Expand \$directory/ }).first().click();
    await page.waitForTimeout(500);
  },
  capture: (page) => sectionShot(page, "format", 600),
});

await shot("environment", {
  width: 1440,
  height: 900,
  scheme: "dark",
  async prepare(page) {
    const section = page
      .locator("[data-section='environment'] summary")
      .filter({ hasText: "Installed tools" });
    await section.click();
    await page.waitForTimeout(400);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  },
  capture: (page) => sectionShot(page, "environment"),
});

await browser.close();
