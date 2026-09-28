import { expect, test } from "@playwright/test";

for (const scheme of ["light", "dark"] as const) {
  test(`keyboard import, undo and sharing in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./");
    const entry = page.getByRole("button", { name: "Paste a config", exact: true });
    await entry.focus();
    await page.keyboard.press("Enter");
    const editor = page.getByLabel("starship.toml");
    await expect(editor).toBeFocused();
    const previous = await editor.inputValue();
    await editor.fill('# portable\nformat = "keyboard-marker"\nright_format = "right-marker"\n');
    const apply = page.getByRole("button", { name: "Apply draft", exact: true });
    await apply.focus();
    await page.keyboard.press("Enter");
    await expect(apply).toBeDisabled();
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("Right prompt: right-marker");
    await expect.poll(() => page.evaluate(() => location.hash.length)).toBeGreaterThan(1);
    await page.getByRole("button", { name: "Undo", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(editor).toHaveValue(previous);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => innerWidth)).toBeGreaterThan(300);
  });
}
