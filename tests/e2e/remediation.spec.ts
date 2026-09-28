import { expect, test } from "@playwright/test";

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
