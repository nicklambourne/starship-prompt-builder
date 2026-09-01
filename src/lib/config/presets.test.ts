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
      "powerlevel10k-lean-1-line",
      "powerlevel10k-lean-2-lines",
      "powerlevel10k-classic-1-line",
      "powerlevel10k-classic-2-lines",
      "powerlevel10k-rainbow-1-line",
      "powerlevel10k-rainbow-2-lines",
    ]);
  });

  it("offers one-line and two-line Starship translations of each Powerlevel10k style", () => {
    for (const style of ["lean", "classic", "rainbow"]) {
      const oneLine = getPreset(`powerlevel10k-${style}-1-line`);
      const twoLines = getPreset(`powerlevel10k-${style}-2-lines`);
      expect(oneLine?.source.project).toBe("romkatv/powerlevel10k");
      expect(twoLines?.source.project).toBe("romkatv/powerlevel10k");

      const oneLineConfig = loadPreset(`powerlevel10k-${style}-1-line`);
      const twoLineConfig = loadPreset(`powerlevel10k-${style}-2-lines`);
      expect(oneLineConfig?.format).not.toContain("$line_break");
      expect(oneLineConfig?.right_format).toContain("$cmd_duration");
      expect(twoLineConfig?.format).toContain("$fill");
      expect(twoLineConfig?.format).toContain("$line_break");
      expect(oneLineConfig?.right_format).toContain("$status");
      expect(oneLineConfig?.right_format).toContain("$jobs");
      expect(twoLineConfig?.format).toContain("$status");
      expect(twoLineConfig?.format).toContain("$jobs");
      expect(twoLineConfig?.format).toContain("$time");

      if (style === "lean") {
        expect(twoLineConfig?.right_format).toBeUndefined();
      } else {
        expect(twoLineConfig?.right_format).toBe("[─╯](fg:p10k_outline)");
      }
    }
  });

  it("keeps the Classic two-line sample's blurred heads and tails", () => {
    const config = loadPreset("powerlevel10k-classic-2-lines");

    expect(config?.format).toContain("[░▒▓](fg:p10k_surface)$os");
    expect(config?.format).toContain("$git_status[▓▒░](fg:p10k_surface)");
    expect(config?.format).toContain(
      "([░▒▓](fg:p10k_surface)$status$cmd_duration$jobs$time[▓▒░](fg:p10k_surface))",
    );
    expect(config?.format).not.toContain("[](fg:p10k_surface)");
    expect(config?.format).not.toContain("[](fg:p10k_surface)");
  });

  it("keeps the Rainbow two-line sample's slanted heads and tails", () => {
    const config = loadPreset("powerlevel10k-rainbow-2-lines");

    expect(config?.format).toContain("[](fg:white)$os");
    expect(config?.format).toContain("$git_status[](fg:green)");
    expect(config?.format).toContain(
      "([](fg:yellow)$status$cmd_duration$jobs$time[](fg:white))",
    );
    expect(config?.format).not.toContain("[](fg:green)");
    expect(config?.format).not.toContain("[](fg:yellow)");
  });

  it("pairs every Powerlevel10k translation with the wizard's demonstration environment", () => {
    for (const style of ["lean", "classic", "rainbow"]) {
      for (const lines of ["1-line", "2-lines"]) {
        const preset = getPreset(`powerlevel10k-${style}-${lines}`);
        expect(preset?.environment?.path).toBe("/Users/you/src");
        expect(preset?.environment?.home).toBe("/Users/you");
        expect(preset?.environment?.git?.branch).toBe("master");
        expect(preset?.environment?.git?.modified).toBe(0);
        expect(preset?.environment?.cmdDurationMs).toBe(5_000);
        expect(preset?.environment?.time).toBe("2026-08-18T16:23:42");
        expect(preset?.environment?.os?.type).toBe("Macos");
      }
    }
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
