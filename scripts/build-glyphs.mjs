/**
 * Builds the Nerd Font symbol picker's dataset from the upstream glyph names.
 *
 * Nerd Fonts publishes ~11,000 glyphs in `glyphnames.json`, keyed by a name
 * whose prefix identifies the icon set it came from. That file is ~1.5 MB and
 * carries fields the picker does not need, so this trims it to a name, a
 * codepoint and a category, which the picker loads on demand.
 *
 * Two things keep the picker honest about what it can draw. The names are read
 * from the release the bundled fonts come from, not `master`, and whatever
 * survives that is filtered against the fonts themselves — because a release's
 * names can still run ahead of its own patched fonts. In 3.5.0 they do: it
 * names 105 devicons (U+E8F0–U+E958, `nats` through `zustand`) that no font in
 * that release contains, and offering them drew 105 tofu boxes.
 *
 *   pnpm build:glyphs
 */

import { readFileSync, writeFileSync } from "node:fs";

import { bundledCodepoints } from "./font-coverage.mjs";

/** The Nerd Fonts release `src/assets/fonts` was taken from. */
const VERSION = "v3.5.0";
const SOURCE = `https://raw.githubusercontent.com/ryanoasis/nerd-fonts/${VERSION}/glyphnames.json`;
const INPUT = process.argv[2] ?? "/tmp/glyphnames.json";
const OUTPUT = "data/glyphs.generated.json";

/**
 * Prefix to human category. Ordered so the sets people reach for while
 * building a prompt — powerline separators, language logos — come first.
 */
const CATEGORIES = [
  ["pl", "Powerline"],
  ["ple", "Powerline Extra"],
  ["dev", "Devicons"],
  ["seti", "Seti UI"],
  ["fa", "Font Awesome"],
  ["oct", "Octicons"],
  ["cod", "Codicons"],
  ["md", "Material Design"],
  ["weather", "Weather"],
  ["fae", "Font Awesome Extension"],
  ["iec", "IEC Power"],
  ["pom", "Pomicons"],
  ["linux", "Linux"],
  ["custom", "Custom"],
  ["indent", "Indentation"],
  ["indentation", "Indentation"],
];

const raw = JSON.parse(readFileSync(INPUT, "utf8"));
const metadata = raw.METADATA ?? {};

const glyphs = [];
for (const [name, entry] of Object.entries(raw)) {
  if (name === "METADATA") continue;
  if (!entry?.code || !entry?.char) continue;

  const prefix = name.includes("-") ? name.slice(0, name.indexOf("-")) : "";
  const match = CATEGORIES.find(([key]) => key === prefix);

  glyphs.push({
    // Name without its set prefix: searching for "python" should not require
    // knowing whether it lives in Devicons or Font Awesome.
    n: match ? name.slice(prefix.length + 1) : name,
    c: entry.code,
    g: match ? match[1] : "Other",
  });
}

// Nothing the fonts cannot draw: the picker's promise is a glyph, not a name.
const { faces, codepoints } = await bundledCodepoints();
const undrawable = glyphs.filter((glyph) => !codepoints.has(Number.parseInt(glyph.c, 16)));
const drawable = glyphs.filter((glyph) => codepoints.has(Number.parseInt(glyph.c, 16)));
glyphs.length = 0;
glyphs.push(...drawable);

// Sort by category order, then name, so the picker can slice contiguously.
const order = new Map(CATEGORIES.map(([, label], index) => [label, index]));
glyphs.sort((a, b) => {
  const ga = order.get(a.g) ?? CATEGORIES.length;
  const gb = order.get(b.g) ?? CATEGORIES.length;
  return ga - gb || a.n.localeCompare(b.n);
});

const categories = [...new Set(glyphs.map((glyph) => glyph.g))];

writeFileSync(
  OUTPUT,
  JSON.stringify({
    source: SOURCE,
    nerdFontsVersion: metadata.version ?? "unknown",
    // What the names offered that the fonts could not draw, so a future
    // regeneration can see whether upstream has caught up.
    omitted: undrawable.length,
    categories,
    glyphs,
  }),
);

console.log(
  `wrote ${OUTPUT}: ${glyphs.length} glyphs across ${categories.length} categories`,
);
if (undrawable.length > 0) {
  const points = undrawable.map((glyph) => Number.parseInt(glyph.c, 16)).sort((a, b) => a - b);
  console.log(
    `  omitted ${undrawable.length} named glyphs no bundled font draws ` +
      `(${points[0].toString(16)}–${points.at(-1).toString(16)}, checked against ${faces} faces)`,
  );
}
for (const category of categories) {
  console.log(`  ${category}: ${glyphs.filter((g) => g.g === category).length}`);
}
