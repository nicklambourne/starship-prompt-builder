/**
 * The colours the prompt on screen is painted with.
 *
 * "On screen" is the load-bearing part. A config carries styles for modules
 * that are switched off, absent from the format, or waiting on something the
 * environment does not have — the default preset paints `docker_context` a
 * colour it never shows — and listing those makes the answer to "what is this
 * prompt using" wrong in the direction that wastes the most time.
 *
 * So a module contributes only when it renders. The caller decides that,
 * because it is the one holding the engine; this stays a function of the
 * config plus that verdict.
 */

import type { StarshipConfig } from "@/lib/engine/prompt";
import { STYLE_MODIFIERS } from "@/lib/engine/types";
import { MODULE_META } from "./meta";
import { NAMED_MODULE_KINDS } from "@/lib/engine/modules";
import { toItems, type FormatItem } from "./formatItems";

const MODIFIERS = new Set<string>(STYLE_MODIFIERS);

export interface ColorInUse {
  /** As written in the config: a palette name, an ANSI name, a hex, an index. */
  token: string;
  /** True when the active palette defines it, which is what it resolves as. */
  fromPalette: boolean;
}

/** The colour tokens in one style string, ignoring modifiers and inversions. */
function tokensIn(style: string): string[] {
  const out: string[] = [];
  for (const word of style.trim().split(/\s+/)) {
    if (!word) continue;
    const value = word.startsWith("fg:") || word.startsWith("bg:") ? word.slice(3) : word;
    const lower = value.toLowerCase();
    if (MODIFIERS.has(lower)) continue;
    // `none` cancels a colour, and `prev_fg` / `prev_bg` name a position
    // rather than a colour.
    if (lower === "none" || lower === "prev_fg" || lower === "prev_bg") continue;
    // A style string may name a variable rather than a colour — `($style)` is
    // how nearly every module paints itself with its own style option.
    if (value.startsWith("$")) continue;
    out.push(value);
  }
  return out;
}

/** Styles written inside a format string, on its groups and pieces. */
function stylesInFormat(format: string): string[] {
  const items = toItems(format);
  if (!items) return [];
  const out: string[] = [];
  const walk = (list: FormatItem[]) => {
    for (const item of list) {
      if (item.kind === "raw") continue;
      if (item.style) out.push(item.style);
      if (item.kind === "group") walk(item.items);
    }
  };
  walk(items);
  return out;
}

export interface ColorsInUseOptions {
  /**
   * Whether a module puts anything in the prompt as things stand — enabled,
   * present in the format, and not held back by the environment.
   */
  renders(module: string): boolean;
}

export function colorsInUse(
  config: StarshipConfig,
  options: ColorsInUseOptions = { renders: () => true },
): ColorInUse[] {
  const palette = (config.palettes as Record<string, Record<string, string>> | undefined)?.[
    (config.palette as string | undefined) ?? ""
  ];
  const seen = new Map<string, ColorInUse>();
  const add = (style: string) => {
    for (const token of tokensIn(style)) {
      if (seen.has(token)) continue;
      seen.set(token, { token, fromPalette: Boolean(palette && token in palette) });
    }
  };

  for (const key of ["format", "right_format", "continuation_prompt"] as const) {
    const value = config[key];
    if (typeof value === "string") for (const style of stylesInFormat(value)) add(style);
  }

  const addModule = (
    module: string,
    meta: (typeof MODULE_META)[string],
    table: unknown,
  ) => {
    if (!options.renders(module)) return;
    if (typeof table !== "object" || table === null) return;
    const values = table as Record<string, unknown>;
    for (const option of meta.styleOptions) {
      const value = values[option];
      if (typeof value === "string") add(value);
    }
    const rules = module === "battery" ? values.display : module === "kubernetes" ? values.contexts : undefined;
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        if (rule && typeof rule === "object" && typeof rule.style === "string") add(rule.style);
      }
    }
    for (const option of meta.formatOptions) {
      const value = values[option];
      if (typeof value === "string") for (const style of stylesInFormat(value)) add(style);
    }
  };

  for (const [module, meta] of Object.entries(MODULE_META)) {
    addModule(module, meta, config[module]);
  }

  for (const kind of NAMED_MODULE_KINDS) {
    const family = config[kind];
    if (typeof family !== "object" || family === null || Array.isArray(family)) continue;
    for (const [instance, table] of Object.entries(family)) {
      addModule(`${kind}.${instance}`, MODULE_META[kind], table);
    }
  }

  return [...seen.values()];
}
