import type { StarshipConfig } from "@/lib/engine/prompt";
import {
  namedModuleIdentity,
  type NamedModuleKind,
} from "@/lib/engine/modules";
import { fromItems, itemToSource, toItems, type FormatItem } from "./formatItems";

const VCS_FORMAT_OPTIONS = [
  "fossil_modules",
  "git_modules",
  "hg_modules",
  "pijul_modules",
] as const;

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidNamedModuleInstance(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value);
}

export function namedModuleName(kind: NamedModuleKind, instance: string): string {
  return `${kind}.${instance}`;
}

function rewriteItems(
  items: FormatItem[],
  from: string,
  to: string | null,
): FormatItem[] {
  return items.flatMap((item): FormatItem[] => {
    if (item.kind === "module" && item.name === from) {
      return to === null ? [] : [{ ...item, name: to }];
    }
    if (item.kind !== "group") return [item];
    const children = rewriteItems(item.items, from, to);
    return children.length === 0 ? [] : [{ ...item, items: children }];
  });
}

function rewriteFormat(source: unknown, from: string, to: string | null): unknown {
  if (typeof source !== "string") return source;
  const items = toItems(source);
  return items ? fromItems(rewriteItems(items, from, to)) : source;
}

function rewritePromptReferences(
  config: StarshipConfig,
  from: string,
  to: string | null,
): StarshipConfig {
  const next = { ...config };
  for (const key of ["format", "right_format"] as const) {
    if (key in next) next[key] = rewriteFormat(next[key], from, to) as string;
  }

  if (isTable(next.vcs)) {
    const vcs = { ...next.vcs };
    for (const key of VCS_FORMAT_OPTIONS) {
      if (key in vcs) vcs[key] = rewriteFormat(vcs[key], from, to);
    }
    next.vcs = vcs;
  }
  return next;
}

function countReferences(items: FormatItem[], names: Set<string>): number {
  let count = 0;
  for (const item of items) {
    if (item.kind === "module" && names.has(item.name)) count += 1;
    if (item.kind === "group") count += countReferences(item.items, names);
  }
  return count;
}

function countFormatReferences(source: unknown, names: Set<string>): number {
  if (typeof source !== "string") return 0;
  const items = toItems(source);
  return items ? countReferences(items, names) : 0;
}

/** Counts explicit uses of an instance, including its family aggregate. */
export function namedModuleReferenceCount(
  config: StarshipConfig,
  name: string,
): number {
  const identity = namedModuleIdentity(name);
  if (!identity) return 0;
  const names = new Set([name, identity.kind]);
  let count = countFormatReferences(config.format, names);
  count += countFormatReferences(config.right_format, names);

  if (isTable(config.vcs)) {
    for (const key of VCS_FORMAT_OPTIONS) {
      count += countFormatReferences(config.vcs[key], names);
    }
  }
  return count;
}

/** Adds the table and its explicit prompt row as one undoable config edit. */
export function addNamedModule(
  config: StarshipConfig,
  kind: NamedModuleKind,
  instance: string,
  effectiveFormat: string,
): StarshipConfig {
  if (!isValidNamedModuleInstance(instance)) return config;
  const family = isTable(config[kind]) ? config[kind] : {};
  if (isTable(family[instance])) return config;
  const name = namedModuleName(kind, instance);
  return {
    ...config,
    [kind]: { ...family, [instance]: {} },
    format: `${effectiveFormat}${itemToSource({ kind: "module", name })}`,
  };
}

/** Renames a nested table without moving it, then updates module references. */
export function renameNamedModule(
  config: StarshipConfig,
  name: string,
  nextInstance: string,
): StarshipConfig {
  const identity = namedModuleIdentity(name);
  if (!identity) return config;
  if (!isValidNamedModuleInstance(nextInstance)) return config;
  const family = config[identity.kind];
  if (!isTable(family) || !isTable(family[identity.instance])) return config;
  if (identity.instance !== nextInstance && isTable(family[nextInstance])) return config;

  const renamed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(family)) {
    renamed[key === identity.instance ? nextInstance : key] = value;
  }
  const nextName = namedModuleName(identity.kind, nextInstance);
  return rewritePromptReferences(
    { ...config, [identity.kind]: renamed },
    name,
    nextName,
  );
}

/** Removes the nested table and any explicit prompt-level references to it. */
export function removeNamedModule(
  config: StarshipConfig,
  name: string,
): StarshipConfig {
  const identity = namedModuleIdentity(name);
  if (!identity) return config;
  const family = config[identity.kind];
  if (!isTable(family) || !isTable(family[identity.instance])) return config;

  const remaining = { ...family };
  delete remaining[identity.instance];
  const without = { ...config };
  if (Object.keys(remaining).length === 0) delete without[identity.kind];
  else without[identity.kind] = remaining;
  return rewritePromptReferences(without, name, null);
}
