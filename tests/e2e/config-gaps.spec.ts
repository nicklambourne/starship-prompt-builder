import { expect, test, type Locator, type Page } from "@playwright/test";
import { parse } from "smol-toml";

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

for (const [module, key] of [
  ["c", "commands"],
  ["cpp", "commands"],
  ["fortran", "commands"],
  ["python", "python_binary"],
  ["terraform", "commands"],
] as const) {
  test(`${module}.${key} keeps commands and arguments nested`, async ({ page }) => {
    await loadModule(page, module, `format = "$${module}"\n[${module}]\ndisabled = false\n`);
    const row = page.locator('[data-format-row]').filter({ hasText: `$${module}` });
    await openOption(row, key);
    const second = row.getByRole("textbox", { name: "Command 1 argument 2" });
    if (await second.count()) await second.fill("--long-version");
    else {
      await row.getByRole("button", { name: "+ Add argument" }).first().press("Enter");
      await row.getByRole("textbox", { name: "Command 1 argument 2" }).fill("--long-version");
    }

    const config = parse(await page.getByLabel("starship.toml").inputValue()) as Record<string, Record<string, unknown>>;
    const commands = config[module][key] as string[][];
    expect(commands[0][1]).toBe("--long-version");
    expect(Array.isArray(commands[0])).toBe(true);
  });
}

test("directory substitutions switch between literal and ordered regex forms", async ({ page }) => {
  await loadModule(
    page,
    "directory",
    'format = "$directory"\n[directory.substitutions]\nDocuments = "docs"\n',
  );
  const row = page.locator('[data-format-row]').filter({ hasText: "$directory" });
  await openOption(row, "substitutions");
  await expect(row.getByRole("button", { name: "Literal map" })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Ordered / regex rules" }).press("Enter");
  await row.getByRole("switch", { name: "Regex rule 1" }).press("Enter");
  const config = parse(await page.getByLabel("starship.toml").inputValue()) as Record<string, Record<string, unknown>>;
  expect(config.directory.substitutions).toEqual([{ from: "Documents", to: "docs", regex: true }]);
});

test("custom conditions have explicit boolean and command modes", async ({ page }) => {
  await loadModule(
    page,
    "custom.project",
    'format = "${custom.project}"\n[custom.project]\ncommand = "echo workspace"\nwhen = "test -d .git"\n',
  );
  const row = page.locator('[data-format-row]').filter({ hasText: "$custom.project" });
  await openOption(row, "when");
  await expect(row.getByRole("button", { name: "Run condition command" })).toHaveAttribute("aria-pressed", "true");
  await row.getByRole("button", { name: "Always" }).press("Enter");
  await expect(page.getByLabel("starship.toml")).toHaveValue(/when = true/);
});

test("custom command output can be simulated without running a shell", async ({ page }) => {
  await loadModule(
    page,
    "custom.project",
    'format = "${custom.project}"\n[custom.project]\ncommand = "echo workspace"\nwhen = "test -d .git"\n',
  );
  const row = page.locator('[data-format-row]').filter({ hasText: "$custom.project" });
  await row.getByLabel("Simulated output for custom.project").fill("SIMULATED_RESULT");
  await expect(page.getByLabel("Simulated terminal prompt")).toContainText("SIMULATED_RESULT");
  await row.getByRole("switch", { name: "Condition command succeeds" }).press("Enter");
  await expect(page.getByLabel("Simulated terminal prompt")).not.toContainText("SIMULATED_RESULT");
  await expect(page.getByLabel("starship.toml")).not.toHaveValue(/SIMULATED_RESULT/);
});
