/**
 * Safe palette switching.
 *
 * Starship's root `palette` option only changes the table used to resolve
 * colour names. It does not rewrite existing style strings, so selecting a
 * palette with a different naming scheme can invalidate an otherwise-working
 * prompt. This module finds those source-palette references and can rewrite
 * the real style positions in a config before changing the active table.
 */

import { fromItems, toItems, type FormatItem } from "./formatItems";
import { MODULE_META } from "./meta";
import { NAMED_MODULE_KINDS } from "@/lib/engine/modules";
import type { StarshipConfig } from "@/lib/engine/prompt";
import { parseColorString, type Palette } from "@/lib/engine/styleString";
import { STYLE_MODIFIERS } from "@/lib/engine/types";

const ROOT_FORMAT_OPTIONS = ["format", "right_format", "continuation_prompt"] as const;
const MODIFIERS = new Set<string>(STYLE_MODIFIERS);

export interface PaletteSwitchPlan {
  /** Source-palette names used by the config but absent from the destination. */
  affected: string[];
  /** The destination name (or direct colour value) each affected name becomes. */
  replacements: Record<string, string>;
}

function tokensInStyle(style: string): string[] {
  const tokens: string[] = [];
  for (const word of style.trim().split(/\s+/)) {
    if (!word) continue;
    const token = word.startsWith("fg:") || word.startsWith("bg:")
      ? word.slice(3)
      : word;
    const lower = token.toLowerCase();
    if (
      MODIFIERS.has(lower) ||
      lower === "none" ||
      lower === "prev_fg" ||
      lower === "prev_bg" ||
      token.startsWith("$")
    ) {
      continue;
    }
    tokens.push(lower);
  }
  return tokens;
}

function mapFormatStyles(format: string, mapStyle: (style: string) => string): string {
  const items = toItems(format);
  if (!items) return format;
  let changed = false;

  const walk = (list: FormatItem[]): FormatItem[] =>
    list.map((item) => {
      if (item.kind === "raw") return item;
      let next = item;
      if (item.style !== undefined) {
        const style = mapStyle(item.style);
        if (style !== item.style) {
          changed = true;
          next = { ...next, style };
        }
      }
      if (next.kind === "group") {
        const children = walk(next.items);
        if (children !== next.items) next = { ...next, items: children };
      }
      return next;
    });

  const mapped = walk(items);
  return changed ? fromItems(mapped) : format;
}

function mapRuleStyles(
  rules: unknown,
  mapStyle: (style: string) => string,
): unknown {
  if (!Array.isArray(rules)) return rules;
  let changed = false;
  const next = rules.map((rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    const table = rule as Record<string, unknown>;
    if (typeof table.style !== "string") return rule;
    const style = mapStyle(table.style);
    if (style === table.style) return rule;
    changed = true;
    return { ...table, style };
  });
  return changed ? next : rules;
}

function mapModuleStyles(
  module: string,
  table: unknown,
  mapStyle: (style: string) => string,
): unknown {
  if (!table || typeof table !== "object" || Array.isArray(table)) return table;
  const meta = MODULE_META[module];
  if (!meta) return table;
  const values = table as Record<string, unknown>;
  let next = values;

  const set = (key: string, value: unknown) => {
    if (value === values[key]) return;
    if (next === values) next = { ...values };
    next[key] = value;
  };

  for (const key of meta.styleOptions) {
    if (typeof values[key] === "string") set(key, mapStyle(values[key]));
  }
  for (const key of meta.formatOptions) {
    if (typeof values[key] === "string") {
      set(key, mapFormatStyles(values[key], mapStyle));
    }
  }
  if (module === "battery") set("display", mapRuleStyles(values.display, mapStyle));
  if (module === "kubernetes") set("contexts", mapRuleStyles(values.contexts, mapStyle));

  return next;
}

/** Applies a style-string mapper to every position Starship parses as a style. */
function mapConfigStyles(
  config: StarshipConfig,
  mapStyle: (style: string) => string,
): StarshipConfig {
  let next = config;
  const set = (key: string, value: unknown) => {
    if (value === config[key]) return;
    if (next === config) next = { ...config };
    next[key] = value;
  };

  for (const key of ROOT_FORMAT_OPTIONS) {
    if (typeof config[key] === "string") {
      set(key, mapFormatStyles(config[key], mapStyle));
    }
  }

  for (const module of Object.keys(MODULE_META)) {
    if (NAMED_MODULE_KINDS.includes(module as (typeof NAMED_MODULE_KINDS)[number])) {
      continue;
    }
    set(module, mapModuleStyles(module, config[module], mapStyle));
  }

  for (const kind of NAMED_MODULE_KINDS) {
    const family = config[kind];
    if (!family || typeof family !== "object" || Array.isArray(family)) continue;
    const instances = family as Record<string, unknown>;
    let nextFamily = instances;
    for (const [name, table] of Object.entries(instances)) {
      const mapped = mapModuleStyles(kind, table, mapStyle);
      if (mapped === table) continue;
      if (nextFamily === instances) nextFamily = { ...instances };
      nextFamily[name] = mapped;
    }
    set(kind, nextFamily);
  }

  return next;
}

