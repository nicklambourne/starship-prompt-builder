/**
 * Whether the style set on a prompt-format row can affect a module at all.
 *
 * A style written in the prompt format — the `(bold red)` in
 * `[$os](bold red)` — only paints what the module emits without a style of
 * its own. A module whose whole format sits inside `[...]($style)` therefore
 * ignores it completely: `$os` is `[$symbol]($style)`, and real starship
 * emits the module's own colour with no trace of the row's.
 *
 * The empty style is not an escape hatch either. `[$path]()` still *replaces*
 * the inherited style rather than deferring to it, so a group blocks the row
 * style whatever it carries. Only content outside every group is reachable —
 * the `via ` in front of a language module, the trailing space in
 * `$directory`.
 */

import { parseFormatString } from "@/lib/engine/formatString";

/**
 * True when a row-level style could change something a module prints.
 *
 * Conservative by design: anything that cannot be parsed, or that might carry
 * unstyled content, counts as reachable. The control is only ever disabled on
 * a certainty.
 */
export function rowStyleReaches(format: string): boolean {
  let elements;
  try {
    elements = parseFormatString(format);
  } catch {
    return true;
  }
  // A format that renders nothing has nothing for the row style to paint, but
  // neither does anything else about the row — leave it alone.
  if (elements.length === 0) return true;
  return elements.some((element) => element.type !== "textGroup");
}

/**
 * A module's own `style` option is spent through `$style`, which a format
 * writes in a group's style slot — `[$symbol]($style)` — where the element
 * tree keeps it as a string rather than parsed elements. So the reference is
 * looked for in the text, having first checked the text is a format string at
 * all. `$style_root` and friends are other options and must not count.
 */
const STYLE_VARIABLE = /\$\{?style\}?(?!\w)/;

/** True when a module's `style` option could change something it prints. */
export function moduleStyleReaches(format: string): boolean {
  try {
    parseFormatString(format);
  } catch {
    return true;
  }
  return STYLE_VARIABLE.test(format);
}
