import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";

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
  // Ink can paint a frame before its useInput subscription has committed.
  // A small event-loop gap models separate human keypresses and ensures the
  // following key is handled by the view visible in lastFrame().
  await new Promise((resolve) => setTimeout(resolve, 10));
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
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(app.lastFrame()).toContain("Saved ");
    expect(app.lastFrame()).toContain("✓ saved");
    expect(await readFile(`${path}.bak`, "utf8")).toBe(original);
    expect(await readFile(path, "utf8")).toContain("[username]");
  });
});
