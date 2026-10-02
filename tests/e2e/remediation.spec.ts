import { expect, test } from "@playwright/test";

test("right prompt is announced once and hidden when it collides", async ({ page }) => {
  await page.goto("./");
  await page.locator("[data-section='toml'] button[aria-expanded]").click();
  await page.getByLabel("starship.toml").fill('format = "left"\nright_format = "right-marker"\n');
  const terminal = page.getByLabel("Simulated terminal prompt");
  await expect(terminal.locator(".sr-only")).toContainText("Right prompt: right-marker");
  await page.getByLabel("starship.toml").fill(`format = "${"L".repeat(600)}"\nright_format = "right-marker"\n`);
  await expect(terminal).not.toContainText("right-marker");
});

test("malformed persisted state falls back without a crash or reload loop", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("starship-prompt-builder.session", JSON.stringify({
    version: 1, config: {}, scenario: { path: "/tmp", shell: "zsh" }, themeId: "tokyo-night", fontId: "hack",
  })));
  await page.goto("./");
  await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
  await expect(page.getByText("Something in the builder broke")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
});
