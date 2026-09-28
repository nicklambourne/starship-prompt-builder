import { expect, test } from "@playwright/test";

test("copy preserves CRLF, typing keeps the cursor, and clipboard failures are actionable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (value: string) => {
        if (value.includes("fail-copy")) throw new Error("blocked");
        document.documentElement.dataset.copiedDraft = value;
      },
    } });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Paste a config", exact: true }).click();
  const editor = page.getByLabel("starship.toml");
  await editor.focus();
  await editor.press("ControlOrMeta+A");
  const source = '# CRLF source\r\nformat = "paste"\r\n';
  await editor.evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  }, source);
  await page.getByRole("button", { name: "Copy draft", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.copiedDraft)).toBe(source);
  await editor.focus();
  await editor.press("ControlOrMeta+End");
  await editor.pressSequentially("# tail");
  expect(await editor.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe((await editor.inputValue()).length);
  await page.getByRole("button", { name: "Copy draft", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.copiedDraft)).toBe(source + "# tail");
  await editor.fill('# fail-copy\nformat = "ok"\n');
  await page.getByRole("button", { name: "Copy draft", exact: true }).click();
  await expect(page.getByText("Clipboard unavailable. Select the draft and copy it with your keyboard.", { exact: true })).toBeVisible();
});

test("draft downloads are explicitly the applied configuration", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Paste a config", exact: true }).click();
  await page.getByLabel("starship.toml").fill('format = "unapplied-marker"\n');
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download applied config", exact: true }).first().click();
  const stream = await (await pending).createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk.toString();
  expect(content).not.toContain("unapplied-marker");
  await page.getByRole("button", { name: "Apply draft", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download applied config", exact: true })).toHaveCount(0);
});

test("TOML drafts retain source, preview without applying, and undo as one change", async ({ page }) => {
  await page.goto("./");
  await page.locator("[data-section='toml'] button[aria-expanded]").click();
  const editor = page.getByLabel("starship.toml");
  const original = await editor.inputValue();
  const draft = '# keep this comment\nformat = "draft-marker"\nadd_newline = false\n';
  await expect.poll(() => page.evaluate(() => location.hash)).not.toBe("");
  const oldHash = await page.evaluate(() => location.hash);
  await editor.fill(draft);
  await expect(editor).toHaveValue(draft);
  await expect(page.getByLabel("Simulated terminal prompt")).toContainText("draft-marker");
  await expect(page.getByText("Preview · unapplied TOML draft", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe(oldHash);
  await page.getByRole("button", { name: "Apply draft", exact: true }).click();
  await expect(editor).toHaveValue(draft);
  await expect(page.getByRole("button", { name: "Apply draft", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor).toHaveValue(original);
  await editor.fill('format = "unfinished');
  await expect(page.getByRole("button", { name: "Apply draft", exact: true })).toBeDisabled();
  await expect(editor).toHaveValue('format = "unfinished');
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(editor).toHaveValue(original);
});

test("a dirty draft survives a visual edit and disclosure collapse", async ({ page }) => {
  await page.goto("./");
  const toggle = page.locator("[data-section='toml'] button[aria-expanded]");
  await toggle.click();
  const editor = page.getByLabel("starship.toml");
  const draft = '# preserved\nformat = "pending"\n';
  await editor.fill(draft);
  await toggle.click();
  await page.getByRole("switch", { name: "Enable git_branch", exact: true }).click();
  await toggle.click();
  await expect(editor).toHaveValue(draft);
  await expect(page.getByRole("button", { name: "Apply draft over changed config" })).toBeEnabled();
});

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
