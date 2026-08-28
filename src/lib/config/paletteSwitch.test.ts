import { describe, expect, it } from "vitest";

import type { StarshipConfig } from "@/lib/engine/prompt";
import { applyPaletteSwitch, planPaletteSwitch } from "./paletteSwitch";

const config: StarshipConfig = {
  palette: "source",
  palettes: {
    source: {
      base: "#101010",
      accent: "#ff0000",
      shared: "#00ff00",
    },
    target: {
      dark: "#000000",
      orange: "#f00000",
      shared: "#0000ff",
    },
  },
  format: "[$directory](fg:base bg:accent)[$character](shared)",
  directory: {
    style: "bold base",
    format: "[$path]($style)[x](accent)",
  },
  custom: {
    project: {
      style: "bg:base fg:accent",
      command: "echo base accent",
    },
  },
  battery: {
    display: [{ threshold: 10, style: "base" }],
  },
  kubernetes: {
    contexts: [{ context_pattern: ".*", style: "accent" }],
  },
};

describe("palette switching", () => {
  it("finds used source names missing from the destination and maps them by colour", () => {
    expect(planPaletteSwitch(config, "target")).toEqual({
      affected: ["base", "accent"],
      replacements: { base: "dark", accent: "orange" },
    });
  });

  it("prefers shared colour roles and does not collapse chromatic colours into neutrals", () => {
    const themed: StarshipConfig = {
      palette: "catppuccin",
      palettes: {
        catppuccin: {
          red: "#f38ba8",
          peach: "#fab387",
          lavender: "#b4befe",
        },
        gruvbox: {
          color_red: "#fb4934",
          color_orange: "#fe8019",
          color_purple: "#d3869b",
          color_blue: "#83a598",
          color_fg0: "#fbf1c7",
        },
      },
      format: "[r](red)[p](peach)[l](lavender)",
    };

    expect(planPaletteSwitch(themed, "gruvbox").replacements).toEqual({
      red: "color_red",
      peach: "color_orange",
      lavender: "color_purple",
    });
  });

  it("remaps every real style position without touching arbitrary strings", () => {
    const switched = applyPaletteSwitch(config, "target", { remap: true });

    expect(switched.palette).toBe("target");
    expect(switched.format).toBe(
      "[$directory](fg:dark bg:orange)[$character](shared)",
    );
    expect(switched.directory).toEqual({
      style: "bold dark",
      format: "[$path]($style)[x](orange)",
    });
    expect(switched.custom).toEqual({
      project: {
        style: "bg:dark fg:orange",
        command: "echo base accent",
      },
    });
    expect(switched.battery).toEqual({
      display: [{ threshold: 10, style: "dark" }],
    });
    expect(switched.kubernetes).toEqual({
      contexts: [{ context_pattern: ".*", style: "orange" }],
    });
  });

  it("writes source values directly when disabling the palette", () => {
    const switched = applyPaletteSwitch(config, null, { remap: true });

    expect(switched.palette).toBeUndefined();
    expect(switched.format).toBe(
      "[$directory](fg:#101010 bg:#ff0000)[$character](#00ff00)",
    );
  });

  it("can deliberately switch without rewriting styles", () => {
    const switched = applyPaletteSwitch(config, "target", { remap: false });

    expect(switched.palette).toBe("target");
    expect(switched.format).toBe(config.format);
    expect(switched.directory).toBe(config.directory);
  });
});
