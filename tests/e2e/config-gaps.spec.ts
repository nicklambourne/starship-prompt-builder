import { expect, test, type Locator, type Page } from "@playwright/test";

async function activate(locator: Locator) {
  await locator.press("Enter");
}

async function openToml(page: Page) {
  const toggle = page.locator('[data-section="toml"] button[aria-expanded]');
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await activate(toggle);
}

async function loadModule(page: Page, module: string, toml: string) {
  await page.goto("./");
  await openToml(page);
  await page.getByLabel("starship.toml").fill(toml);
  await activate(page.getByRole("button", { name: `Expand $${module}`, exact: true }));
}

async function openOption(scope: Page | Locator, key: string) {
  const button = scope.locator(`[data-option="${key}"] button[aria-expanded]`).first();
  if ((await button.getAttribute("aria-expanded")) !== "true") await activate(button);
}

test("VCS is a first-class module and dispatches to the current git modules", async ({ page }) => {
  await loadModule(page, "vcs", 'format = "$vcs"\n[vcs]\ngit_modules = "$git_branch"\n');
  await expect(page.getByLabel("Simulated terminal prompt")).toContainText("feat/live-preview");
  const row = page.locator('[data-format-row]').filter({ hasText: "$vcs" });
  await openOption(row, "git_modules");
  await expect(row.locator('[data-option="git_modules"]')).toContainText("Git");
});

test("prompt-wide symlink scanning and WSL Starship path are editable", async ({ page }) => {
  await page.goto("./");
  await page.getByText("Other prompt-wide options", { exact: true }).press("Enter");
  await openOption(page, "follow_symlinks");
  await page.getByRole("switch", { name: "follow_symlinks" }).press("Enter");
  await openToml(page);
  const toml = page.getByLabel("starship.toml");
  await expect(toml).toHaveValue(/follow_symlinks = false/);

  await toml.fill('format = "$git_status"\n[git_status]\n');
  await activate(page.getByRole("button", { name: "Expand $git_status", exact: true }));
  const module = page.locator('[data-format-row]').filter({ hasText: "$git_status" });
  await openOption(module, "windows_starship");
  await module.getByRole("textbox", { name: "windows_starship" }).fill("C:\\Tools\\starship.exe");
  await expect(toml).toHaveValue(/windows_starship = "C:\\\\Tools\\\\starship.exe"/);
});
