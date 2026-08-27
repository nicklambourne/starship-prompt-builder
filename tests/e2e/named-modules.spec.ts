import { expect, test, type Locator, type Page } from "@playwright/test";

async function activate(locator: Locator) {
  if (test.info().project.name === "mobile") {
    await locator.focus();
    await locator.press("Enter");
    return;
  }
  await locator.click();
}

async function openToml(page: Page) {
  const toggle = page.locator("[data-section='toml'] button[aria-expanded]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await activate(toggle);
}

async function openOption(scope: Locator, key: string) {
  const toggle = scope.locator(`[data-option="${key}"] button[aria-expanded]`).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await activate(toggle);
}

test.describe("user-named modules", () => {
  test("creates, configures, renames, and removes an environment-variable instance", async ({
    page,
  }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");
    await activate(format.getByRole("button", { name: /^\+ Add module$/ }));

    const creator = format.locator("form").filter({ hasText: "Create a named module" });
    await creator.getByLabel("Instance name").fill("PROMPT_SHELL");
    await activate(creator.getByRole("button", { name: "Create and add" }));

    let row = format
      .locator("[data-format-row]")
      .filter({ hasText: "$env_var.PROMPT_SHELL" })
      .last();
    await expect(row).toBeVisible();
    await activate(row.getByRole("button", { name: "Expand $env_var.PROMPT_SHELL" }));
    await openOption(row, "default");
    await row.getByRole("textbox", { name: "default", exact: true }).fill("zsh");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("zsh");

    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/\[env_var\.PROMPT_SHELL\]/);

    await row.getByLabel("Environment variable instance name").fill("PROMPT_EDITOR");
    await activate(row.getByRole("button", { name: "Rename" }));
    row = format
      .locator("[data-format-row]")
      .filter({ hasText: "$env_var.PROMPT_EDITOR" })
      .last();
    await expect(row).toBeVisible();
    await expect(page.getByLabel("starship.toml")).toHaveValue(/\[env_var\.PROMPT_EDITOR\]/);
    await expect(page.getByLabel("starship.toml")).not.toHaveValue(/PROMPT_SHELL/);

    await expect(row.getByRole("button", { name: "Remove named module" })).toHaveCount(0);
    await activate(row.getByRole("button", { name: "Remove $env_var.PROMPT_EDITOR", exact: true }));
    await expect(row).toHaveCount(0);
    await expect(page.getByLabel("starship.toml")).not.toHaveValue(/PROMPT_EDITOR/);
  });

  test("offers occurrence or global deletion when a named module is reused", async ({
    page,
  }) => {
    await page.goto("./");
    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    const repeated = [
      'format = "${env_var.SHELL}${env_var.SHELL}"',
      "",
      "[env_var.SHELL]",
      'default = "zsh"',
      "",
    ].join("\n");
    await toml.fill(repeated);

    const format = page.locator("[data-format-scope='root-format']");
    const rows = format.locator("[data-format-row]").filter({ hasText: "$env_var.SHELL" });
    await expect(rows).toHaveCount(2);
    await activate(rows.first().getByRole("button", { name: "Remove $env_var.SHELL", exact: true }));

    let dialog = page.getByRole("alertdialog", { name: "Remove $env_var.SHELL" });
    await expect(dialog).toContainText("2 prompt references");
    await activate(dialog.getByRole("button", { name: "Remove this occurrence" }));
    await expect(rows).toHaveCount(1);
    await expect(toml).toHaveValue(/\[env_var\.SHELL\]/);

    await toml.fill(repeated);
    await expect(rows).toHaveCount(2);
    await activate(rows.first().getByRole("button", { name: "Remove $env_var.SHELL", exact: true }));
    dialog = page.getByRole("alertdialog", { name: "Remove $env_var.SHELL" });
    await activate(dialog.getByRole("button", { name: "Delete named module everywhere" }));
    await expect(rows).toHaveCount(0);
    await expect(toml).not.toHaveValue(/env_var\.SHELL/);
  });

  test("discovers a named instance imported under its aggregate", async ({ page }) => {
    await page.goto("./");
    await openToml(page);
    await page.getByLabel("starship.toml").fill(
      [
        'format = "$custom"',
        "",
        "[custom.project]",
        'symbol = "P"',
        "when = true",
        "",
      ].join("\n"),
    );

    const format = page.locator("[data-format-scope='root-format']");
    await activate(format.getByRole("button", { name: /^\+ Add module$/ }));
    await format.getByPlaceholder("Search modules…").last().fill("custom.project");
    const candidate = format.getByRole("button", { name: /\$custom\.project/ });
    await expect(candidate).toBeVisible();
    await activate(candidate);

    const row = format
      .locator("[data-format-row]")
      .filter({ hasText: "$custom.project" })
      .last();
    await expect(row).toBeVisible();
    await activate(row.getByRole("button", { name: "Expand $custom.project" }));
    await expect(row.getByLabel("Custom command instance name")).toHaveValue("project");
    await expect(row.locator('[data-option="command"]')).toBeVisible();
  });
});
