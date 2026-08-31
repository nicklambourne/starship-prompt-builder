import { expect, test } from "@playwright/test";
import { decodeShare } from "../../src/lib/config/share";

/**
 * End-to-end coverage of flows that span the whole stack: a setting change
 * reaching the preview and the TOML, the format builder restructuring the
 * prompt, and the layout working at both breakpoints.
 *
 * There are no tabs — every pane is on one page — so these run identically on
 * desktop and mobile.
 */

/**
 * Activates a control: clicked on desktop, keyboard on a phone.
 *
 * Under Pixel 7 emulation Chromium's visual and layout viewports diverge, and
 * Playwright's hit test for a click lands somewhere else — on a card hundreds
 * of pixels down the page, or on the button next to the one being clicked.
 * The page is fine: `elementFromPoint` at the same coordinates returns the
 * intended element. Rather than lose pointer coverage everywhere to an
 * emulation artefact, the pointer path stays on desktop, where the mapping is
 * sound, and the phone drives the same control the way a keyboard would.
 */
async function activate(locator: import("@playwright/test").Locator) {
  if (test.info().project.name === "mobile") {
    await locator.focus();
    await locator.press("Enter");
    return;
  }
  await locator.click();
}

/** Opens the environment simulator and one of its sections. */
async function openEnvSection(page: import("@playwright/test").Page, section: string) {
  // The environment section is open by default; opening it would close it.
  const card = page.locator("[data-section='environment']");
  if (!(await card.evaluate((el: HTMLDetailsElement) => el.open))) {
    await activate(card.locator("> summary"));
  }
  await activate(
    card
      .locator("summary")
      .filter({ hasText: new RegExp(`^${section}`) })
      .first(),
  );
}

/**
 * A module's options are closed until asked for; this opens one by name.
 *
 * The header button reads "<key> <what it holds>", so the key anchors it.
 */
async function openOption(
  scope: import("@playwright/test").Locator,
  key: string,
): Promise<void> {
  // By `data-option` rather than by name: a header reads "<key><summary>" with
  // no separator, so `style` and `style_root` are indistinguishable by text.
  const toggle = scope.locator(`[data-option="${key}"] button[aria-expanded]`).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await activate(toggle);
}

