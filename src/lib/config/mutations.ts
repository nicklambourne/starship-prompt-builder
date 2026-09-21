/**
 * Immutable edits over the configuration shape shared by the web and terminal
 * builders. Named modules live one table deeper than ordinary modules, so the
 * callers should not need to know which shape they are changing.
 */

import { namedModuleIdentity } from "@/lib/engine/modules";
import type { StarshipConfig } from "@/lib/engine/prompt";

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function withModuleOption(
  config: StarshipConfig,
  module: string,
  key: string,
  value: unknown,
): StarshipConfig {
  const identity = namedModuleIdentity(module);
  if (identity) {
    const familyValue = config[identity.kind];
    const family: Record<string, unknown> = isTable(familyValue) ? familyValue : {};
    const existingValue = family[identity.instance];
    const existing: Record<string, unknown> = isTable(existingValue) ? existingValue : {};
    return {
      ...config,
      [identity.kind]: {
        ...family,
        [identity.instance]: { ...existing, [key]: value },
      },
    };
  }

  const existing = isTable(config[module]) ? config[module] : {};
  return { ...config, [module]: { ...existing, [key]: value } };
}

export function withoutModuleOption(
  config: StarshipConfig,
  module: string,
  key: string,
): StarshipConfig {
  const identity = namedModuleIdentity(module);
  if (identity) {
    const familyValue = config[identity.kind];
    const family: Record<string, unknown> | undefined = isTable(familyValue)
      ? familyValue
      : undefined;
    const existingValue = family?.[identity.instance];
    const existing: Record<string, unknown> | undefined = existingValue && isTable(existingValue)
      ? existingValue
      : undefined;
    if (!family || !existing) return config;

    const next = { ...existing };
    delete next[key];
    // An empty named table still declares an instance whose defaults matter.
    return {
      ...config,
      [identity.kind]: { ...family, [identity.instance]: next },
    };
  }

  const existing = isTable(config[module]) ? config[module] : undefined;
  if (!existing) return config;

  const next = { ...existing };
  delete next[key];
  if (Object.keys(next).length === 0) {
    const copy = { ...config };
    delete copy[module];
    return copy;
  }
  return { ...config, [module]: next };
}

export function withRootOption(
  config: StarshipConfig,
  key: string,
  value: unknown,
): StarshipConfig {
  const next = { ...config };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}
