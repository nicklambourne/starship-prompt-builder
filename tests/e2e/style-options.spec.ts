import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { parse } from "smol-toml";

async function loadConfig(page: Page, toml: string, module: string) {
  await page.goto("./");
  await page.locator('[data-section="toml"] button[aria-expanded]').press("Enter");
  await page.getByLabel("starship.toml").fill(toml);
  await page.getByRole("button", { name: `Expand $${module}`, exact: true }).press("Enter");
}

const STYLE_OPTIONS = {
  username: ["style_root", "style_user"],
  git_metrics: ["added_style", "deleted_style"],
  fossil_metrics: ["added_style", "deleted_style"],
  directory: ["repo_root_style", "before_repo_root_style", "read_only_style"],
  golang: ["not_capable_style"],
  nodejs: ["not_capable_style"],
  status: ["success_style", "failure_style"],
};

for (const [module, keys] of Object.entries(STYLE_OPTIONS)) {
  test(`${module} style options use swatches, inheritance and the shared palette`, async ({ page }) => {
    await loadConfig(page, `format = "[demo](#123456)$${module}"\npalette = "mine"\n[palettes.mine]\npeach = "#fab387"\n[${module}]\ndisabled = false\n`, module);
    const toml = page.getByLabel("starship.toml");
    for (const key of keys) {
      const row = page.locator(`[data-option="${key}"]`);
      await expect(row.getByRole("button", { name: `Expand ${key}`, exact: true })).toHaveCount(0);
      const swatch = row.getByRole("button", { name: `Change the style of ${key}`, exact: true });
      await swatch.press("Enter");
      await expect(swatch).toHaveAttribute("aria-expanded", "true");
      await expect(row.getByRole("button", { name: "Inherit", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(row.getByRole("button", { name: "Foreground: in the prompt, #123456", exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Foreground: palette colour peach", exact: true })).toBeDisabled();

      await row.getByRole("button", { name: "Override", exact: true }).press("Enter");
      await row.getByRole("button", { name: "Foreground: palette colour peach", exact: true }).press("Enter");
      await expect.poll(async () => (parse(await toml.inputValue())[module] as Record<string, unknown>)[key])
        .toMatch(/peach/);

      await row.getByRole("button", { name: "Inherit", exact: true }).press("Enter");
      await expect.poll(async () => (parse(await toml.inputValue())[module] as Record<string, unknown>)?.[key])
        .toBeUndefined();
      await expect(row.getByRole("button", { name: "Foreground: palette colour peach", exact: true })).toBeDisabled();
      await swatch.press("Enter");
    }
  });
}

for (const module of ["battery", "kubernetes"] as const) {
  const option = module === "battery" ? "display" : "contexts";
  const match = module === "battery" ? 'threshold = 100\ncharging_symbol = "charge"' : 'context_pattern = "production"\ncontext_alias = "prod"';
  test(`${module} nested styles preserve the rest of each rule`, async ({ page }) => {
    await loadConfig(page, `format = "[demo](#123456)$${module}"\n[${module}]\ndisabled = false\n[[${module}.${option}]]\n${match}\nstyle = "bold green"\n[[${module}.${option}]]\n${match}\nstyle = "yellow"\n`, module);
    await page.getByRole("button", { name: `Expand ${option}`, exact: true }).press("Enter");
    const row = page.getByRole("group", { name: "Style rule 1", exact: true });
    await row.getByRole("button", { name: "Change the style of style", exact: true }).press("Enter");
    await expect(row.getByRole("button", { name: "Override", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(row.getByRole("button", { name: "Foreground: in the prompt, #123456", exact: true })).toBeVisible();
    const toml = page.getByLabel("starship.toml");
    const before = (parse(await toml.inputValue())[module] as Record<string, unknown>)[option] as Record<string, unknown>[];
    await row.getByRole("button", { name: "Inherit", exact: true }).press("Enter");
    const expected = before.map((rule) => ({ ...rule }));
    delete expected[0].style;
    await expect.poll(async () => (parse(await toml.inputValue())[module] as Record<string, unknown>)[option]).toEqual(expected);
    await row.getByRole("button", { name: "Override", exact: true }).press("Enter");
    await row.getByRole("button", { name: "Foreground: blue", exact: true }).press("Enter");
    await expect.poll(async () => ((parse(await toml.inputValue())[module] as Record<string, unknown>)[option] as Record<string, unknown>[])[0].style).toMatch(/blue/);
    await expect.poll(async () => ((parse(await toml.inputValue())[module] as Record<string, unknown>)[option] as Record<string, unknown>[])[1]).toEqual(before[1]);
  });
}

test("optional styles follow the live module style, with explicit empty overrides and undo", async ({ page }) => {
  const config = (style: string) => `format = "$directory"\n[directory]\nstyle = "${style}"\n`;
  await loadConfig(page, config("bold blue"), "directory");
  const row = page.locator('[data-option="repo_root_style"]');
  await row.getByRole("button", { name: "Change the style of repo_root_style", exact: true }).press("Enter");
  await expect(row).toContainText("Inherits: Module style");
  await expect(row.getByRole("button", { name: "Foreground: blue", exact: true })).toHaveAttribute("aria-pressed", "true");
  const toml = page.getByLabel("starship.toml");
  await toml.fill(config("italic green"));
  await expect(row.getByRole("button", { name: "Foreground: green", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByRole("button", { name: "italic", exact: true })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Override", exact: true }).press("Enter");
  await expect.poll(async () => (parse(await toml.inputValue()).directory as Record<string, unknown>).repo_root_style).toBe("italic green");
  await row.getByRole("button", { name: "Edit raw style string", exact: true }).press("Enter");
  await row.getByRole("textbox", { name: "Raw style string", exact: true }).fill("");
  await expect.poll(async () => (parse(await toml.inputValue()).directory as Record<string, unknown>).repo_root_style).toBe("");
  await expect(row.getByRole("button", { name: "Override", exact: true })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Inherit", exact: true }).press("Enter");
  await expect.poll(async () => (parse(await toml.inputValue()).directory as Record<string, unknown>).repo_root_style).toBeUndefined();
  await page.getByRole("button", { name: "Undo", exact: true }).press("Enter");
  await expect(row.getByRole("button", { name: "Override", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByRole("textbox", { name: "Raw style string", exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Redo", exact: true }).press("Enter");
  await expect(row.getByRole("button", { name: "Inherit", exact: true })).toHaveAttribute("aria-pressed", "true");
});

for (const scheme of ["dark", "light"] as const) {
  test(`named and nested style controls are accessible in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await loadConfig(page, 'format = "[demo](#123456)$directory$battery$kubernetes"\n[battery]\ndisabled = false\n[[kubernetes.contexts]]\ncontext_pattern = "production"\n', "directory");
    await page.getByRole("button", { name: "Change the style of before_repo_root_style", exact: true }).press("Enter");
    for (const [module, option] of [["battery", "display"], ["kubernetes", "contexts"]]) {
      await page.getByRole("button", { name: `Expand $${module}`, exact: true }).press("Enter");
      await page.getByRole("button", { name: `Expand ${option}`, exact: true }).press("Enter");
      await page.locator(`[data-option="${option}"]`).getByRole("button", { name: "Change the style of style", exact: true }).press("Enter");
    }
    for (const mode of ["Inherit", "Override"]) {
      for (const toggle of await page.getByRole("button", { name: mode, exact: true }).all()) {
        await toggle.press("Enter");
      }
      const { violations } = await new AxeBuilder({ page })
        .include('[data-option="before_repo_root_style"]')
        .include('[data-option="display"]')
        .include('[data-option="contexts"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
}
