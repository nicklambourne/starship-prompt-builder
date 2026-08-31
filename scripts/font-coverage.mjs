/**
 * Which code points a bundled font can actually draw.
 *
 * The picker offers every glyph upstream's `glyphnames.json` names, and that
 * file runs ahead of the patched fonts: Nerd Fonts 3.5.0 names 105 devicons
 * (U+E8F0–U+E958) that no font in the 3.5.0 release contains. Offering them
 * puts a row of tofu in the picker, so the catalogue is filtered against the
 * fonts it will be drawn with.
 *
 * The fonts are `woff2`, which is Brotli-compressed and so unreadable without
 * decompressing: `fontverter` does that, and the `cmap` is read here rather
 * than pulling in a whole font library for two table formats.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import fontverter from "fontverter";

/** The `cmap` subtables that matter: 4 covers the BMP, 12 everything above. */
function readCmap(view, offset, into) {
  const format = view.getUint16(offset);
  if (format === 4) {
    const segCount = view.getUint16(offset + 6) / 2;
    const ends = offset + 14;
    const starts = ends + segCount * 2 + 2;
    const deltas = starts + segCount * 2;
    const rangeOffsets = deltas + segCount * 2;
    for (let i = 0; i < segCount; i += 1) {
      const end = view.getUint16(ends + i * 2);
      const start = view.getUint16(starts + i * 2);
      if (start > end || start === 0xffff) continue;
      const delta = view.getInt16(deltas + i * 2);
      const rangeOffset = view.getUint16(rangeOffsets + i * 2);
      for (let cp = start; cp <= end; cp += 1) {
        let glyph;
        if (rangeOffset === 0) glyph = (cp + delta) & 0xffff;
        else {
          const at = rangeOffsets + i * 2 + rangeOffset + (cp - start) * 2;
          if (at + 1 >= view.byteLength) continue;
          const found = view.getUint16(at);
          glyph = found === 0 ? 0 : (found + delta) & 0xffff;
        }
        // A segment can cover code points it maps to nothing: glyph 0 is
        // `.notdef`, which is the tofu box itself.
        if (glyph !== 0) into.add(cp);
      }
    }
    return;
  }
  if (format === 12) {
    const groups = view.getUint32(offset + 12);
    for (let i = 0; i < groups; i += 1) {
      const at = offset + 16 + i * 12;
      const start = view.getUint32(at);
      const end = view.getUint32(at + 4);
      const glyph = view.getUint32(at + 8);
      if (glyph === 0) continue;
      for (let cp = start; cp <= end; cp += 1) into.add(cp);
    }
  }
}

/** Every code point one font file maps to a glyph. */
async function fontCodepoints(file) {
  const sfnt = await fontverter.convert(await readFile(file), "sfnt");
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);
  const tables = view.getUint16(4);
  let cmap = null;
  for (let i = 0; i < tables; i += 1) {
    const record = 12 + i * 16;
    const tag = String.fromCharCode(
      view.getUint8(record),
      view.getUint8(record + 1),
      view.getUint8(record + 2),
      view.getUint8(record + 3),
    );
    if (tag === "cmap") cmap = view.getUint32(record + 8);
  }
  if (cmap === null) throw new Error(`${file} has no cmap table`);

  const found = new Set();
  const subtables = view.getUint16(cmap + 2);
  for (let i = 0; i < subtables; i += 1) {
    readCmap(view, cmap + view.getUint32(cmap + 4 + i * 8 + 4), found);
  }
  return found;
}

/**
 * Every code point at least one bundled face draws. A glyph missing from one
 * family but present in another is still worth offering — the reader can pick
 * the family that has it — so this is the union rather than the intersection.
 */
export async function bundledCodepoints(dir = "src/assets/fonts") {
  const faces = (await readdir(dir)).filter(
    (name) => name.endsWith(".woff2") && !name.includes(".text.") && !name.includes(".icons."),
  );
  const found = new Set();
  for (const face of faces) {
    for (const cp of await fontCodepoints(join(dir, face))) found.add(cp);
  }
  return { faces: faces.length, codepoints: found };
}