/** The TOML card is collapsed by default; open it before reading or editing. */
async function openToml(page: import("@playwright/test").Page) {
  const toggle = page.locator("[data-section='toml'] button[aria-expanded]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await activate(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
}

/**
 * Replaces the default preset with a bare config, so the editor falls back to
 * its own expanded-and-grouped default structure.
 */
async function useStructuredDefault(page: import("@playwright/test").Page) {
  await openToml(page);
  await page.getByLabel("starship.toml").fill("add_newline = true\n");
  await expect(
    page.getByRole("button", { name: /^Reorder Git \(\d+\)/ }),
  ).toBeVisible();
  // The pane holds what was typed until the config round-trips back, so wait
  // for the re-serialised format before anything reads it.
  await expect(page.getByLabel("starship.toml")).toHaveValue(/^format = "\$/m);
}

test.describe("builder", () => {
  test("renders a prompt on load", async ({ page }) => {
    await page.goto("./");
    const terminal = page.getByLabel("Simulated terminal prompt");
    await expect(terminal).toBeVisible();
    await expect(terminal).toContainText("feat/live-preview");
  });

  test("a module's settings open inside its prompt row", async ({ page }) => {
    await page.goto("./");

    // There is no separate module list: the row that puts $directory in the
    // prompt is the row that configures it.
    await expect(page.getByRole("button", { name: /of \d+ modules/ })).toHaveCount(0);

    const row = page.getByRole("button", { name: /^\$directory/ }).first();
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.locator("li").filter({ has: row }).getByText("truncation_length"),
    ).toBeVisible();
  });

  test("a group can be opened and its children edited in place", async ({ page }) => {
    await page.goto("./");
    await useStructuredDefault(page);

    const group = page.getByRole("button", { name: /^Git \(\d+\)/ });
    await group.click();

    const groupItem = page.locator("li").filter({ has: group }).first();
    const children = groupItem.locator("ul > li");
    await expect(children).not.toHaveCount(0);

    // Children carry the same affordances as top-level rows.
    const first = children.first();
    await expect(first.getByRole("button", { name: /^Reorder / })).toBeVisible();
    await expect(first.getByRole("switch")).toBeVisible();
    await expect(first.getByRole("button", { name: /^Put / })).toBeVisible();
  });

  test("items reorder inside a group", async ({ page }) => {
    await page.goto("./");
    await useStructuredDefault(page);
    const toml = page.getByLabel("starship.toml");
    await page.getByRole("button", { name: /^Git \(\d+\)/ }).click();

    const inGroup = /\[\$(\w+)\$(\w+)/;
    const before = (await toml.inputValue()).match(inGroup);
    expect(before).not.toBeNull();

    const group = page.locator("li").filter({
      has: page.getByRole("button", { name: /^Git \(\d+\)/ }),
    }).first();
    await group.locator("ul > li").nth(1).getByRole("button", { name: /^Reorder / }).focus();
    await page.keyboard.press("ArrowUp");

    const after = (await toml.inputValue()).match(inGroup);
    expect(after).not.toBeNull();
    // The first two members of the group swapped, and it is still a group.
    expect([after![1], after![2]]).toEqual([before![2], before![1]]);
  });

  test("a prompt item toggles off rather than being deleted", async ({ page }) => {
    await page.goto("./");
    const terminal = page.getByLabel("Simulated terminal prompt");
    await expect(terminal).toContainText("feat/live-preview");

    const toggle = page.getByRole("switch", { name: "Enable git_branch" });
    await toggle.click();

    await expect(terminal).not.toContainText("feat/live-preview");
    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(
      /\[git_branch\][\s\S]*disabled = true/,
    );
    // The row stays put, so it can be switched back on.
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(terminal).toContainText("feat/live-preview");
  });

  test("the format builder reorders the prompt", async ({ page }) => {
    await page.goto("./");
    await useStructuredDefault(page);

    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    await expect(toml).toHaveValue(/format = /);

    // Reordering is a drag handle, but it is also keyboard-operable — which is
    // the behaviour worth pinning, since drag alone would exclude keyboard use.
    const firstFormat = /format = "\$(\w+)\$(\w+)/;
    const before = (await toml.inputValue()).match(firstFormat);
    expect(before).not.toBeNull();

    await page.getByRole("button", { name: /^Reorder \$\w+\./ }).first().focus();
    await page.keyboard.press("ArrowDown");

    const after = (await toml.inputValue()).match(firstFormat);
    expect(after).not.toBeNull();
    // The first two modules must have swapped, not merely changed somehow.
    expect([after![1], after![2]]).toEqual([before![2], before![1]]);
  });

  test("dragging onto a row's edge reorders it", async ({ page }) => {
    await page.goto("./");
    await useStructuredDefault(page);
    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    const firstTwo = /format = "\$(\w+)\$(\w+)/;
    const before = (await toml.inputValue()).match(firstTwo);
    expect(before).not.toBeNull();

    const handles = page.getByRole("button", { name: /^Reorder \$\w+\./ });
    // The top quarter of a row means "insert before", not "group with".
    await handles
      .nth(0)
      .dragTo(page.locator("[data-format-scope='root-format'] [data-format-row='2']"), {
        targetPosition: { x: 40, y: 2 },
      });

    const after = (await toml.inputValue()).match(firstTwo);
    expect(after).not.toBeNull();
    expect(after![1]).toBe(before![2]);
  });

  test("dragging onto the middle of a row groups the two together", async ({
    page,
  }) => {
    await page.goto("./");
    // The default preset's format is separators and modules interleaved; the
    // structured default is a plain run of modules, which is what this drag
    // is about.
    await useStructuredDefault(page);
    const toml = page.getByLabel("starship.toml");
    const firstTwo = (await toml.inputValue()).match(/format = "\$(\w+)\$(\w+)/);
    expect(firstTwo).not.toBeNull();

    const handles = page.getByRole("button", { name: /^Reorder \$\w+\./ });
    await handles
      .nth(0)
      .dragTo(page.locator("[data-format-scope='root-format'] [data-format-row='1']"), {
        targetPosition: { x: 60, y: 20 },
      });

    // The two loose modules become one group, in target-then-dragged order.
    await expect(toml).toHaveValue(
      new RegExp(`format = "\\[\\$${firstTwo![2]}\\$${firstTwo![1]}\\]\\(\\)`),
    );
  });

  test("opens already expanded and grouped, with named groups", async ({ page }) => {
    await page.goto("./");
    await useStructuredDefault(page);

    // No "expand" step: individual modules and named groups are there on load.
    await expect(page.getByRole("button", { name: /^Reorder \$directory\./ })).toBeVisible();
    // Cloud & Tools is deliberately NOT grouped by default: it spans from
    // kubernetes to azure, so gathering it would hoist AWS above the directory.
    for (const name of ["Git", "Languages", "Build Tools"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^Reorder ${name} \\(\\d+\\)`) }),
      ).toBeVisible();
    }

    // The exported format must match what is shown, or the preview lies.
    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/\[\$bun\$c\$cobol/);
    await expect(
      page.getByRole("button", { name: /^Reorder Cloud & Tools/ }),
    ).toHaveCount(0);
  });

  test("the group button groups only the item it is on", async ({ page }) => {
    await page.goto("./");
    await openToml(page);
    const toml = page.getByLabel("starship.toml");

    await page.getByRole("button", { name: "Put $directory in a group" }).click();
    await expect(toml).toHaveValue(/\[\$directory\]\(\)/);
    // The neighbouring module must not have been swept in.
    await expect(toml).not.toHaveValue(/\[\$directory\$/);
  });

  test("prompt elements are explained", async ({ page }) => {
    await page.goto("./");
    // The description appears next to the module, not only in linked docs.
    await expect(
      page.getByText("Shows the path to your current directory", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText("Shows the active branch of the repo in your current directory"),
    ).toBeVisible();

    // And on nested rows once a group is open.
    await useStructuredDefault(page);
    await page.getByRole("button", { name: /^Reorder Git \(\d+\)/ }).first().click();
  });

  test("header actions are icon buttons with accessible names", async ({ page }) => {
    await page.goto("./");
    for (const name of ["Undo", "Redo", "Reset to defaults", "Copy a share link"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: "View this project on GitHub" }),
    ).toBeVisible();
  });

  test("searching narrows the prompt tree and opens matching groups", async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByLabel("Search prompt items").fill("git_status");
    // The match lives inside the Git group, which opens to reveal it.
    await expect(page.getByRole("switch", { name: "Enable git_status" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^\$directory/ })).toHaveCount(0);
  });

  test("the starship.toml card starts closed and sits at the end", async ({ page }) => {
    await page.goto("./");
    const toggle = page.locator("[data-section='toml'] button[aria-expanded]");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("starship.toml")).toBeHidden();

    await activate(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("starship.toml")).toBeVisible();
  });

  test("the simulated environment drives the preview", async ({ page }) => {
    await page.goto("./");
    const terminal = page.getByLabel("Simulated terminal prompt");
    await expect(terminal).toContainText("feat/live-preview");

    await openEnvSection(page, "Version control");

    // Renaming the branch in the simulator must reach the rendered prompt.
    await page.getByLabel("Git branch").fill("release/2.0");
    await expect(terminal).toContainText("release/2.0");

    // starship shows `branch:upstream` while they differ, which is faithful —
    // clearing the upstream collapses it to the one name.
    await page.getByLabel("Upstream branch").fill("release/2.0");
    await expect(terminal).not.toContainText("feat/live-preview");
  });

  test("a failing exit code flips the character module", async ({ page }) => {
    await page.goto("./");
    await openEnvSection(page, "Last command");

    await page.getByLabel("Exit code").fill("127");
    // The exact red comes from whichever palette is loaded, so assert the
    // character changed colour rather than hard-coding one theme's value.
    const arrow = page
      .getByLabel("Simulated terminal prompt")
      .locator("span")
      .filter({ hasText: /^❯$/ })
      .last();
    await expect(arrow).toHaveCSS("color", /rgb\(2[0-9]{2}, 1[0-9]{2}, 1[0-9]{2}\)/);
  });

  test("the controls for otherwise-invisible modules are on screen", async ({
    page,
  }) => {
    await page.goto("./");
    const terminal = page.getByLabel("Simulated terminal prompt");

    // conda has no other source: nothing in the directory, the shell or the
    // environment variables reveals it, so without this field the module can
    // be enabled and still never appear.
    await openEnvSection(page, "Cloud & orchestration");
    await page.getByLabel("Conda environment").fill("science");
    await expect(terminal).toContainText("science");
    for (const label of ["Azure subscription", "Docker context", "NATS context"]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }

    // The rest are only in the default prompt once the format includes them,
    // so this checks the controls exist; the unit suite covers what they do.
    await openEnvSection(page, "Version control");
    await expect(page.getByRole("switch", { name: "Detached HEAD" })).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Inside a Mercurial repository" }),
    ).toBeVisible();
    await expect(page.getByLabel("Lines added")).toBeVisible();

    await openEnvSection(page, "System");
    await expect(page.getByLabel("Network namespace")).toBeVisible();
  });

  test("a variable's row explains it, not just the picker", async ({ page }) => {
    await page.goto("./");
    await activate(page.getByRole("button", { name: "Expand $git_branch" }));
    await openOption(page.locator("[data-format-row]").filter({ hasText: "$git_branch" }).first(), "format");

    // No further clicking: a module's format opens with its style groups
    // already open, so the variables and their explanations are on screen as
    // soon as the module is. The row itself is what someone reading a format
    // looks at — the "+ Add variable" list is a different surface, and was
    // the only one carrying these.
    // `${branch}` rather than `$branch`: a variable is spelled with braces, so
    // a row cannot be mistaken for a module of the same name.
    const row = page.locator("[data-format-row]").filter({ hasText: "${branch}" }).last();
    await expect(row).toContainText("The current branch name");

    // Still a disclosure, and closing the module puts the whole tree away.
    // The group's own toggle is deliberately not used here: several option
    // rows carry format editors of their own, so "the last Collapse Group on
    // the page" is not reliably the one holding this row.
    await activate(page.getByRole("button", { name: "Collapse $git_branch" }));
    await expect(row).toBeHidden();
  });

  test("a module's format editor explains its variables", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "Expand $git_branch" }).click();
    await openOption(
      page.locator("[data-format-row]").filter({ hasText: "$git_branch" }).first(),
      "format",
    );

    // The list of what can go in this module's format is variables, not
    // modules, and each one carries starship's own description.
    await page.getByRole("button", { name: "+ Add variable" }).first().click();
    // The innermost match: the outer row contains the list that contains it.
    const entry = page.getByRole("listitem").filter({ hasText: "${remote_name}" }).last();
    await expect(entry).toContainText("The remote name. (e.g. origin)");
  });

  test("the download sits in the preview header, left of the chevron", async ({
    page,
  }) => {
    await page.goto("./");
    const preview = page.locator("[data-section='preview']");
    const download = preview.getByRole("button", { name: "Download config" });
    await expect(download).toBeVisible();

    // Left of the collapse chevron, which is the last thing on the row.
    const order = await preview.evaluate((section) => {
      const row = section.firstElementChild!;
      const button = row.querySelector("button[aria-label='Download config']")!;
      return {
        downloadRight: button.getBoundingClientRect().right,
        chevronLeft: button.nextElementSibling!.getBoundingClientRect().left,
      };
    });
    expect(order.downloadRight).toBeLessThanOrEqual(order.chevronLeft + 1);

    // The header's other control still collapses the card, and the download
    // button is not what a click on the title hits.
    const toggle = preview.getByRole("button", { name: "Preview" });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(download).toBeVisible();
  });

  test("the TOML card offers one download, in its header", async ({ page }) => {
    await page.goto("./");
    // Let the first render settle: on a phone the cards stack, and clicking
    // the header mid-shift lands on whichever card is still moving past it.
    await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
    await openToml(page);
    const toml = page.locator("[data-section='toml']");

    await expect(toml.getByRole("button", { name: "Download config" })).toBeVisible();
    await expect(toml.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
    // The body used to carry a second one saying the same thing.
    await expect(
      toml.locator("#toml-body").getByRole("button", { name: /^Download/ }),
    ).toHaveCount(0);

    // And the file says where it was made.
    await expect(page.getByLabel("starship.toml")).toHaveValue(
      /^# starship\.toml — generated by Starship Prompt Builder \(https:\/\/starship\.ndl\.au\)/,
    );
  });

  test("the font picker links to the font it has selected", async ({ page }) => {
    await page.goto("./");
    const link = page.getByRole("link", { name: /^Download .* from Nerd Fonts$/ });

    await page.getByLabel("Terminal font").selectOption("jetbrains-mono");
    await expect(link).toHaveAttribute("href", /JetBrainsMono\.zip$/);
    await expect(link).toHaveAttribute("href", /nerd-fonts\/releases/);

    // The system stack is whatever the machine already has — nothing to fetch.
    await page.getByLabel("Terminal font").selectOption("system");
    await expect(link).toHaveCount(0);
  });

  test("the add button looks open while its list is open", async ({ page }) => {
    await page.goto("./");
    // Both the left and right prompt editors carry one; this is the left.
    const format = page.locator("[data-format-scope='root-format']");
    const add = format.getByRole("button", { name: /^\+ Add module$/ });
    const shut = await add.evaluate((el) => getComputedStyle(el).backgroundColor);

    await activate(add);
    // Renamed, because the label is what says a second press closes it.
    const open = format.getByRole("button", { name: /^− Add module$/ });
    await expect(open).toHaveAttribute("aria-expanded", "true");
    const lit = await open.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Announced *and* visible: aria-expanded alone left it looking untouched.
    expect(lit).not.toBe(shut);
    await expect(page.getByPlaceholder("Search modules…").last()).toBeVisible();

    await activate(open);
    await expect(add).toHaveAttribute("aria-expanded", "false");
    // Polled: the button transitions its background, so the frame right after
    // the click is still mid-fade.
    await expect
      .poll(() => add.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(shut);
  });

  test("a module's options explain themselves", async ({ page }) => {
    await page.goto("./");
    await activate(page.getByRole("button", { name: "Expand $username" }));

    const settings = page.locator("[data-format-row]").filter({ hasText: "$username" }).last();
    // Every row explains itself without being opened: starship's JSON Schema,
    // which these rows are built from, describes none of its options.
    await expect(settings).toContainText("show_always");
    await expect(settings).toContainText("Always shows the username module.");
    await expect(settings).toContainText("The style used when the user is root/admin.");
  });

  test("collapsing a row closes the style editor it opened", async ({ page }) => {
    await page.goto("./");
    // A row whose style is not inert — the ones that are say so instead.
    const styleButton = page
      .getByRole("button", { name: /^Change the style of \$/ })
      .first();
    const name = (await styleButton.getAttribute("aria-label"))!
      .replace("Change the style of ", "");
    // Style editors are counted rather than located: there is one editor in
    // the app at a time, and the question is whether it is still standing.
    const editors = page.getByRole("button", { name: "Foreground: none" });

    await activate(page.getByRole("button", { name: `Expand ${name}` }));
    await activate(styleButton);
    await expect(editors).toHaveCount(1);

    // The row's editor sits outside the part that collapses, so it used to
    // stay open on a row showing nothing else.
    await activate(page.getByRole("button", { name: `Collapse ${name}` }));
    await expect(editors).toHaveCount(0);

    // Closed, not merely hidden: reopening the row brings back the settings
    // and leaves the editor shut.
    await activate(page.getByRole("button", { name: `Expand ${name}` }));
    await expect(editors).toHaveCount(0);
  });

  test("a module's options start closed, saying what they are for", async ({ page }) => {
    await page.goto("./");
    const row = page.locator("[data-format-row]").filter({ hasText: "$cmd_duration" }).first();
    await activate(page.getByRole("button", { name: "Expand $cmd_duration" }));

    const option = row.locator('[data-option="min_time"]').first();
    const header = option.locator("button[aria-expanded]").first();
    const chevron = option.locator("button[aria-expanded]").last();
    await expect(header).toHaveAttribute("aria-expanded", "false");
    // A closed row is worth reading only if it says what the option is for.
    await expect(option).toContainText("Shortest duration to show time for");
    await expect(option.locator("input")).toHaveCount(0);

    // The row opens on being clicked anywhere, as a module's row does — so the
    // control being driven here is the text, not the chevron beside it.
    await expect(option.locator("button[aria-expanded]")).toHaveCount(2);
    await expect(header).toContainText("min_time");
    await activate(header);
    await expect(header).toHaveAttribute("aria-expanded", "true");
    await expect(option.locator("input")).toBeVisible();

    // And the chevron at the end is that same control, not a second state.
    await activate(chevron);
    await expect(header).toHaveAttribute("aria-expanded", "false");
    await expect(option.locator("input")).toHaveCount(0);
  });

  test("an overridden option has a reset button, and loses it again", async ({ page }) => {
    await page.goto("./");
    const row = page.locator("[data-format-row]").filter({ hasText: "$cmd_duration" }).first();
    await activate(page.getByRole("button", { name: "Expand $cmd_duration" }));
    await openOption(row, "show_milliseconds");

    // The preset sets this one, so the button is there from the start; it
    // marks the row whether or not the row is open.
    const reset = row.getByRole("button", { name: "Reset show_milliseconds to its default" });
    await expect(reset).toBeVisible();

    await activate(reset);
    await expect(reset).toHaveCount(0);

    // Setting it again brings the button back, so it tracks the value rather
    // than having been spent.
    await activate(row.getByLabel("show_milliseconds", { exact: true }));
    await expect(reset).toBeVisible();
  });

  test("the font size field resizes the prompt, and survives a reload", async ({
    page,
  }, info) => {
    await page.goto("./");
    const terminal = page.getByLabel("Simulated terminal prompt");
    const size = () => terminal.evaluate((el) => getComputedStyle(el).fontSize);

    const before = await size();
    await page.getByLabel("Font size").fill("22");
    await expect.poll(size).not.toBe(before);
    const bigger = Number.parseFloat(await size());
    expect(bigger).toBeGreaterThan(Number.parseFloat(before));

    // Where it sits: beside the other two where there is room, wrapped below
    // them on a phone rather than squeezing the names that need the width.
    const rows = await page.evaluate(() => {
      const top = (id: string) =>
        Math.round(document.getElementById(id)!.getBoundingClientRect().top);
      return { theme: top("theme-select"), font: top("font-select"), size: top("font-size") };
    });
    expect(rows.theme).toBe(rows.font);
    if (info.project.name === "mobile") expect(rows.size).toBeGreaterThan(rows.font);
    else expect(rows.size).toBe(rows.font);

    // It is a preview setting like the theme and the font, so it is kept.
    await page.reload();
    await expect(page.getByLabel("Font size")).toHaveValue("22");
    expect(Number.parseFloat(await size())).toBeCloseTo(bigger, 0);
  });

  test("a format that stops parsing mid-edit does not take the page down", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "mobile", "one platform is enough");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto("./");
    await activate(page.getByRole("button", { name: "Expand $git_status" }));
    const panel = page.locator("[data-format-row]").filter({ hasText: "$git_status" }).last();
    await openOption(panel, "format");
    await activate(panel.getByRole("button", { name: "Edit raw format string" }).first());

    // Either the raw editor or, once the string stops parsing, the one the
    // builder swaps in to show the error — the point is that it swaps rather
    // than crashing.
    const field = panel.locator("textarea").first();
    const original = await field.inputValue();

    /*
     * Every string someone passes through while deleting the brackets from
     * git_status's format, one character at a time. Deleting the first one
     * leaves the rest unbalanced, the format stops parsing, and this
     * component used to take a shorter path through its own hooks than the
     * render before it — React error #300, and the page went white.
     */
    for (let i = 0; i < original.length; i += 1) {
      if (original[i] !== "[" && original[i] !== "]") continue;
      await field.fill(original.slice(0, i) + original.slice(i + 1));
      await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
    }

    // And back: the hook count changes in that direction too.
    await field.fill(original);
    // Parsing again: the tree comes back in place of the error field.
    await expect(field).toHaveJSProperty("ariaInvalid", "false");
    await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the style button says when its editor is open", async ({ page }) => {
    await page.goto("./");
    const button = page
      .getByRole("button", { name: /^Change the style of \$/ })
      .first();
    const editor = page.getByRole("button", { name: "Foreground: none" });
    const background = () =>
      button.evaluate((el) => getComputedStyle(el).backgroundColor);

    /*
     * Driven by keyboard on both platforms, which is not the usual `activate`
     * split: a click leaves the pointer on the button, and hover fills it in
     * the same accent as the open state — so a painted assertion taken after
     * a click passes whether or not the open state exists at all.
     */
    const press = async () => {
      await button.focus();
      await button.press("Enter");
    };

    await expect(editor).toHaveCount(0);
    expect(await background()).toBe("rgba(0, 0, 0, 0)");

    await press();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(editor).toHaveCount(1);
    await expect(button).toHaveAttribute("data-open", "");
    // Filled, and in the accent: aria-expanded alone left it looking untouched.
    expect(await background()).not.toBe("rgba(0, 0, 0, 0)");

    await press();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(editor).toHaveCount(0);
    await expect(button).not.toHaveAttribute("data-open");
    await expect.poll(background).toBe("rgba(0, 0, 0, 0)");
  });

  test("text pieces stay separate, and stay when emptied", async ({ page }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");
    const textRows = format.locator("[data-format-row]").filter({ hasText: /^Text/ });
    const before = await textRows.count();

    // "a" then "b" is the same format string as "ab", so a tree re-derived
    // from the string joined them the moment the second one appeared.
    await activate(format.getByRole("button", { name: "+ Add text" }));
    await activate(format.getByRole("button", { name: "+ Add text" }));
    await expect(textRows).toHaveCount(before + 2);

    // And an emptied piece is the same string as no piece at all, so the row
    // used to vanish under the cursor mid-edit.
    await activate(textRows.last().getByRole("button", { name: /^Expand Text/ }));
    const field = page.getByLabel(/^Text content of/).last();
    await field.fill("");
    await expect(textRows).toHaveCount(before + 2);
    await expect(field).toBeVisible();

    // Still a live row: typing into it reaches the prompt.
    await field.fill("»");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("»");

    // The string still wins when it changes from somewhere else: the config
    // is the document, and this is only a way of holding one reading of it.
    await openToml(page);
    await page.getByLabel("starship.toml").fill('format = "$directory$character"\n');
    await expect(textRows).toHaveCount(0);
  });

  test("the palette card sits between the environment and the output", async ({
    page,
  }) => {
    await page.goto("./");
    const top = (name: string) =>
      page
        .locator(`[data-section='${name}']`)
        .evaluate((el) => el.getBoundingClientRect().top);
    expect(await top("palettes")).toBeGreaterThan(await top("environment"));
    expect(await top("palettes")).toBeLessThan(await top("toml"));
  });

  test("a curated palette can be taken and then edited", async ({ page }) => {
    await page.goto("./");
    const card = page.locator("[data-section='palettes']");
    await activate(card.locator("summary"));

    await card.getByLabel("Curated palettes").selectOption("gruvbox_dark");
    // Copied in, not referenced: it is the active palette and its colours are
    // editable rows.
    await expect(card.getByLabel("Active palette")).toHaveValue("gruvbox_dark");
    await expect(card.getByLabel(/^Value of colour /).first()).toBeVisible();

    // And it reaches the pickers, which is the point of naming colours.
    await activate(
      page.getByRole("button", { name: /^Change the style of \$/ }).first(),
    );
    await expect(
      page.getByRole("button", { name: "Foreground: palette colour color_orange" }),
    ).toBeVisible();
  });

  test("naming a colour from the prompt takes one click", async ({ page }) => {
    await page.goto("./");
    const card = page.locator("[data-section='palettes']");
    await activate(card.locator("summary"));

    // A colour written out in full, arriving the way most do.
    await openToml(page);
    await page.getByLabel("starship.toml").fill(
      // Root keys first: anything after a table header belongs to that table.
      [
        'format = "[$directory](fg:#ff00ff)$character"',
        'palette = "mine"',
        "",
        "[palettes.mine]",
        'peach = "#fab387"',
        "",
      ].join("\n"),
    );
    const chip = card.getByRole("button", { name: "Add #ff00ff to mine" });
    await expect(chip).toBeVisible();

    await activate(chip);
    // Now a palette entry, so it can be renamed and reused.
    await expect(card.getByLabel("Name of colour #ff00ff")).toHaveValue("#ff00ff");
    await expect(card.getByRole("button", { name: "Add #ff00ff to mine" })).toHaveCount(0);
  });

  test("a colour name survives being typed", async ({ page }) => {
    await page.goto("./");
    const card = page.locator("[data-section='palettes']");
    await activate(card.locator("summary"));

    // Keyed by name, the row was rebuilt on every keystroke and the field lost
    // focus after one character.
    const name = card.getByLabel(/^Name of colour /).first();
    await name.click();
    await name.press("End");
    await page.keyboard.type("xyz");
    await expect(name).toHaveValue(/xyz$/);
  });

  test("the style pickers offer the colours already in the prompt", async ({ page }) => {
    await page.goto("./");
    await activate(page.getByRole("button", { name: /^Change the style of \$/ }).first());
    // The same list as the palette card's row, where someone reaching for a
    // colour actually is.
    await expect(
      page.getByRole("button", { name: "Foreground: in the prompt, peach" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Background: in the prompt, peach" }),
    ).toBeVisible();
  });

  test("the palette card shows what the prompt is painted with", async ({ page }) => {
    await page.goto("./");
    const card = page.locator("[data-section='palettes']");
    await activate(card.locator("summary"));

    // The default preset paints itself entirely from its own palette.
    const chips = card.locator("span[title$='from the active palette']");
    await expect(chips.first()).toBeVisible();
    const named = await chips.count();

    // A colour written out in full is called out as such: it is the one that
    // will not follow the palette when it changes.
    await openToml(page);
    await page.getByLabel("starship.toml").fill(
      'format = "[$directory](fg:#ff00ff)$character"\n',
    );
    await expect(
      card.locator("span[title$='written out in full']").filter({ hasText: "#ff00ff" }),
    ).toBeVisible();
    expect(named).toBeGreaterThan(0);
  });

  test("a text piece can take a symbol from the Unicode section", async ({ page }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");
    const row = format.locator("[data-format-row]").filter({ hasText: /^Text/ }).first();
    await activate(row.getByRole("button", { name: /^Expand Text/ }));

    // Typed straight in: nothing about the field is ASCII-only.
    const field = page.getByLabel(/^Text content of/).first();
    await field.fill("λ");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("λ");

    // And through the picker, which is how a character nobody can type gets
    // in. The section leads the list because it is the one that works without
    // a patched font.
    await activate(row.getByRole("button", { name: /^Insert a symbol into/ }));
    const categories = page.getByRole("group", { name: "Symbol categories" });
    await expect(categories.getByRole("button").first()).toHaveText("Unicode");
    await activate(categories.getByRole("button", { name: "Unicode" }));
    // Located by title: the button's accessible name is the character it
    // shows, and one glyph is not a name anyone can search for.
    await activate(page.getByTitle("corner top left round arc · U+256D"));

    await expect(field).toHaveValue("λ╭");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("λ╭");

    // And it survives the round trip out to the config.
    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/λ╭/);
  });

  test("a config's thin space is named, though none can be picked", async ({
    page,
  }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");

    // Arriving from someone else's dotfiles rather than from this app.
    await openToml(page);
    await page.getByLabel("starship.toml").fill(
      'format = "$directory\u2009$character"\n',
    );
    // Named, so the reason the prompt looks like it has an ordinary space —
    // which in a terminal it effectively does — is visible rather than a
    // mystery in the config.
    await expect(format).toContainText("Text (thin space × 1)");

    // The picker offers none of them: measured in the preview's own font, a
    // thin space is exactly as wide as a space, so it promises nothing.
    const row = format.locator("[data-format-row]").filter({ hasText: /^Text/ }).first();
    await activate(row.getByRole("button", { name: /^Expand Text/ }));
    await activate(row.getByRole("button", { name: /^Insert a symbol into/ }));
    await activate(
      page.getByRole("group", { name: "Symbol categories" }).getByRole("button", {
        name: "Unicode",
      }),
    );
    await expect(page.getByTitle(/space · U\+/)).toHaveCount(0);
  });

  test("a row with nothing under it cannot be opened", async ({ page }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");

    // A real module has settings, so its disclosure works as before.
    await expect(format.getByRole("button", { name: "Expand $os" })).toBeEnabled();

    // Its variables do not: `$branch` takes its value from git_branch, and
    // the row used to open on an empty box.
    await activate(format.getByRole("button", { name: "Expand $git_branch" }));
    await openOption(format.locator("[data-format-row]").filter({ hasText: "$git_branch" }).first(), "format");
    const variable = page.getByRole("button", {
      name: /^\$\{branch\} — nothing to open/,
    });
    // No dead disclosure consuming the narrow variable row; the style
    // button is the useful control, and the variable's label stays readable.
    await expect(variable).toHaveCount(0);
    await expect(format.getByRole("button", { name: "Change the style of ${branch}", exact: true })).toBeEnabled();
  });

  test("a text piece can be switched off without losing it", async ({ page }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");
    const row = format.locator("[data-format-row]").filter({ hasText: /^Text/ }).first();
    const terminal = page.getByLabel("Simulated terminal prompt");

    await activate(row.getByRole("button", { name: /^Expand Text/ }));
    await page.getByLabel(/^Text content of/).first().fill("XX");
    await expect(terminal).toContainText("XX");

    // Off: gone from the prompt…
    await activate(row.getByRole("switch"));
    await expect(terminal).not.toContainText("XX");

    // …but still in the config, as a conditional holding no variables, which
    // starship renders as nothing. Kept there rather than in the app, so it
    // comes back with the switch after an export or a reload.
    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/\(\[XX\]\(red\)\)/);

    // And back on.
    await activate(row.getByRole("switch"));
    await expect(terminal).toContainText("XX");
  });

  test("a variable does not read as a module", async ({ page }) => {
    await page.goto("./");
    const format = page.locator("[data-format-scope='root-format']");

    // A module: bare sigil, in the accent the app uses for modules.
    const moduleRow = format
      .locator("[data-format-row]")
      .filter({ hasText: "$git_branch" })
      .first();
    await expect(moduleRow).toContainText("$git_branch");

    await activate(format.getByRole("button", { name: "Expand $git_branch" }));
    await openOption(moduleRow, "format");

    // Its variables: braces, and a colour of their own. Both signals, so it
    // survives greyscale and colour-blindness.
    const variableRow = page
      .locator("[data-format-row]")
      .filter({ hasText: "${branch}" })
      .last();
    await expect(variableRow).toBeVisible();

    const colours = await page.evaluate(() => {
      const label = (row: Element | null) =>
        row ? getComputedStyle(row.querySelector("span.font-mono")!).color : null;
      const rows = [...document.querySelectorAll("[data-format-row]")];
      // The module's row contains its variables, so the outermost match is
      // the module and the innermost is the variable.
      return {
        module: label(rows.find((r) => r.textContent?.includes("$git_branch")) ?? null),
        variable: label(
          rows.findLast((r) => r.textContent?.includes("${branch}")) ?? null,
        ),
      };
    });
    expect(colours.module).not.toBe(colours.variable);
  });

  test("installed tools can be simulated", async ({ page }) => {
    await page.goto("./");
    await openEnvSection(page, "Installed tools");

    const rust = page.getByRole("button", { name: "Rust", exact: true });
    await expect(rust).toHaveAttribute("aria-pressed", "false");
    await activate(rust);
    await expect(rust).toHaveAttribute("aria-pressed", "true");

    // Anything else is typed in, and the key is a module name rather than a
    // command name — so the field suggests them.
    await activate(page.getByRole("button", { name: "+ Add a tool" }));
    const key = page.getByLabel("module 2");
    const list = await key.getAttribute("list");
    expect(list).toBeTruthy();
    await expect(page.locator(`datalist#${list} option[value='zig']`)).toHaveCount(1);
  });

  test("the app theme can be switched", async ({ page }) => {
    // Explicit: the page follows the system now, so the starting point is a
    // property of the emulated environment rather than of the app.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: /^Switch to light theme/ }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    // The reversed neutral ramp must actually repaint the page.
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );

    await page.getByRole("button", { name: /^Switch to dark theme/ }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("the config downloads without opening the TOML card", async ({ page }) => {
    await page.goto("./");
    await expect(
      page.locator("[data-section='toml'] button[aria-expanded]"),
    ).toHaveAttribute("aria-expanded", "false");

    // Two cards carry the same button now, so this one says which.
    const download = page
      .locator("[data-section='toml']")
      .getByRole("button", { name: "Download config" });
    await expect(download).toBeVisible();

    const [file] = await Promise.all([
      page.waitForEvent("download"),
      activate(download),
    ]);
    expect(file.suggestedFilename()).toBe("starship.toml");
    // Downloading must not have expanded the card.
    await expect(
      page.locator("[data-section='toml'] button[aria-expanded]"),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("resetting asks first and can be cancelled", async ({ page }) => {
    await page.goto("./");

    // Make a change worth protecting.
    await openEnvSection(page, "Version control");
    await page.getByLabel("Git branch").fill("release/2.0");
    const terminal = page.getByLabel("Simulated terminal prompt");
    await expect(terminal).toContainText("release/2.0");

    await page.getByRole("button", { name: "Reset to defaults" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Reset everything?");

    // Cancelling leaves everything alone.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(terminal).toContainText("release/2.0");
  });

  test("the reset dialog dismisses with Escape", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "Reset to defaults" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("confirming the reset restores the starting prompt", async ({ page }) => {
    await page.goto("./");
    await openToml(page);

    // The starting preset itself disables some modules, so compare against
    // the config as it was rather than against the absence of any keyword.
    const toml = page.getByLabel("starship.toml");
    const starting = await toml.inputValue();

    await page.getByRole("switch", { name: "Enable git_branch" }).click();
    await expect(toml).not.toHaveValue(starting);

    await page.getByRole("button", { name: "Reset to defaults" }).click();
    // The dialog's two buttons sit side by side, and the same coordinate skew
    // puts a click for one of them onto the other.
    await activate(page.getByRole("dialog").getByRole("button", { name: "Reset" }));

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(toml).toHaveValue(starting);
  });

  test("explains why an enabled module shows nothing, and SSH fixes it", async ({
    page,
  }) => {
    await page.goto("./");
    const terminal = page.getByLabel("Simulated terminal prompt");

    // hostname is on but invisible in a local session — starship gates it on
    // SSH. Say so rather than looking like a bug.
    await useStructuredDefault(page);
    // Several modules are invisible in the default environment, so scope to
    // the hostname row.
    const pill = page
      .locator("li", { has: page.getByText("$hostname", { exact: true }) })
      .last()
      .getByText("Not visible", { exact: true });
    await expect(pill).toBeVisible();
    // The row says the state; the reason lives in the tooltip.
    await expect(pill).toHaveAttribute(
      "title",
      /starship only shows the hostname over SSH/,
    );
    // It sits beside the module name, not under it.
    expect(
      await pill.evaluate((el) => {
        const name = el.previousElementSibling!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return box.left >= name.right - 1 && box.top < name.bottom;
      }),
    ).toBe(true);
    await expect(terminal).not.toContainText("laptop");

    await openEnvSection(page, "Session");
    await page.getByRole("switch", { name: "Connected over SSH" }).click();

    await expect(terminal).toContainText("laptop");
    await expect(pill).toHaveCount(0);
  });

  test("the group button makes a group that survives", async ({ page }) => {
    await page.goto("./");
    await useStructuredDefault(page);
    // A new group holds one item, and a group of one used to dissolve on the
    // round trip through the format string — the button looked dead.
    const groups = page.getByRole("switch", { name: /^Enable everything in / });
    const before = await groups.count();
    await page.getByRole("button", { name: "Put $directory in a group" }).click();
    await expect(groups).toHaveCount(before + 1);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/\[\$directory\]\(\)/);
  });

  test("the preset picker starts the prompt format section", async ({ page }) => {
    await page.goto("./");
    // It sits in the format card, not the preview and not the header.
    const trigger = page
      .locator("[data-section='format']")
      .getByRole("button", { name: "Start from a preset" });
    await expect(trigger).toBeVisible();
  });

  test("the preset list says what each preset does, and whose it is", async ({
    page,
  }) => {
    await page.goto("./");
    await activate(page.getByRole("button", { name: "Start from a preset" }));
    const panel = page.locator("[aria-label='Presets']");

    // Seventeen names alone say nothing — "Jetpack" and "No Empty Icons" mean
    // something only to someone who has already seen them.
    await expect(panel.getByRole("button", { name: "Jetpack", exact: true })).toHaveAccessibleDescription(
      /pseudo-minimalist prompt/,
    );

    // The ones starship does not publish name their project and licence.
    await expect(panel).toContainText("rose-pine/starship · MIT");
    await expect(panel.getByRole("button", { name: "Rosé Pine Dawn", exact: true })).toBeVisible();
  });

  test("the palette panel credits whose palettes they are", async ({ page }) => {
    await page.goto("./");
    const palettes = page.locator("[data-section='palettes']");
    await activate(palettes.locator("summary").first());

    // The colours are the part of a theme its authors are known for, so the
    // panel handing them out says whose they are — and links the notices.
    await expect(palettes).toContainText("Palettes belong to their projects");
    await expect(palettes).toContainText("catppuccin/starship");
    await expect(palettes.getByRole("link", { name: "Full notices" })).toBeVisible();

    // And each entry names its project, not just the preset it came from.
    await expect(palettes.getByLabel("Curated palettes")).toContainText(
      "from Rosé Pine (rose-pine/starship)",
    );
  });

  test("a community preset loads like any other", async ({ page }) => {
    await page.goto("./");
    await openToml(page);
    await activate(page.getByRole("button", { name: "Start from a preset" }));
    await activate(
      page.locator("[aria-label='Presets']").getByRole("button", { name: "Dracula", exact: true }),
    );

    // Its own palette, and the lambda its project is known for.
    const toml = page.getByLabel("starship.toml");
    await expect(toml).toHaveValue(/\[palettes\.dracula\]/);
    await expect(toml).toHaveValue(/λ/);
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("λ");
  });

  test("a module can be removed outright, as well as switched off", async ({
    page,
  }) => {
    await page.goto("./");
    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    await expect(toml).toHaveValue(/\$git_branch/);

    // The switch hides a module; the bin takes it out of the format entirely.
    await page
      .getByRole("button", { name: "Remove $git_branch from the prompt" })
      .click();

    await expect(toml).not.toHaveValue(/\$git_branch/);
    await expect(
      page.getByRole("button", { name: "Remove $git_branch from the prompt" }),
    ).toHaveCount(0);
  });

  test("text pieces are labelled as text and removed with the same control", async ({
    page,
  }) => {
    await page.goto("./");
    // The default preset's separators are literal text, not modules.
    await expect(
      page.getByRole("button", { name: /^Reorder Text / }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Remove Text .* from the prompt$/ }).first(),
    ).toBeVisible();
  });

  test("the symbol picker opens in a popover, not inside the row", async ({
    page,
  }) => {
    await page.goto("./");
    // The field and its picker live behind the row's collapse control now.
    await page.getByRole("button", { name: /^Expand Text / }).first().click();
    const trigger = page
      .getByRole("button", { name: /^Insert a symbol into/ })
      .first();
    const row = page.locator("li").filter({ has: trigger }).first();
    const before = await row.boundingBox();

    await trigger.click();
    const popover = page.getByRole("dialog", { name: "Nerd Font symbols" });
    await expect(popover).toBeVisible();

    // It must not stretch the row it belongs to, and it must be wider than tall.
    const after = await row.boundingBox();
    expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);
    const box = await popover.boundingBox();
    expect(box!.width).toBeGreaterThan(box!.height);

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
  });

  test("a text piece keeps its field behind its collapse control", async ({
    page,
  }) => {
    await page.goto("./");
    // Anchor on the drag handle: the expand button renames itself on click.
    const row = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Reorder Text / }) })
      .first();
    const expand = row.getByRole("button", { name: /^(Expand|Collapse) Text / });
    const field = row.getByLabel(/^Text content of /);

    // Collapsed, the row is a label and its controls — no field, no picker.
    await expect(field).toBeHidden();
    await expect(row.getByRole("button", { name: /^Insert a symbol into/ })).toBeHidden();

    await expand.click();
    await expect(field).toBeVisible();
    await expect(row.getByRole("button", { name: /^Insert a symbol into/ })).toBeVisible();

    // It still edits the prompt.
    await field.fill(" | ");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("|");
  });

  test("a module's row edits the module's own style option", async ({ page }) => {
    await page.goto("./");
    // $os is `[$symbol]($style)` end to end: verified against real starship, a
    // style written around it in the prompt format never appears. Its own
    // `style` option is the one that paints, so the row's control sets that.
    const osRow = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Reorder \$os\b/ }) })
      .first();
    const control = osRow.getByRole("button", { name: "Change the style of $os" });
    await expect(control).toBeEnabled();

    await activate(control);
    await expect(osRow).toContainText("style option");
    await activate(osRow.getByRole("button", { name: "Foreground: red" }));

    // Written to the module, not as a wrapper around $os in the format.
    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    await expect(toml).toHaveValue(/\[os\][\s\S]*style = ["'][^"']*red/);
    await expect(toml).not.toHaveValue(/\[\$os\]\(/);

    // And the option itself is gone from the list, being on the row instead.
    await activate(page.getByRole("button", { name: "Expand $os" }));
    await expect(osRow.locator('[data-option="style"]')).toHaveCount(0);
    await expect(osRow.locator("[data-option]").first()).toBeVisible();
  });

  test("the strike follows the module's format, not a fixed list", async ({
    page,
  }) => {
    await page.goto("./");
    await openToml(page);
    const osRow = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Reorder \$os\b/ }) })
      .first();
    const toml = page.getByLabel("starship.toml");
    const osControl = page.getByRole("button", { name: "Change the style of $os" });

    // A module that has a style option is edited through it, whatever its
    // format spends: the control is the option, and the option always takes a
    // value. A format that has lost $style is said in the panel instead.
    await toml.fill('format = "$os"\n\n[os]\ndisabled = false\nformat = "[$symbol](bold red)"\n');
    await expect(osControl).toBeEnabled();
    await activate(osControl);
    await expect(osRow).toContainText("no longer uses");
    await activate(osRow.getByRole("button", { name: /^Expand \$os/ }));
    await expect(osRow.locator('[data-option="style"]')).toHaveCount(0);

    // Spending it again, the warning goes and the control is unchanged.
    await toml.fill('format = "$os"\n\n[os]\ndisabled = false\nformat = "[$symbol]($style)"\n');
    await expect(osControl).toBeEnabled();
    await expect(osRow).not.toContainText("no longer uses");

    // The strike is for the six modules with no style option of their own,
    // where the swatch is still a style written around them in the format.
    await toml.fill('format = "$username"\n\n[username]\nshow_always = true\nformat = "[$user]($style)"\n');
    await expect(
      page.getByRole("button", { name: /^Style of \$username — no effect/ }),
    ).toBeDisabled();
  });

  test("format item inheritance can be overridden without changing the module style", async ({
    page,
  }) => {
    await page.goto("./");
    await openToml(page);
    await page
      .getByLabel("starship.toml")
      .fill('format = "$os"\n\n[os]\ndisabled = false\nstyle = "bold green"\n');
    const osRow = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Reorder \$os\b/ }) })
      .first();

    await activate(osRow.getByRole("button", { name: /^Expand \$os/ }));
    await openOption(osRow, "format");
    // `[$symbol]($style)` reads back as one piece carrying the reference, so
    // the piece says what paints it — otherwise the format section shows no
    // sign of the `$style` that is written in it.
    const piece = osRow.locator('[data-option="format"] [data-format-row]').first();
    await expect(piece).toContainText("$style");
    await activate(piece.getByRole("button", { name: /style of/i }).first());
    await expect(piece).not.toContainText("Painted by the module");
    const inherit = piece.getByRole("button", { name: "Inherit", exact: true });
    const override = piece.getByRole("button", { name: "Override", exact: true });
    await expect(inherit).toHaveAttribute("aria-pressed", "true");
    await expect(piece.getByRole("button", { name: "bold", exact: true })).toBeDisabled();
    await expect(piece.getByRole("button", { name: "Foreground: red", exact: true })).toBeDisabled();

    await activate(override);
    await expect(override).toHaveAttribute("aria-pressed", "true");
    await expect(piece.getByRole("button", { name: "bold", exact: true })).toHaveAttribute("aria-pressed", "true");
    await activate(piece.getByRole("button", { name: "Foreground: red" }).first());
    const toml = page.getByLabel("starship.toml");
    await expect(toml).toHaveValue(/format = "\[\$symbol\]\(bold red\)"/);
    await expect(toml).toHaveValue(/style = "bold green"/);

    await activate(inherit);
    await expect(inherit).toHaveAttribute("aria-pressed", "true");
    await expect(toml).not.toHaveValue(/\(bold red\)/);
    await expect(toml).toHaveValue(/style = "bold green"/);
    await activate(page.getByRole("button", { name: /^Undo/ }));
    await expect(override).toHaveAttribute("aria-pressed", "true");
    await expect(toml).toHaveValue(/\(bold red\)/);
    await activate(page.getByRole("button", { name: /^Redo/ }));
    await expect(inherit).toHaveAttribute("aria-pressed", "true");
  });

  for (const target of ["variable", "text", "group"] as const) {
    test(`format item inheritance restores the surrounding group after a ${target} override`, async ({ page }) => {
      await page.goto("./");
      await openToml(page);
      const toml = page.getByLabel("starship.toml");
      const inner = target === "variable" ? "$symbol" : target === "text" ? "hello" : "$symbol hello";
      await toml.fill(`format = "$os"\n[os]\ndisabled = false\nstyle = "none"\nformat = "[[${inner}](\${style}) tail](blue)"\n`);
      await activate(page.getByRole("button", { name: "Expand $os", exact: true }));
      const option = page.locator('[data-option="format"]');
      await openOption(page.locator("li").filter({ has: page.getByRole("button", { name: /^Reorder \$os\b/ }) }).first(), "format");
      const piece = option.locator('[data-format-row="0.0"]');
      await activate(piece.getByRole("button", { name: /^Change the style of/ }).first());
      await expect(piece.getByRole("button", { name: "Inherit", exact: true })).toHaveAttribute("aria-pressed", "true");
      await activate(piece.getByRole("button", { name: "Override", exact: true }));
      await activate(piece.getByRole("button", { name: "Edit raw style string", exact: true }));
      // An empty override must stay explicit, not silently become inheritance.
      await piece.getByRole("textbox", { name: "Raw style string" }).fill("");
      await expect(toml).toHaveValue(/\]\(none\) tail\]\(blue\)/);
      await expect(piece.getByRole("button", { name: "Override", exact: true })).toHaveAttribute("aria-pressed", "true");
      await activate(piece.getByRole("button", { name: "Foreground: red", exact: true }));
      await expect(toml).toHaveValue(/\]\(red\) tail\]\(blue\)/);
      await expect(toml).toHaveValue(/style = "none"/);

      await expect.poll(() => decodeShare(new URL(page.url()).hash)?.os)
        .toMatchObject({ format: `[[${inner}](red) tail](blue)` });
      await page.reload();
      await activate(page.getByRole("button", { name: "Expand $os", exact: true }));
      await openOption(page.locator("li").filter({ has: page.getByRole("button", { name: /^Reorder \$os\b/ }) }).first(), "format");
      await activate(piece.getByRole("button", { name: /^Change the style of/ }).first());
      await expect(piece.getByRole("button", { name: "Override", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(piece.getByRole("button", { name: "Foreground: red", exact: true })).toHaveAttribute("aria-pressed", "true");
      await activate(piece.getByRole("button", { name: "Inherit", exact: true }));
      await openToml(page);
      // Inherit removes this item's override, allowing the nearest group
      // to paint it. It must not bypass that group by reintroducing $style.
      await expect.poll(() => toml.inputValue()).toContain(`format = "[${inner} tail](blue)"`);
      await expect(toml).toHaveValue(/style = "none"/);
    });
  }

  test("a format that has stopped spending $style can be put back", async ({
    page,
  }) => {
    await page.goto("./");
    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    await toml.fill(
      'format = "$os"\n\n[os]\ndisabled = false\nformat = "[$symbol](red)"\nstyle = "bold green"\n',
    );
    const osRow = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Reorder \$os\b/ }) })
      .first();

    await activate(osRow.getByRole("button", { name: "Change the style of $os" }));
    await expect(osRow).toContainText("no longer uses");

    // The edit that fixes it, made in the open rather than behind the reader.
    await activate(osRow.getByRole("button", { name: "Put $style back" }));
    await expect(osRow).not.toContainText("no longer uses");
    await expect(toml).not.toHaveValue(/\(red\)/);
    // and the value it was holding all along is untouched
    await expect(toml).toHaveValue(/style = "bold green"/);

    // The edit lands in the `format` option, so that is what it opens on.
    const format = osRow.locator('[data-option="format"]').first();
    await expect(format.locator("button[aria-expanded]").first()).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    // Back on the module's own default, so nothing is marked as overridden —
    // the TOML prints no format line either.
    await expect(format.getByRole("button", { name: /^Reset format/ })).toHaveCount(0);
    await expect(toml).not.toHaveValue(/\[os\][\s\S]*format =/);
  });

  test("modules carry a collapse indicator", async ({ page }) => {
    await page.goto("./");
    const chevron = page
      .getByRole("button", { name: /^Expand \$directory/ })
      .first();
    await expect(chevron).toHaveAttribute("aria-expanded", "false");
    await chevron.click();
    await expect(
      page.getByRole("button", { name: /^Collapse \$directory/ }).first(),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("the logo outgrows the header bar without moving it", async ({
    page,
  }, info) => {
    await page.goto("./");
    const measured = await page.evaluate(() => {
      const header = document.querySelector("header")!;
      const logo = header.querySelector("svg")!;
      const bar = header.getBoundingClientRect();
      const mark = logo.getBoundingClientRect();
      return {
        header: Math.round(bar.height),
        mark: Math.round(mark.width),
        // Layout height, which is what the row is sized by — the mark draws
        // larger than this and reaches into the bar's padding.
        laidOut: Math.round(mark.height + 2 * parseFloat(getComputedStyle(logo).marginTop)),
        clearsTop: mark.top - bar.top,
        clearsBottom: bar.bottom - mark.bottom,
      };
    });

    expect(measured.mark).toBeGreaterThan(measured.laidOut);
    // The bar is 61px on desktop and 99px wrapped on a phone; both are what
    // they were before the mark grew.
    expect(measured.header).toBe(info.project.name === "mobile" ? 99 : 61);
    // And it stays inside the bar rather than crossing its border.
    expect(measured.clearsTop).toBeGreaterThan(0);
    expect(measured.clearsBottom).toBeGreaterThan(0);
  });

  test("the header carries the logo, not an emoji", async ({ page }) => {
    await page.goto("./");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Starship Prompt Builder");
    // The mark is decorative — the heading text already names the site.
    await expect(heading.locator("svg")).toBeVisible();

    const favicon = page.locator("link[rel='icon']");
    await expect(favicon).toHaveAttribute("href", /icon\..*svg/);
  });

  test("map options edit as rows with the glyph picker, not raw JSON", async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByRole("button", { name: /^\$os/ }).first().click();
    await openOption(
      page.locator("[data-format-row]").filter({ hasText: "$os" }).first(),
      "symbols",
    );

    // os.symbols used to fall through to a JSON textarea, which rendered its
    // Nerd Font glyphs as tofu and offered no way to insert one.
    const values = page.locator("input[aria-label^='symbols value for']");
    await expect(values.first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Insert a symbol into symbols value/ }).first(),
    ).toBeVisible();

    const font = await values.first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/Nerd Font/i);
  });

  test("every text field in the format editor uses the terminal font", async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByRole("button", { name: /^\$os/ }).first().click();

    const offenders = await page.evaluate(() => {
      const fields = [
        ...document.querySelectorAll(
          "[data-section='format'] input, [data-section='format'] textarea",
        ),
      ].filter(
        (el) =>
          !["checkbox", "number", "color", "search"].includes(
            (el as HTMLInputElement).type,
          ),
      );
      return fields
        .filter((el) => !/Nerd Font/i.test(getComputedStyle(el).fontFamily))
        .map((el) => el.getAttribute("aria-label") ?? el.id ?? "?");
    });
    expect(offenders).toEqual([]);
  });

  test("style modifiers are icon buttons that keep their names", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: /^Change the style of/ }).first().click();

    for (const name of ["bold", "italic", "underline", "strikethrough", "dimmed"]) {
      const button = page.getByRole("button", { name, exact: true }).first();
      await expect(button).toBeVisible();
      // The word is gone: what is left is a single styled letter (B/I/U/S) or
      // a drawn icon. The name survives only as the accessible label.
      const mark = await button.evaluate((el) => ({
        text: el.textContent?.trim() ?? "",
        svg: !!el.querySelector("svg"),
      }));
      expect(mark.text.length <= 1 || mark.svg).toBe(true);
      expect(mark.text.toLowerCase()).not.toBe(name);
    }
  });

  test("palette swatches show their colour, not their name", async ({ page }) => {
    await page.goto("./");
    // The default preset defines a palette, so its entries appear as swatches.
    await page.getByRole("button", { name: /^Change the style of/ }).first().click();

    const swatches = page.getByRole("button", { name: /palette colour/ });
    await expect(swatches.first()).toBeVisible();

    const state = await swatches.evaluateAll((els) => ({
      total: els.length,
      coloured: els.filter((el) => (el as HTMLElement).style.backgroundColor).length,
      lettered: els.filter((el) => (el.textContent ?? "").trim().length > 0).length,
    }));
    expect(state.total).toBeGreaterThan(0);
    expect(state.coloured).toBe(state.total);
    expect(state.lettered).toBe(0);
  });

  test("input fields are set in a readable size", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: /^\$os/ }).first().click();

    const small = await page.evaluate(() => {
      const fields = [
        ...document.querySelectorAll(
          "[data-section='format'] input, [data-section='format'] textarea",
        ),
      ].filter((el) => !["checkbox", "color"].includes((el as HTMLInputElement).type));
      return fields
        .filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.getAttribute("aria-label") ?? el.id ?? "?");
    });
    expect(small).toEqual([]);
  });

  test("the toml card's chevron follows its download button", async ({ page }) => {
    await page.goto("./");
    const boxes = await page
      .locator("[data-section='toml']")
      .evaluate((el) => {
        const buttons = [...el.querySelectorAll("button")];
        const download = buttons.find((b) => /Download config/.test(b.textContent ?? ""))!;
        const chevron = el.querySelector("svg.transition-transform")!;
        return {
          downloadRight: download.getBoundingClientRect().right,
          chevronLeft: chevron.getBoundingClientRect().left,
          chevronRight: chevron.getBoundingClientRect().right,
          cardRight: el.getBoundingClientRect().right,
          sameRow:
            Math.abs(
              download.getBoundingClientRect().top - chevron.getBoundingClientRect().top,
            ) < 20,
        };
      });
    expect(boxes.chevronLeft).toBeGreaterThanOrEqual(boxes.downloadRight);
    expect(boxes.sameRow).toBe(true);
    // Right-aligned: nothing but the chevron and the card's padding beyond it.
    expect(boxes.cardRight - boxes.chevronRight).toBeLessThan(24);
  });

  test("the download button is icon-only on a phone", async ({ page }, info) => {
    await page.goto("./");
    const download = page
      .locator("[data-section='toml']")
      .getByRole("button", { name: "Download config" });
    // The label is what gives way; the button keeps its accessible name.
    await expect(download).toContainText(
      info.project.name === "mobile" ? "" : "Download config",
    );
    const width = await download.evaluate((el) => el.getBoundingClientRect().width);
    if (info.project.name === "mobile") expect(width).toBeLessThan(48);
    else expect(width).toBeGreaterThan(80);
  });

  test("the usage guide explains what to do with the file", async ({ page }) => {
    await page.goto("./");
    const toml = page.locator("[data-section='toml']");
    const guide = page.locator("[data-section='usage']");
    // The guide lives inside the toml card, next to the file it describes.
    await expect(guide).toHaveCount(0);
    await openToml(page);
    await expect(toml.locator("[data-section='usage']")).toHaveCount(1);
    await expect(guide.getByText("Put the file where starship looks for it")).toBeVisible();

    // The init line follows the shell chosen in the simulated environment.
    await expect(guide.getByText(/set to Zsh in the simulated/)).toBeVisible();
    await openEnvSection(page, "Session");
    // "Shell" also matches SHLVL and the Nix-shell switch, so pick the one
    // select that offers shells.
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="fish"]') })
      .selectOption("fish");
    await expect(guide.getByText(/set to Fish in the simulated/)).toBeVisible();
    await expect(guide.getByText("~/.config/fish/config.fish")).toBeVisible();
  });

  test("the preview spans the page above the columns", async ({ page }, info) => {
    await page.goto("./");
    const preview = page.locator("[data-section='preview']");
    const explainer = page.locator("[data-section='explainer']");

    const boxes = await page.evaluate(() => {
      const box = (sel: string) => {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width };
      };
      return {
        explainer: box("[data-section='explainer']"),
        preview: box("[data-section='preview']"),
        format: box("[data-section='format']"),
        environment: box("[data-section='environment']"),
      };
    });
    // Below the explainer, above the editor…
    await expect(explainer).toBeVisible();
    await expect(preview).toBeVisible();
    expect(boxes.preview.top).toBeGreaterThanOrEqual(boxes.explainer.bottom - 1);
    expect(boxes.preview.bottom).toBeLessThanOrEqual(boxes.format.top + 1);

    // On a phone the editor follows the preview; the environment and the
    // output sit after it.
    if (info.project.name === "mobile") {
      expect(boxes.format.top).toBeLessThan(boxes.environment.top);
    }

    if (info.project.name === "desktop") {
      // …and as wide as both columns together.
      expect(boxes.preview.width).toBeGreaterThan(boxes.format.width + 100);
      expect(boxes.preview.width).toBeGreaterThan(boxes.environment.width + 100);
    }
  });

  test("the environment is its own section, open with its parts closed", async ({
    page,
  }) => {
    await page.goto("./");
    const card = page.locator("[data-section='environment']");
    await expect(card).toHaveAttribute("open", "");
    // Its heading is no longer buried inside the preview.
    await expect(page.locator("[data-section='preview']").getByText("Simulated environment")).toHaveCount(0);

    const inner = card.locator("details");
    const count = await inner.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i += 1) {
      await expect(inner.nth(i)).not.toHaveAttribute("open", "");
    }

    // The controls still reach the preview from their new home.
    await openEnvSection(page, "Session");
    await card.getByLabel("Username").fill("ada");
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("ada");
  });

  test("installed tools are icon buttons named by their tooltip", async ({
    page,
  }) => {
    await page.goto("./");
    await openEnvSection(page, "Installed tools");
    // Scoped: a module row's description mentions Node.js too.
    const node = page
      .locator("[data-section='environment']")
      .getByRole("button", { name: "Node.js", exact: true });
    await expect(node).toHaveAttribute("title", "Node.js");
    // A mark, not the word.
    await expect(node).not.toContainText("Node.js");

    const shape = await node.evaluate((el) => {
      const button = el.getBoundingClientRect();
      const mark = el.querySelector("svg")!.getBoundingClientRect();
      return {
        width: Math.round(button.width),
        height: Math.round(button.height),
        radius: getComputedStyle(el).borderRadius,
        markWidth: Math.round(mark.width),
        // The mark is a vendored brand path, filled with the tool's colour.
        fill: getComputedStyle(el.querySelector("svg")!).fill,
      };
    });

    expect(shape.width).toBe(shape.height);
    expect(shape.radius).not.toBe("0px");
    expect(shape.fill).toBe("rgb(95, 160, 78)");
    // The mark fills most of the button rather than floating in it: this was
    // a 24px glyph in a 44px box, which read as a sticker on a wall.
    expect(shape.markWidth / shape.width).toBeGreaterThan(0.6);

    // It still toggles the tool, which decides whether the module renders.
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await node.click();
    await expect(node).toHaveAttribute("aria-pressed", "false");
  });

  test("removing an entry uses the trash icon, not a cross", async ({ page }) => {
    await page.goto("./");
    await openEnvSection(page, "Installed tools");
    const remove = page
      .locator("[data-section='environment']")
      .getByRole("button", { name: "Remove nodejs" });
    await expect(remove.locator("svg")).toHaveCount(1);
    await expect(remove).not.toContainText("✕");
  });

  test("the environment's description sits in its body, like the editor's", async ({
    page,
  }) => {
    await page.goto("./");
    const card = page.locator("[data-section='environment']");
    const summary = card.locator("> summary");
    await expect(summary).toHaveText("Simulated environment");
    await expect(card.locator("> p")).toContainText("which modules appear");
  });

  test("the kubernetes namespace waits for a context, and says so", async ({
    page,
  }) => {
    await page.goto("./");
    await openEnvSection(page, "Cloud & orchestration");
    const namespace = page.getByLabel("Kubernetes namespace");
    const context = page.getByLabel("Kubernetes context");

    // Without a context there is nothing for a namespace to belong to; it used
    // to swallow every keystroke instead of saying that.
    await expect(namespace).toBeDisabled();
    const note = page.getByText(/Set a context first/);
    await expect(note).toBeVisible();
    await expect(namespace).toHaveAttribute(
      "aria-describedby",
      await note.getAttribute("id") as string,
    );

    await context.fill("prod-cluster");
    await expect(namespace).toBeEnabled();
    await expect(note).toHaveCount(0);
    await namespace.fill("production");
    await expect(namespace).toHaveValue("production");

    // Clearing the context takes the namespace with it, as starship would.
    await context.fill("");
    await expect(namespace).toBeDisabled();
    await expect(namespace).toHaveValue("");
  });

  test("the interface starts in the system colour scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    // Set before paint, not after hydration.
    const painted = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(painted).not.toBe("rgb(0, 0, 0)");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("the toggle outranks the system, and keeps outranking it", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: /Switch to light theme/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // The OS changing underneath must not undo a deliberate choice.
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("a shared link opens on the config it carries", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./");
    await openToml(page);
    await page
      .getByLabel("starship.toml")
      .fill('format = "$directory"\n\n[directory]\nstyle = "bold magenta"\n');
    await expect(page.getByLabel("Simulated terminal prompt")).toBeVisible();

    await page.getByRole("button", { name: /Copy a share link/ }).click();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain("#");

    // The whole point: opening it somewhere else reproduces the prompt.
    const fresh = await context.newPage();
    await fresh.goto(url);
    await openToml(fresh);
    await expect(fresh.getByLabel("starship.toml")).toHaveValue(/bold magenta/);
    await fresh.close();
  });

  test("a broken fragment is ignored rather than fatal", async ({ page }) => {
    await page.goto("./#not-a-real-payload");
    // Falls back to the default prompt instead of an empty or crashed page.
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("you");
  });

  test("the session survives a reload", async ({ page }) => {
    await page.goto("./");
    // Something from each of the three things that used to be lost.
    await openEnvSection(page, "Session");
    await page.locator("[data-section='environment']").getByLabel("Username").fill("ada");
    await page.getByLabel("Terminal font").selectOption({ index: 1 });
    await page.getByLabel("Terminal color scheme").selectOption({ index: 2 });
    const font = await page.getByLabel("Terminal font").inputValue();
    const scheme = await page.getByLabel("Terminal color scheme").inputValue();
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("ada");

    await page.reload();

    await expect(page.getByLabel("Simulated terminal prompt")).toContainText("ada");
    await expect(page.getByLabel("Terminal font")).toHaveValue(font);
    await expect(page.getByLabel("Terminal color scheme")).toHaveValue(scheme);
  });

  test("a shared link's config beats the stored one", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./");
    await openToml(page);
    await page
      .getByLabel("starship.toml")
      .fill('format = "$directory"\n\n[directory]\nstyle = "bold magenta"\n');
    await page.getByRole("button", { name: /Copy a share link/ }).click();
    const shared = await page.evaluate(() => navigator.clipboard.readText());

    // Leave a different config in storage, then follow the link somewhere new.
    await page.getByLabel("starship.toml").fill('format = "$username"\n');
    await expect(page.getByLabel("starship.toml")).toHaveValue(/username/);
    await page.waitForTimeout(400);

    const fresh = await context.newPage();
    await fresh.goto(shared);
    await openToml(fresh);
    await expect(fresh.getByLabel("starship.toml")).toHaveValue(/bold magenta/);
    await fresh.close();
  });

  test("the address bar keeps up with the config", async ({ page }) => {
    await page.goto("./");
    await openToml(page);
    await page.getByLabel("starship.toml").fill('format = "$directory"\n');
    await expect
      .poll(() => page.evaluate(() => window.location.hash.length))
      .toBeGreaterThan(1);
    const first = await page.evaluate(() => window.location.hash);

    // Editing again must move it on, or the URL describes a prompt that is
    // no longer on screen.
    await page.getByLabel("starship.toml").fill('format = "$username"\n');
    await expect
      .poll(() => page.evaluate(() => window.location.hash))
      .not.toBe(first);

    // And what it describes is what a reload shows.
    await page.reload();
    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/\$username/);
  });

  test("a finger can reorder the prompt", async ({ page, context }, info) => {
    // The point of the pointer-event rewrite: HTML5 drag-and-drop never fires
    // on touch, so on a phone the handles did nothing at all.
    test.skip(info.project.name !== "mobile", "touch input only");

    await page.goto("./");
    await useStructuredDefault(page);
    await openToml(page);
    const toml = page.getByLabel("starship.toml");
    const firstTwo = /format = "\$(\w+)\$(\w+)/;
    const before = (await toml.inputValue()).match(firstTwo);
    expect(before).not.toBeNull();

    const handle = page.getByRole("button", { name: /^Reorder \$\w+\./ }).nth(0);
    await handle.scrollIntoViewIfNeeded();
    const from = (await handle.boundingBox())!;
    const to = (await page
      .locator("[data-format-scope='root-format'] [data-format-row='2']")
      .boundingBox())!;

    const cdp = await context.newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      x: number,
      y: number,
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: type === "touchEnd" ? [] : [{ x, y }],
      });

    const startX = from.x + from.width / 2;
    const startY = from.y + from.height / 2;
    await touch("touchStart", startX, startY);
    for (let step = 1; step <= 6; step += 1) {
      const t = step / 6;
      await touch(
        "touchMove",
        startX + (to.x + 40 - startX) * t,
        startY + (to.y + 3 - startY) * t,
      );
    }
    // The row it will land on says so while the finger is still down.
    await expect(
      page.locator("[data-format-row='2'] span.bg-accent-400"),
    ).toBeVisible();
    await touch("touchEnd", to.x + 40, to.y + 3);

    await expect
      .poll(async () => (await toml.inputValue()).match(firstTwo)?.[1])
      .toBe(before![2]);
  });

  test("palettes can be edited, not just referenced", async ({ page }) => {
    await page.goto("./");
    await page.locator("summary").filter({ hasText: "name colours once" }).click();

    // The default preset ships a palette, so there is something to edit.
    await expect(page.getByLabel("Active palette")).toHaveValue("catppuccin_mocha");
    const terminal = page.getByLabel("Simulated terminal prompt");
    const before = await terminal.innerHTML();

    // `peach` is in the preset's prompt, so recolouring it must show.
    await page.getByLabel("Value of colour peach").fill("#ff0000");
    await expect
      .poll(async () => /rgb\(255, ?0, ?0\)/i.test(await terminal.innerHTML()))
      .toBe(true);
    expect(await terminal.innerHTML()).not.toBe(before);

    // And a palette can be made from nothing.
    await page.getByRole("button", { name: "+ Empty palette" }).click();
    await page.getByLabel("New palette name").fill("mine");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByLabel("Active palette")).toHaveValue("mine");
    await page.getByRole("button", { name: "+ Add a colour" }).click();
    await expect(page.getByLabel(/^Name of colour /)).toHaveCount(1);

    await openToml(page);
    await expect(page.getByLabel("starship.toml")).toHaveValue(/palette = "mine"/);
  });

  test("the collapse control ends a prompt-format row", async ({ page }) => {
    await page.goto("./");
    const row = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: /^Reorder \$os/ }) })
      .first();

    const labels = await row.evaluate((el) =>
      [...el.querySelectorAll(":scope > div > button")].map(
        (button) => button.getAttribute("aria-label") ?? "",
      ),
    );
    // The chevron is last, after the trash — same place the environment
    // sections put theirs.
    expect(labels.at(-1)).toMatch(/^(Expand|Collapse) \$os/);
    expect(labels.at(-2)).toMatch(/^Remove \$os/);
  });

  test("environment sections collapse the same way rows do", async ({ page }) => {
    await page.goto("./");
    const section = page
      .locator("[data-section='environment'] details")
      .filter({ hasText: "Directory" })
      .first();

    // One indicator, on the right, and not the browser's own triangle.
    await expect(section.locator("> summary svg.section-chevron")).toHaveCount(1);
    expect(
      await section.evaluate(
        (el) => getComputedStyle(el.querySelector("summary")!).listStyleType,
      ),
    ).toBe("none");

    // The whole header still toggles, and the chevron turns with it.
    await expect(section).not.toHaveAttribute("open", "");
    await section.locator("> summary").click();
    await expect(section).toHaveAttribute("open", "");
    expect(
      await section.evaluate(
        (el) =>
          getComputedStyle(el.querySelector("summary svg.section-chevron")!).transform,
      ),
    ).not.toBe("none");
  });

  test("there is no scenario picker; the environment panel covers it", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.getByLabel("Scenario")).toHaveCount(0);
    await expect(
      page.locator("summary").filter({ hasText: "Simulated environment" }),
    ).toBeVisible();
  });

  test("pasted TOML drives the preview", async ({ page }) => {
    await page.goto("./");
    await openToml(page);
    await page
      .getByLabel("starship.toml")
      .fill('format = "[hello-from-toml](bold red)"\n');
    await expect(page.getByLabel("Simulated terminal prompt")).toContainText(
      "hello-from-toml",
    );
  });

  test("the terminal colour scheme selector is labelled for terminals", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.getByLabel("Terminal color scheme")).toBeVisible();
  });

  test("the page never scrolls horizontally", async ({ page }) => {
    await page.goto("./");
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows).toBe(false);
  });

  test("bundled fonts load", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "one platform is enough");
    await page.goto("./");
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check("14px 'Hack Nerd Font Mono'");
    });
    expect(loaded).toBe(true);
  });

  test("a visit fetches the subsets, not the whole patched font", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "one platform is enough");
    const fonts: { name: string; bytes: number }[] = [];
    page.on("response", async (response) => {
      if (!response.url().endsWith(".woff2")) return;
      try {
        fonts.push({
          name: response.url().split("/").pop()!,
          bytes: (await response.body()).length,
        });
      } catch {
        // A cached response with no body is not what this is measuring.
      }
    });

    await page.goto("./", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Every face fetched is a subset. The 1.2 MB originals are for the long
    // tail, and nothing on screen at rest needs one.
    expect(fonts.length).toBeGreaterThan(0);
    const wholeFonts = fonts
      .map((font) => font.name)
      .filter((name) => !/\.(text|icons)\./.test(name));
    expect(wholeFonts).toEqual([]);
    const total = fonts.reduce((sum, font) => sum + font.bytes, 0);
    // Was ~2.4 MB before the split; leave room to breathe, catch a regression.
    expect(total).toBeLessThan(600 * 1024);
  });

  test("a glyph outside the subsets still draws", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "one platform is enough");
    await page.goto("./");
    await page.waitForTimeout(800);

    // U+F408 is in the patched font but in neither subset — exactly the case
    // the third tier exists for. It must render, not tofu.
    const ink = await page.evaluate(async () => {
      const draw = (character: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 80;
        const context = canvas.getContext("2d")!;
        context.font = '64px "Hack Nerd Font Mono"';
        context.textBaseline = "middle";
        context.fillStyle = "#fff";
        context.fillText(character, 4, 40);
        const data = context.getImageData(0, 0, 80, 80).data;
        let hash = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 16) hash = (hash * 31 + i) >>> 0;
        }
        return hash;
      };
      const rare = "\u{f408}";
      const span = document.createElement("span");
      span.className = "nerd-font";
      span.style.fontSize = "64px";
      span.textContent = rare;
      document.body.append(span);
      await document.fonts.load('64px "Hack Nerd Font Mono"', rare);
      await new Promise((resolve) => setTimeout(resolve, 900));
      return { rare: draw(rare), missing: draw("\u{10FFFD}") };
    });

    expect(ink.rare).not.toBe(ink.missing);
  });
});
