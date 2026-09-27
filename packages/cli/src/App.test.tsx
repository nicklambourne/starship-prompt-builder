import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BuilderApp } from "./App";
import { loadConfig } from "./configFile";
import { loadPreset } from "@/lib/config/presets";

const config = loadPreset("catppuccin-powerline");
if (!config) throw new Error("Expected bundled Catppuccin preset");

const loaded = {
  config,
  displayPath: "/tmp/starship.toml",
  writePath: "/tmp/starship.toml",
  expectedHash: null,
  source: "preset" as const,
  sourceLabel: "Catppuccin Powerline",
};

const mounted: Array<ReturnType<typeof render>> = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
  mounted.splice(0).forEach((app) => app.unmount());
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function renderInput() {
  // Flush the rendered frame without adding a human-scale key delay. The next
  // key must be handled by the view that is already visible.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("terminal builder", () => {
  it("renders the preview, format list, and inspector in a wide terminal", () => {
    const app = render(<BuilderApp loaded={loaded} columns={120} rows={36} color={false} />);
    mounted.push(app);

    expect(app.lastFrame()).toContain("Starship Prompt Builder");
    expect(app.lastFrame()).toContain("PREVIEW");
    expect(app.lastFrame()).toContain("FORMAT");
    expect(app.lastFrame()).toContain("SELECTION");
  });

  it("uses a clean single working pane in a narrow terminal", () => {
    const app = render(<BuilderApp loaded={loaded} columns={72} rows={30} color={false} />);
    mounted.push(app);

    expect(app.lastFrame()).toContain("FORMAT");
    expect(app.lastFrame()).not.toContain("SELECTION");
    expect(app.lastFrame()).toContain("● modified\n /tmp/starship.toml");
    expect(app.lastFrame()).toContain("Started from Catppuccin Powerline\n ↑↓ navigate");
  });

  it("opens save review from Ctrl+S", async () => {
    const app = render(<BuilderApp loaded={loaded} columns={100} rows={30} color={false} />);
    mounted.push(app);

    app.stdin.write("\u0013");
    await renderInput();

    expect(app.lastFrame()).toContain("REVIEW SAVE");
    expect(app.lastFrame()).toContain("Save atomically");
  });

  it("edits, reviews, and atomically saves a loaded config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "starship-builder-app-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "starship.toml");
    const original = "add_newline = false\n";
    await writeFile(path, original);

    const file = await loadConfig({ path });
    const app = render(<BuilderApp loaded={file} columns={100} rows={30} color={false} />);
    mounted.push(app);

    app.stdin.write(" ");
    await renderInput();
    expect(app.lastFrame()).toContain("● modified");

    app.stdin.write("\u0013");
    await renderInput();
    expect(app.lastFrame()).toContain("REVIEW SAVE");

    app.stdin.write("\r");
    await vi.waitFor(() => expect(app.lastFrame()).toContain("Saved "));

    expect(app.lastFrame()).toContain("Saved ");
    expect(app.lastFrame()).toContain("✓ saved");
    expect(await readFile(`${path}.bak`, "utf8")).toBe(original);
    expect(await readFile(path, "utf8")).toContain("[username]");
  });

  it("keeps an unchanged loaded document byte-for-byte", async () => {
    const directory = await mkdtemp(join(tmpdir(), "starship-builder-app-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "starship.toml");
    const original = "# keep my note\r\nadd_newline = false\r\n";
    await writeFile(path, original);

    const file = await loadConfig({ path });
    const app = render(<BuilderApp loaded={file} columns={100} rows={30} color={false} />);
    mounted.push(app);
    app.stdin.write("\u0013");
    await renderInput();
    app.stdin.write("\r");
    await vi.waitFor(() => expect(app.lastFrame()).toContain("Saved "));

    expect(await readFile(path, "utf8")).toBe(original);
    await expect(readFile(`${path}.bak`, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("navigates nested format items and edits the right prompt separately", async () => {
    const directory = await mkdtemp(join(tmpdir(), "starship-builder-app-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "starship.toml");
    await writeFile(path, 'format = "$directory[ via $git_branch](red)$character"\nright_format = "$time"\n');

    const file = await loadConfig({ path });
    const app = render(<BuilderApp loaded={file} columns={120} rows={32} color={false} />);
    mounted.push(app);
    expect(app.lastFrame()).toContain("Group of 2");
    expect(app.lastFrame()).toContain("$git_branch");

    app.stdin.write("\t");
    await renderInput();
    expect(app.lastFrame()).toContain("FORMAT · RIGHT");
    expect(app.lastFrame()).toContain("$time");
    app.stdin.write("g");
    await renderInput();
    expect(app.lastFrame()).toContain("Group of 1");

    app.stdin.write("\u0013");
    await renderInput();
    app.stdin.write("\r");
    await vi.waitFor(() => expect(app.lastFrame()).toContain("Saved "));
    const saved = await readFile(path, "utf8");
    expect(saved).toContain('right_format = "[$time]()"');
    expect(saved).toContain('$directory[ via $git_branch](red)$character');
  });

  it("switches and compares simulated scenarios without changing the configuration", async () => {
    const app = render(<BuilderApp loaded={loaded} columns={120} rows={36} color={false} />);
    mounted.push(app);
    app.stdin.write("2");
    await renderInput();
    expect(app.lastFrame()).toContain("SIMULATED ENVIRONMENT");
    app.stdin.write("p");
    await renderInput();
    expect(app.lastFrame()).toContain("BUILT-IN SCENARIOS");
    app.stdin.write("\r");
    await renderInput();
    expect(app.lastFrame()).toContain("Home directory");
    expect(app.lastFrame()).toContain("starship.toml is unchanged");
    app.stdin.write("c");
    await renderInput();
    expect(app.lastFrame()).toContain("SCENARIO COMPARISON");
    expect(app.lastFrame()).toContain("Cloud & Kubernetes");
  });

  it("shows exact regeneration and refuses an externally changed destination", async () => {
    const directory = await mkdtemp(join(tmpdir(), "starship-builder-conflict-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "starship.toml");
    await writeFile(path, "# my comment\nadd_newline = false\n");
    const file = await loadConfig({ path });
    const app = render(<BuilderApp loaded={file} columns={100} rows={30} color={false} />);
    mounted.push(app);

    app.stdin.write("n");
    await renderInput();
    await writeFile(path, "# external edit\nadd_newline = false\n");
    app.stdin.write("\u0013");
    await vi.waitFor(() => expect(app.lastFrame()).toContain("Destination changed on disk"));
    expect(app.lastFrame()).toContain("add_newline");
    expect(app.lastFrame()).toContain("# external edit");
    app.stdin.write("\r");
    await renderInput();
    expect(app.lastFrame()).toContain("FILE CHANGED ON DISK");
    expect(await readFile(path, "utf8")).toBe("# external edit\nadd_newline = false\n");
  });

  it("opens action search as an alternative to intercepted shortcuts", async () => {
    const app = render(<BuilderApp loaded={loaded} columns={100} rows={30} color={false} />);
    mounted.push(app);
    app.stdin.write(":");
    await renderInput();
    expect(app.lastFrame()).toContain("ACTIONS, MODULES & SETTINGS");
    expect(app.lastFrame()).toContain("Review and save configuration");
  });

  it("explains module visibility against the simulated environment", async () => {
    const app = render(<BuilderApp loaded={loaded} columns={120} rows={36} color={false} />);
    mounted.push(app);
    app.stdin.write("v");
    await renderInput();
    expect(app.lastFrame()).toContain("MODULE VISIBILITY");
    expect(app.lastFrame()).toMatch(/visible|hidden|disabled|unreferenced/);
  });
});
