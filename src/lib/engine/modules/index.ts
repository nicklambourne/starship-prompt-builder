/**
 * Module registry.
 *
 * The three groups are implemented independently, so this file is the single
 * point where they are combined — and where a name collision between groups
 * would otherwise silently shadow one implementation with another.
 */

import { CLOUD_MODULES } from "./cloud";
import { CORE_MODULES } from "./core";
import { createCustomModule } from "./custom";
import { createEnvVarModule } from "./env_var";
import { LANGUAGE_MODULES } from "./languages";
import { MISC_MODULES } from "./misc";
import type { ModuleDefinition } from "./types";

function mergeUnique(...groups: ModuleDefinition[][]): ModuleDefinition[] {
  const byName = new Map<string, ModuleDefinition>();
  const duplicates: string[] = [];

  for (const group of groups) {
    for (const definition of group) {
      if (byName.has(definition.name)) {
        duplicates.push(definition.name);
        continue;
      }
      byName.set(definition.name, definition);
    }
  }

  if (duplicates.length > 0 && process.env.NODE_ENV !== "production") {
    // A duplicate means two groups claim the same module; the first wins, but
    // it is always a bug worth fixing at the source.
    console.warn(
      `Duplicate module definitions ignored: ${[...new Set(duplicates)].join(", ")}`,
    );
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const ALL_MODULES: ModuleDefinition[] = mergeUnique(
  CORE_MODULES,
  LANGUAGE_MODULES,
  CLOUD_MODULES,
  MISC_MODULES,
);

export const MODULES_BY_NAME: ReadonlyMap<string, ModuleDefinition> = new Map(
  ALL_MODULES.map((m) => [m.name, m]),
);

export function getModule(name: string): ModuleDefinition | undefined {
  return MODULES_BY_NAME.get(name);
}

export const NAMED_MODULE_KINDS = ["env_var", "custom"] as const;
export type NamedModuleKind = (typeof NAMED_MODULE_KINDS)[number];

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Splits `custom.foo`, while leaving ordinary dotted-looking names alone. */
export function namedModuleIdentity(
  name: string,
): { kind: NamedModuleKind; instance: string } | null {
  for (const kind of NAMED_MODULE_KINDS) {
    const prefix = `${kind}.`;
    if (name.startsWith(prefix) && name.length > prefix.length) {
      return { kind, instance: name.slice(prefix.length) };
    }
  }
  return null;
}

/** The nested option table belonging to a static or user-named module. */
export function moduleOptionsForConfig(
  config: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const identity = namedModuleIdentity(name);
  if (!identity) return isTable(config[name]) ? config[name] : {};

  const family = config[identity.kind];
  if (!isTable(family)) return {};
  const instance = family[identity.instance];
  return isTable(instance) ? instance : {};
}

/**
 * Static modules plus one real definition for every `[env_var.NAME]` and
 * `[custom.NAME]` table in the live config. Object entry order is TOML order,
 * which is also the order starship uses for the family aggregate.
 */
export function moduleDefinitionsForConfig(
  config: Record<string, unknown>,
): ModuleDefinition[] {
  const named: ModuleDefinition[] = [];
  const factories = {
    env_var: createEnvVarModule,
    custom: createCustomModule,
  } satisfies Record<NamedModuleKind, (name: string) => ModuleDefinition>;

  for (const kind of NAMED_MODULE_KINDS) {
    const family = config[kind];
    if (!isTable(family)) continue;
    for (const [instance, options] of Object.entries(family)) {
      if (isTable(options)) named.push(factories[kind](instance));
    }
  }

  // `ALL_MODULES` is already unique and contains only the two bare templates;
  // object keys are unique by construction. Do not pass this through
  // `mergeUnique`, which sorts by name and would lose the order of the TOML
  // instance tables that starship preserves in `$env_var` / `$custom`.
  return [...ALL_MODULES, ...named];
}

export type { ModuleDefinition } from "./types";
