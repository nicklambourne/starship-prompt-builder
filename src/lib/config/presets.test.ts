import { describe, expect, it } from "vitest";
import { PRESETS, getPreset, loadPreset } from "./presets";
import { ROOT_OPTIONS, isKnownModule } from "./schema";
import { parseConfig } from "./toml";

describe("PRESETS", () => {
  it("vendors all twelve official presets, then the community themes", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "nerd-font-symbols",
      "no-nerd-font",
      "bracketed-segments",
      "plain-text-symbols",
      "no-runtime-versions",
      "no-empty-icons",
      "pure-preset",
      "pastel-powerline",
      "tokyo-night",
      "gruvbox-rainbow",
      "jetpack",
      "catppuccin-powerline",
      "catppuccin",
      "dracula",
      "rose-pine",
      "rose-pine-moon",
      "rose-pine-dawn",
    ]);
  });

  it("gives every preset a label, a description and non-empty TOML", () => {
    for (const preset of PRESETS) {
      expect(preset.label, preset.id).toBeTruthy();
      expect(preset.description, preset.id).toBeTruthy();
      expect(preset.toml.length, preset.id).toBeGreaterThan(0);
    }
  });

  it("says where every preset came from, under a licence that allows it", () => {
    for (const preset of PRESETS) {
      expect(preset.source.project, preset.id).toBeTruthy();
      expect(preset.source.url, preset.id).toMatch(/^https:\/\//);
      // Vendoring someone's theme is redistribution; these are the terms it
      // happens under, and THIRD_PARTY.md repeats them.
      expect(["ISC", "MIT"], preset.id).toContain(preset.source.licence);
    }
  });

  it("parses every preset", () => {
    for (const preset of PRESETS) {
      const result = parseConfig(preset.toml);
      expect(result.ok, `${preset.id}: ${result.ok ? "" : result.error}`).toBe(true);
    }
  });

  it("only configures modules starship knows about", () => {
    const rootKeys = new Set(["$schema", ...ROOT_OPTIONS.map((o) => o.key)]);
    for (const preset of PRESETS) {
      const result = parseConfig(preset.toml);
      if (!result.ok) continue;
      for (const key of Object.keys(result.config)) {
        if (rootKeys.has(key)) continue;
        expect(isKnownModule(key), `${preset.id}: ${key}`).toBe(true);
      }
    }
  });

  it("looks presets up by id", () => {
    expect(getPreset("tokyo-night")?.label).toBe("Tokyo Night");
    expect(getPreset("nope")).toBeUndefined();
    expect(loadPreset("nope")).toBeNull();
    expect(loadPreset("pure-preset")?.format).toContain("$character");
  });
});
