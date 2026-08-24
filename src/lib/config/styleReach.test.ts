import { describe, expect, it } from "vitest";

import { isStyleVariable, moduleStyleReaches, rowStyleReaches } from "@/lib/config/styleReach";
import { ALL_MODULES } from "@/lib/engine/modules";

describe("rowStyleReaches", () => {
  it("is false when the whole format sits inside a style group", () => {
    expect(rowStyleReaches("[$symbol]($style)")).toBe(false);
  });

  it("is true for the literal a language module puts in front", () => {
    expect(rowStyleReaches("via [$symbol($version )]($style)")).toBe(true);
  });

  it("is true for a trailing space, which is what $directory leaves", () => {
    expect(rowStyleReaches("[$path]($style)[$read_only]($read_only_style) ")).toBe(true);
  });

  it("is true for a bare variable, which carries no style of its own", () => {
    expect(rowStyleReaches("$symbol")).toBe(true);
  });

  it("counts an empty style as blocking, because starship replaces rather than inherits", () => {
    expect(rowStyleReaches("[$symbol]()")).toBe(false);
  });

  it("assumes reachable when the format cannot be parsed", () => {
    expect(rowStyleReaches("[$symbol](")).toBe(true);
  });

  it("names exactly the modules whose default format blocks it", () => {
    const blocked = ALL_MODULES.filter((definition) => {
      const format = definition.defaults.format;
      return typeof format === "string" && !rowStyleReaches(format);
    }).map((definition) => definition.name);

    // Checked against real starship 1.25.1: with `format = "[$os](bold red)"`
    // and `[os] style = "bold blue"`, the glyph comes out bold blue and the
    // red never appears — not even as a background.
    expect(blocked.sort()).toEqual(["custom", "fill", "nats", "os", "sudo"]);
  });
});

describe("moduleStyleReaches", () => {
  it("is true where the format spends $style", () => {
    expect(moduleStyleReaches("[$symbol]($style)")).toBe(true);
    expect(moduleStyleReaches("[$path]($style)[$read_only]($read_only_style) ")).toBe(true);
    expect(moduleStyleReaches("${style}$symbol")).toBe(true);
  });

  it("is false where nothing uses it", () => {
    expect(moduleStyleReaches("$symbol$name ")).toBe(false);
    expect(moduleStyleReaches("[$symbol](bold red)")).toBe(false);
  });

  it("does not count the options that merely start with the same word", () => {
    expect(moduleStyleReaches("[$user]($style_user)")).toBe(false);
    expect(moduleStyleReaches("[$user]($style_root)")).toBe(false);
  });

  it("leaves the control alone when the format cannot be read", () => {
    expect(moduleStyleReaches("[$symbol")).toBe(true);
  });
});

describe("isStyleVariable", () => {
  it("recognises the reference on its own", () => {
    expect(isStyleVariable("$style")).toBe(true);
    expect(isStyleVariable(" ${style} ")).toBe(true);
  });

  it("does not claim a literal, or a style that merely mentions it", () => {
    expect(isStyleVariable("bold red")).toBe(false);
    expect(isStyleVariable("bold $style")).toBe(false);
    expect(isStyleVariable("$style_root")).toBe(false);
    expect(isStyleVariable("")).toBe(false);
  });
});
