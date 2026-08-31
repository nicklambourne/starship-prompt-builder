/**
 * ANSI serialisation.
 *
 * This exists for the parity harness: the same segments the UI renders as
 * spans are serialised here to raw escape sequences and compared byte-for-byte
 * against real `starship prompt` output.
 *
 * It mirrors nu_ansi_term's behaviour, including the optimisation starship
 * relies on (`AnsiStrings` collapses redundant sequences): a segment that
 * shares the previous segment's style emits no new escape sequence, and the
 * reset is only written when leaving a styled run.
 */

import { type Color, type Segment, type Style, colorsEqual, stylesEqual } from "./types";

const NAMED_FG: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  purple: 35,
  cyan: 36,
  white: 37,
  // nu_ansi_term maps the bright variants to the 90-97 range, except
  // bright-white which it treats as "light gray" (37 is white, 97 bright).
  "bright-black": 90,
  "bright-red": 91,
  "bright-green": 92,
  "bright-yellow": 93,
  "bright-blue": 94,
  "bright-purple": 95,
  "bright-cyan": 96,
  "bright-white": 97,
};

const MODIFIER_CODES: Record<string, number> = {
  bold: 1,
  dimmed: 2,
  italic: 3,
  underline: 4,
  blink: 5,
  inverted: 7,
  hidden: 8,
  strikethrough: 9,
};

function colorCodes(color: Color, ground: "fg" | "bg"): number[] {
  const base = ground === "fg" ? 0 : 10;
  switch (color.kind) {
    case "named": {
      const code = NAMED_FG[color.name];
      return [code + base];
    }
    case "fixed":
      return [(ground === "fg" ? 38 : 48), 5, color.index];
    case "rgb":
      return [(ground === "fg" ? 38 : 48), 2, color.r, color.g, color.b];
    case "prev":
      // Resolved before serialisation; nothing to emit if it survives.
      return [];
  }
}

function styleCodes(style: Style): number[] {
  const codes: number[] = [];
  for (const [name, code] of Object.entries(MODIFIER_CODES)) {
    if (style.modifiers.has(name as never)) codes.push(code);
  }
  // Background precedes foreground: nu_ansi_term writes them in that order,
  // and the parity harness compares the byte sequence, not the resulting colour.
  if (style.bg) codes.push(...colorCodes(style.bg, "bg"));
  if (style.fg) codes.push(...colorCodes(style.fg, "fg"));
  return codes;
}

function isEmptyStyle(style: Style | undefined): boolean {
  return !style || (!style.fg && !style.bg && style.modifiers.size === 0);
}

/**
 * Resolves `prev_fg`/`prev_bg` references against the preceding segment's
 * resolved style, in place order.
 */
function resolvePrevColors(segments: Segment[]): Segment[] {
  let prev: Style | undefined;
  return segments.map((segment) => {
    if (segment.kind === "lineTerm") return segment;
    if (!segment.style) {
      prev = undefined;
      return segment;
    }
    const resolved: Style = {
      fg: segment.style.fg,
      bg: segment.style.bg,
      modifiers: new Set(segment.style.modifiers),
    };
    if (resolved.fg?.kind === "prev") {
      const source = resolved.fg.source;
      resolved.fg = source === "fg" ? prev?.fg : prev?.bg;
    }
    if (resolved.bg?.kind === "prev") {
      const source = resolved.bg.source;
      resolved.bg = source === "fg" ? prev?.fg : prev?.bg;
    }
    prev = resolved;
    return { ...segment, style: resolved };
  });
}

/**
 * The transition between two consecutive styles.
 *
 * Port of nu_ansi_term's `Difference::between`, which starship relies on via
 * `AnsiStrings`. The rule is asymmetric and easy to get wrong: turning an
 * attribute OFF (or clearing a colour) is impossible without a full reset,
 * whereas turning attributes on or changing a colour only needs the delta. So
 * `red` → `bold blue` emits just `[1;34m`, while `bold blue` → `red` must
 * emit `[0m` first.
 */
type Difference =
  | { kind: "none" }
  | { kind: "reset" }
  | { kind: "extra"; style: Style };

function difference(first: Style, next: Style): Difference {
  if (stylesEqual(first, next)) return { kind: "none" };

  for (const modifier of first.modifiers) {
    if (!next.modifiers.has(modifier)) return { kind: "reset" };
  }
  if (first.fg && !next.fg) return { kind: "reset" };
  if (first.bg && !next.bg) return { kind: "reset" };

  const extra: Style = { modifiers: new Set() };
  for (const modifier of next.modifiers) {
    if (!first.modifiers.has(modifier)) extra.modifiers.add(modifier);
  }
  if (!colorsEqual(first.fg, next.fg)) extra.fg = next.fg;
  if (!colorsEqual(first.bg, next.bg)) extra.bg = next.bg;
  return { kind: "extra", style: extra };
}

/**
 * Serialises segments to an ANSI-escaped string, matching what starship writes
 * to a terminal that needs no shell-specific escaping.
 */
export function segmentsToAnsi(segments: Segment[]): string {
  const resolved = resolvePrevColors(segments);
  let out = "";
  /** The style currently in effect on the terminal, or undefined for none. */
  let current: Style | undefined;

  const emit = (style: Style) => {
    const codes = styleCodes(style);
    if (codes.length > 0) out += `\x1b[${codes.join(";")}m`;
  };

  const reset = () => {
    if (!isEmptyStyle(current)) out += "\x1b[0m";
    current = undefined;
  };

  for (const segment of resolved) {
    if (segment.kind === "lineTerm") {
      reset();
      out += "\n";
      continue;
    }
    if (segment.value.length === 0) continue;

    const style = segment.style;

    if (isEmptyStyle(style)) {
      reset();
      out += segment.value;
      continue;
    }

    const next = style as Style;
    if (isEmptyStyle(current)) {
      emit(next);
    } else {
      const diff = difference(current as Style, next);
      if (diff.kind === "reset") {
        out += "\x1b[0m";
        emit(next);
      } else if (diff.kind === "extra") {
        emit(diff.style);
      }
    }
    current = next;
    out += segment.value;
  }

  reset();
  return out;
}