function rgb(value: string): [number, number, number] | undefined {
  const parsed = parseColorString(value.toLowerCase());
  return parsed?.kind === "rgb" ? [parsed.r, parsed.g, parsed.b] : undefined;
}

const NEUTRAL_ROLES = [
  "black", "white", "gray", "grey", "dark", "light", "base", "text",
  "crust", "mantle", "surface", "overlay", "subtext", "foreground", "background",
];

/** Common theme-specific names whose nearest RGB value is often misleading. */
const ROLE_ALIASES: Record<string, string[]> = {
  peach: ["orange", "yellow"],
  lavender: ["purple", "blue"],
  mauve: ["purple"],
  pink: ["pink", "purple", "red"],
  rosewater: ["pink", "red"],
  flamingo: ["pink", "red"],
  maroon: ["red"],
  teal: ["teal", "aqua", "cyan"],
  sky: ["cyan", "aqua", "blue"],
  sapphire: ["blue", "aqua"],
};

function colourRole(name: string): string {
  return name.toLowerCase().replace(/^(?:color|ansi)[_-]/, "");
}

function isNeutralRole(name: string): boolean {
  const role = colourRole(name);
  return (
    /^(?:fg|bg)\d*$/.test(role) ||
    NEUTRAL_ROLES.some((neutral) => role === neutral || role.startsWith(`${neutral}_`))
  );
}

function nearestTargetName(
  sourceName: string,
  sourceValue: string,
  target: Palette,
): string | undefined {
  const sourceRole = colourRole(sourceName);
  const preferredRoles = [sourceRole, ...(ROLE_ALIASES[sourceRole] ?? [])];
  const matchingRole = preferredRoles
    .map((role) => Object.keys(target).find((name) => colourRole(name) === role))
    .find((name) => name !== undefined);
  if (matchingRole) return matchingRole;

  const source = rgb(sourceValue);
  if (!source) return undefined;
  const parsedCandidates = Object.entries(target)
    .map(([name, value]) => ({ name, colour: rgb(value) }))
    .filter((entry): entry is { name: string; colour: [number, number, number] } =>
      entry.colour !== undefined,
    );
  const sameRoleKind = parsedCandidates.filter(
    ({ name }) => isNeutralRole(name) === isNeutralRole(sourceName),
  );
  const candidates = sameRoleKind.length > 0 ? sameRoleKind : parsedCandidates;
  let nearest: { name: string; distance: number } | undefined;
  for (const { name, colour } of candidates) {
    const distance = colour.reduce(
      (sum, channel, index) => sum + (channel - source[index]) ** 2,
      0,
    );
    if (!nearest || distance < nearest.distance) nearest = { name, distance };
  }
  return nearest?.name;
}

export function planPaletteSwitch(
  config: StarshipConfig,
  targetName: string | null,
): PaletteSwitchPlan {
  const sourceName = config.palette;
  if (!sourceName || sourceName === targetName) {
    return { affected: [], replacements: {} };
  }
  const source = config.palettes?.[sourceName];
  if (!source) return { affected: [], replacements: {} };
  const target = targetName ? (config.palettes?.[targetName] ?? {}) : {};

  const used = new Set<string>();
  mapConfigStyles(config, (style) => {
    for (const token of tokensInStyle(style)) used.add(token);
    return style;
  });

  const affected = Object.keys(source).filter(
    (name) => used.has(name) && !Object.hasOwn(target, name),
  );
  const replacements = Object.fromEntries(
    affected.map((name) => [
      name,
      nearestTargetName(name, source[name], target) ?? source[name],
    ]),
  );
  return { affected, replacements };
}

function replaceStyleTokens(style: string, replacements: Record<string, string>): string {
  return style
    .split(/(\s+)/)
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      const prefix = part.startsWith("fg:") || part.startsWith("bg:")
        ? part.slice(0, 3)
        : "";
      const token = prefix ? part.slice(3) : part;
      const replacement = replacements[token.toLowerCase()];
      return replacement === undefined ? part : `${prefix}${replacement}`;
    })
    .join("");
}

export function applyPaletteSwitch(
  config: StarshipConfig,
  targetName: string | null,
  options: { remap: boolean },
): StarshipConfig {
  const plan = planPaletteSwitch(config, targetName);
  const mapped = options.remap && plan.affected.length > 0
    ? mapConfigStyles(config, (style) => replaceStyleTokens(style, plan.replacements))
    : config;
  const next = { ...mapped };
  if (targetName) next.palette = targetName;
  else delete next.palette;
  return next;
}
