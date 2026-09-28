/** Width of a string in terminal cells, not UTF-16 units or code points. */
export function terminalWidth(value: string): number {
  const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let width = 0;
  for (const { segment } of graphemes.segment(value)) {
    if (/^[\p{Mark}\p{Control}]+$/u.test(segment)) continue;
    const first = segment.codePointAt(0) ?? 0;
    const wide = /\p{Extended_Pictographic}/u.test(segment)
      || (first >= 0x1100 && first <= 0x115f)
      || (first >= 0x2e80 && first <= 0xa4cf)
      || (first >= 0xac00 && first <= 0xd7a3)
      || (first >= 0xf900 && first <= 0xfaff)
      || (first >= 0xfe10 && first <= 0xfe6f)
      || (first >= 0xff01 && first <= 0xff60)
      || (first >= 0xffe0 && first <= 0xffe6)
      || (first >= 0x20000 && first <= 0x3fffd);
    width += wide ? 2 : 1;
  }
  return width;
}

/** A right prompt needs at least one separating cell; otherwise omit it. */
export function rightPromptGap(left: string, right: string, width: number): number | null {
  const gap = width - terminalWidth(left) - terminalWidth(right);
  return gap >= 1 ? gap : null;
}

/** Cycle complete graphemes without splitting a wide glyph or looping on marks. */
export function fillCells(unit: string, cells: number): string {
  if (!Number.isFinite(cells) || cells < 0 || cells > 10000) return "";
  const pieces = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(unit || " "), ({ segment }) => ({ text: segment, width: terminalWidth(segment) }));
  if (!pieces.some((piece) => piece.width > 0)) return "";
  const result: string[] = [];
  let used = 0;
  for (let i = 0; ; i++) {
    const piece = pieces[i % pieces.length];
    if (used + piece.width > cells) break;
    result.push(piece.text);
    used += piece.width;
  }
  return result.join("");
}
