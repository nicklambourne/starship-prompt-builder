import { expect, test } from "@playwright/test";

test("inherited swatches follow group and named module styles without flattening the format", async ({ page }) => {
  await page.goto("./");
  await page.locator('[data-section="toml"] button[aria-expanded]').press("Enter");
  const toml = page.getByLabel("starship.toml");
  const config = (color: string) => `format = "$username$directory"\npalette = "mine"\n[palettes.mine]\naccent = "${color}"\n[username]\nshow_always = true\nstyle_user = "bold accent bg:#112233"\nformat = "[hello $user]($style)"\n[directory]\nformat = "[$path]($repo_root_style)"\nstyle = "bold accent bg:#112233"\n`;
  await toml.fill(config("#12ab34"));
  await page.getByRole("button", { name: "Expand $username", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Expand format", exact: true }).press("Enter");
  const user = page.locator('[data-option="format"] [data-format-row="0.1"]');
  const userSwatch = user.getByRole("button", { name: "Change the style of ${user}", exact: true }).locator("span span span").last();
  await expect(userSwatch).toHaveCSS("color", "rgb(18, 171, 52)");
  await expect(userSwatch).toHaveCSS("font-weight", "700");
  await expect(userSwatch.locator("..")).toHaveCSS("background-color", "rgb(17, 34, 51)");
  const terminal = page.getByLabel("Simulated terminal prompt");
  await expect(terminal.locator("span[style]").filter({ hasText: /^hello / }).first()).toHaveCSS("color", "rgb(18, 171, 52)");
  await user.getByRole("button", { name: "Change the style of ${user}", exact: true }).press("Enter");
  await expect(user.getByRole("button", { name: "Inherit", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Expand $directory", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Expand format", exact: true }).press("Enter");
  const pathSwatch = page.getByRole("button", { name: "Change the style of ${path}", exact: true }).locator("span span span").last();
  await expect(pathSwatch).toHaveCSS("color", "rgb(18, 171, 52)");

  await toml.fill(config("#ab1234"));
  await expect(userSwatch).toHaveCSS("color", "rgb(171, 18, 52)");
  await expect(pathSwatch).toHaveCSS("color", "rgb(171, 18, 52)");
  await expect(terminal.locator("span[style]").filter({ hasText: /^hello / }).first()).toHaveCSS("color", "rgb(171, 18, 52)");
  await expect(toml).toHaveValue(/\[hello \$user\]\(\$style\)/);
  await expect(toml).toHaveValue(/\[\$path\]\(\$repo_root_style\)/);
});

test("inherit uses the active status style in the swatch and rendered prompt", async ({ page }) => {
  await page.goto("./");
  await page.locator('[data-section="toml"] button[aria-expanded]').press("Enter");
  const toml = page.getByLabel("starship.toml");
  await toml.fill('format = "$status"\n[status]\ndisabled = false\nstyle = "bold #112233"\nsuccess_style = "bold #12ab34"\nsuccess_symbol = "OK"\nformat = "[$symbol]($style)"\n');
  await page.getByRole("button", { name: "Expand $status", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Expand format", exact: true }).press("Enter");
  const swatch = page.getByRole("button", { name: "Change the style of ${symbol}", exact: true });
  const glyph = swatch.locator("span span span").last();
  await expect(glyph).toHaveCSS("color", "rgb(18, 171, 52)");
  await swatch.press("Enter");
  const format = page.locator('[data-option="format"]');
  await expect(format.getByRole("button", { name: "Inherit", exact: true })).toHaveAttribute("aria-pressed", "true");
  await format.getByRole("button", { name: "Override", exact: true }).press("Enter");
  await expect(toml).toHaveValue(/\[\$symbol\]\(bold #12ab34\)/);
  await format.getByRole("button", { name: "Foreground: red", exact: true }).press("Enter");
  await format.getByRole("button", { name: "Inherit", exact: true }).press("Enter");
  await expect(glyph).toHaveCSS("color", "rgb(18, 171, 52)");
  await expect(page.getByLabel("Simulated terminal prompt").locator("span[style]").filter({ hasText: /^OK$/ }).first()).toHaveCSS("color", "rgb(18, 171, 52)");
  await expect(toml).toHaveValue(/\[\$symbol\]\(\$style\)/);
});
