import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const gitFormat = "[[($all_status$ahead_behind )](fg:crust bg:yellow)]($style)";
const gitConfig = `format = "$git_status"\npalette = "demo"\n[palettes.demo]\ncrust = "#11111b"\nyellow = "#f9e2af"\n[git_status]\nstyle = "bg:yellow"\nformat = '${gitFormat}'\n`;

async function loadModule(page: Page, name: string, config: string) {
  await page.goto("./");
  await page.locator('[data-section="toml"] button[aria-expanded]').press("Enter");
  await page.getByLabel("starship.toml").fill(config);
  await page.getByRole("button", { name: `Expand $${name}`, exact: true }).press("Enter");
  await page.getByRole("button", { name: "Expand format", exact: true }).press("Enter");
  return page.locator('[data-option="format"]');
}

test("git status is editable, compact, lossless and undoable", async ({ page }) => {
  const format = await loadModule(page, "git_status", gitConfig);
  const toml = page.getByLabel("starship.toml");
  await expect(format.getByRole("button", { name: "Change the style of ${all_status}", exact: true })).toBeVisible();
  await expect(format.getByRole("button", { name: "Change the style of Group (3)", exact: true })).toBeVisible();
  await expect(format.getByRole("button", { name: "Change the style of Group (1)", exact: true })).toHaveCount(0);
  await expect(format).not.toContainText("fg:crust bg:yellow");

  await format.getByRole("checkbox", { name: "Show all style wrappers (advanced)", exact: true }).check();
  await expect(format.getByRole("button", { name: "Change the style of Group (1)", exact: true })).toBeVisible();
  await format.getByRole("checkbox", { name: "Show all style wrappers (advanced)", exact: true }).uncheck();
  const visibility = format.getByRole("checkbox", { name: /^Hide when all variables are empty/ });
  await visibility.uncheck();
  await expect(toml).toHaveValue(/\[\[\$all_status\$ahead_behind \]\(fg:crust bg:yellow\)\]\(\$style\)/);
  await page.getByRole("button", { name: "Undo", exact: true }).press("Enter");
  await expect(visibility).toBeChecked();
  await expect(toml).toHaveValue(/\[\[\(\$all_status\$ahead_behind \)\]\(fg:crust bg:yellow\)\]\(\$style\)/);

  // Reordering uses the real conditional tree rather than a raw fragment.
  await format.getByRole("button", { name: /^Reorder \$\{all_status\}/ }).press("ArrowDown");
  await expect(toml).toHaveValue(/\(\$ahead_behind\$all_status \)/);
  await page.reload();
  await page.getByRole("button", { name: "Expand $git_status", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Expand format", exact: true }).press("Enter");
  await expect(format.getByRole("checkbox", { name: /^Hide when all variables are empty/ })).toBeChecked();
});

test("a partial conditional reacts to the environment and keeps hidden contents editable", async ({ page }) => {
  const format = await loadModule(page, "directory", 'format = "$directory"\n[directory]\nformat = \'[$path]($style)( [read-only $read_only]($read_only_style))\'\n');
  await expect(format.getByText("Conditional · Hidden in this preview", { exact: true })).toBeVisible();
  await expect(format.getByRole("button", { name: "Change the style of ${read_only}", exact: true })).toBeVisible();
  const preview = page.getByLabel("Simulated terminal prompt");
  await expect(preview).not.toContainText("read-only");
  await page.locator("summary").filter({ hasText: "Directory" }).press("Enter");
  await page.getByRole("switch", { name: "Read-only directory", exact: true }).press("Enter");
  await expect(format.getByText("Conditional · Visible in this preview", { exact: true })).toBeVisible();
  await expect(preview).toContainText("read-only");
  await page.getByRole("switch", { name: "Read-only directory", exact: true }).press("Enter");
  await format.getByRole("checkbox", { name: /^Hide when all variables are empty/ }).first().uncheck();
  await expect(preview).toContainText("read-only");
});

test("a compact conditional moves with its preserved style wrappers and stops at list boundaries", async ({ page }) => {
  const format = await loadModule(page, "git_status", gitConfig);
  const handle = format.getByRole("button", { name: /^Reorder Group \(3\)/ });
  await handle.press("ArrowDown");
  await expect(handle).toBeVisible();

  // Add a sibling, then move the entire visible group past it and back.
  await format.getByRole("button", { name: "+ Add text", exact: true }).last().press("Enter");
  await handle.press("ArrowDown");
  const toml = page.getByLabel("starship.toml");
  await expect.poll(() => toml.inputValue()).toContain(`format = " ${gitFormat}"`);
  await handle.press("ArrowDown");
  await expect.poll(() => toml.inputValue()).toContain(`format = " ${gitFormat}"`);
  await handle.press("ArrowUp");
  await expect.poll(() => toml.inputValue()).toContain(`format = "${gitFormat} "`);
});

test("inner overrides restore the surrounding group's style through a conditional", async ({ page }) => {
  const format = await loadModule(page, "username", 'format = "$username"\n[username]\nshow_always = true\nstyle_user = "red"\nformat = "[hello ($user)](bold #12ab34)"\n');
  const button = format.getByRole("button", { name: "Change the style of ${user}", exact: true });
  const glyph = button.locator("span span span").last();
  await expect(glyph).toHaveCSS("color", "rgb(18, 171, 52)");
  await button.press("Enter");
  const user = format.locator('[data-format-row="0.1.0"]');
  await expect(user.getByRole("button", { name: "Inherit", exact: true })).toHaveAttribute("aria-pressed", "true");
  await user.getByRole("button", { name: "Override", exact: true }).press("Enter");
  await user.getByRole("button", { name: "Foreground: red", exact: true }).press("Enter");
  await user.getByRole("button", { name: "Inherit", exact: true }).press("Enter");
  await expect(glyph).toHaveCSS("color", "rgb(18, 171, 52)");
  await expect(page.getByLabel("starship.toml")).toHaveValue(/\[hello \(\$user\)\]\(bold #12ab34\)/);
  await expect(page.getByLabel("Simulated terminal prompt").locator("span[style]").filter({ hasText: /^you$/ }).first()).toHaveCSS("color", "rgb(18, 171, 52)");
});

test("a new optional group supports adding variables and text without raw editing", async ({ page }) => {
  const format = await loadModule(page, "username", 'format = "$username"\n[username]\nshow_always = true\nformat = "$user"\n');
  await format.getByRole("button", { name: "+ Add conditional group", exact: true }).press("Enter");
  await format.getByRole("combobox", { name: "Add variable to group", exact: true }).selectOption("user");
  await format.locator('[data-format-row="1"]').getByRole("button", { name: "+ Add text", exact: true }).press("Enter");
  await expect(page.getByLabel("starship.toml")).toHaveValue(/\$user\(\$user \)/);
});

for (const scheme of ["dark", "light"] as const) {
  test(`conditional controls fit at 390px and desktop and are accessible in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const format = await loadModule(page, "git_status", gitConfig);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 950 });
      expect(await page.evaluate(() => window.innerWidth)).toBe(width);
      await expect(format.getByRole("button", { name: "Change the style of ${ahead_behind}", exact: true })).toBeVisible();
      expect(await format.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const { violations } = await new AxeBuilder({ page }).include('[data-option="format"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(violations).toEqual([]);
    }
  });
}
