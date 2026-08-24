/**
 * The picker may only offer glyphs the bundled fonts can draw.
 *
 * Upstream's `glyphnames.json` runs ahead of its own patched fonts: the 3.5.0
 * release names 105 devicons (U+E8F0–U+E958) that no font in that release
 * contains, and the picker drew a screen of tofu boxes for them. The build
 * filters the catalogue against the fonts; this is what says so out loud when
 * a regenerated catalogue, or a swapped font, breaks the promise again.
 */

import { describe, expect, it } from "vitest";

import catalogue from "../../data/glyphs.generated.json";
import { bundledCodepoints } from "../../scripts/font-coverage.mjs";

describe("the symbol picker's catalogue", () => {
  it("offers nothing the bundled fonts cannot draw", async () => {
    const { faces, codepoints } = await bundledCodepoints();
    expect(faces).toBeGreaterThan(0);

    const undrawable = catalogue.glyphs
      .filter((glyph) => !codepoints.has(Number.parseInt(glyph.c, 16)))
      .map((glyph) => `${glyph.c} ${glyph.g} ${glyph.n}`);
    expect(undrawable).toEqual([]);
  }, 120_000);
});
