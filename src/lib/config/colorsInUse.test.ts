import { describe, expect, it } from "vitest";
import { colorsInUse } from "./colorsInUse";
import { getPreset } from "./presets";
import { parseConfig } from "./toml";

describe("colours in use", () => {
  it("reads them out of a format string's groups", () => {
    const found = colorsInUse({ format: "[$directory](bold fg:peach bg:#1e1e2e)$character" });
    expect(found.map((c) => c.token)).toEqual(["peach", "#1e1e2e"]);
  });

  it("reads a module's style options", () => {
    const found = colorsInUse({
      format: "$username",
      username: { style_user: "yellow bold", style_root: "red bold" },
    });
    // Ordered by the option list the app shows for that module, not by the
    // order the keys happen to sit in the config file.
    expect(found.map((c) => c.token)).toEqual(["red", "yellow"]);
  });

  it("reads styles from user-named module instances", () => {
    const found = colorsInUse(
      {
        custom: { project: { style: "bold cyan" } },
        env_var: { SHELL: { style: "fg:yellow" } },
      },
      { renders: (name) => name === "custom.project" || name === "env_var.SHELL" },
    );
    expect(found.map((colour) => colour.token)).toEqual(["yellow", "cyan"]);
  });

  it("includes the styles in battery and Kubernetes rules", () => {
    const config = {
      battery: { display: [{ threshold: 100, style: "bold #123456" }] },
      kubernetes: { contexts: [{ context_pattern: "prod", style: "bg:peach" }] },
    };
    expect(colorsInUse(config).map((c) => c.token)).toEqual(["#123456", "peach"]);
    expect(colorsInUse(config, { renders: () => false })).toEqual([]);
  });

  it("keeps modifiers and positions out of it", () => {
    const found = colorsInUse({ format: "[$a](bold italic none prev_fg fg:blue)" });
    expect(found.map((c) => c.token)).toEqual(["blue"]);
  });

  it("says which ones the active palette defines", () => {
    const config = {
      palette: "mine",
      palettes: { mine: { peach: "#fab387" } },
      format: "[$a](fg:peach)[$b](fg:teal)",
    };
    expect(colorsInUse(config)).toEqual([
      { token: "peach", fromPalette: true },
      { token: "teal", fromPalette: false },
    ]);
  });

  it("names each colour once, in the order the prompt meets it", () => {
    const found = colorsInUse({ format: "[$a](fg:red)[$b](fg:blue)[$c](fg:red)" });
    expect(found.map((c) => c.token)).toEqual(["red", "blue"]);
  });

  it("leaves a style variable out of it", () => {
    // `($style)` names the module's own style option, not a colour.
    expect(colorsInUse({ format: "[$symbol]($style)[$b](fg:red)" }).map((c) => c.token))
      .toEqual(["red"]);
  });

  it("covers a real preset", () => {
    const parsed = parseConfig(getPreset("catppuccin-powerline")!.toml);
    if (!parsed.ok) throw new Error("preset should parse");
    const found = colorsInUse(parsed.config);
    // Its prompt is painted from its own palette, so every colour it uses is
    // a name that palette defines.
    expect(found.length).toBeGreaterThan(5);
    expect(found.every((c) => c.fromPalette)).toBe(true);
  });
});

describe("what counts as in use", () => {
  const config = {
    format: "$directory$aws",
    directory: { style: "bold blue" },
    aws: { style: "yellow" },
    docker_context: { style: "sapphire" },
  };

  it("skips a module that is not in the prompt", () => {
    // docker_context is styled in the config and absent from the format, which
    // is exactly the default preset's situation.
    const found = colorsInUse(config, { renders: (m) => m !== "docker_context" });
    // Ordered by the module registry, not by the format.
    expect(found.map((c) => c.token)).toEqual(["yellow", "blue"]);
  });

  it("skips a module that is not rendering", () => {
    const found = colorsInUse(config, { renders: (m) => m === "directory" });
    expect(found.map((c) => c.token)).toEqual(["blue"]);
  });

  it("keeps the root format's own styles either way", () => {
    const found = colorsInUse(
      { format: "[$a](fg:peach)$directory", directory: { style: "blue" } },
      { renders: () => false },
    );
    expect(found.map((c) => c.token)).toEqual(["peach"]);
  });
});
