import { describe, expect, it } from "vitest";
import { CURATED_PALETTES } from "./curatedPalettes";

describe("curated palettes", () => {
  it("offers the ones the bundled presets ship", () => {
    expect(CURATED_PALETTES.length).toBeGreaterThan(0);
    for (const palette of CURATED_PALETTES) {
      expect(Object.keys(palette.colours).length).toBeGreaterThan(0);
      expect(palette.from).not.toBe("");
    }
  });

  it("carries the authors' own values", () => {
    const catppuccin = CURATED_PALETTES.find((p) => p.name.includes("catppuccin"));
    // Lifted from the preset, not retyped: Catppuccin Mocha's peach.
    expect(catppuccin?.colours.peach).toBe("#fab387");
  });

  it("names each one once", () => {
    const names = CURATED_PALETTES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("credits a palette to the project that publishes it", () => {
    // Starship's Catppuccin Powerline carries the four Catppuccin flavours and
    // is read first, but the colours are Catppuccin's work, not starship's.
    const mocha = CURATED_PALETTES.find((palette) => palette.name === "catppuccin_mocha");
    expect(mocha?.source.project).toBe("catppuccin/starship");
    expect(mocha?.source.licence).toBe("MIT");

    // A palette only starship publishes stays starship's.
    const gruvbox = CURATED_PALETTES.find((palette) => palette.name === "gruvbox_dark");
    expect(gruvbox?.source.project).toBe("starship");
  });

  it("gives every palette a source that can be credited", () => {
    for (const palette of CURATED_PALETTES) {
      expect(palette.source.copyright, palette.name).toBeTruthy();
      expect(palette.source.licenceUrl, palette.name).toMatch(/^https:\/\//);
    }
  });
});
