/**
 * VCS dispatcher introduced in Starship 1.26.
 *
 * Unlike an ordinary module it has no format of its own: it detects the first
 * repository kind in `order`, then renders that kind's configured list of
 * ordinary top-level modules. Prompt assembly performs that second render.
 */

import type { Scenario } from "@/lib/scenarios/types";
import type { ModuleDefinition, ModuleOptions } from "./types";

export type VcsKind = "git" | "hg" | "pijul" | "fossil";

function hasEntry(scenario: Scenario, name: string): boolean {
  return scenario.files.includes(name) || scenario.files.includes(`${name}/`);
}

function normaliseKind(value: unknown): VcsKind | undefined {
  if (value === "mercurial") return "hg";
  return value === "git" || value === "hg" || value === "pijul" || value === "fossil"
    ? value
    : undefined;
}

export function detectedVcs(options: ModuleOptions, scenario: Scenario): VcsKind | undefined {
  const order = Array.isArray(options.order) ? options.order : [];
  for (const entry of order) {
    const kind = normaliseKind(entry);
    if (!kind) continue;
    if (kind === "git" && scenario.git) return kind;
    if (kind === "hg" && hasEntry(scenario, ".hg")) return kind;
    if (kind === "pijul" && hasEntry(scenario, ".pijul")) return kind;
    if (kind === "fossil" && (hasEntry(scenario, ".fslckout") || hasEntry(scenario, "_FOSSIL_"))) return kind;
  }
  return undefined;
}

export function selectedVcsFormat(options: ModuleOptions, scenario: Scenario): string | undefined {
  const kind = detectedVcs(options, scenario);
  if (!kind) return undefined;
  const value = options[`${kind}_modules`];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const vcs: ModuleDefinition = {
  name: "vcs",
  defaults: {
    order: ["git", "hg", "pijul", "fossil"],
    disabled: false,
    fossil_modules: "$fossil_branch$fossil_metrics",
    git_modules: "$git_branch$git_commit$git_state$git_metrics$git_status",
    hg_modules: "$hg_branch$hg_state",
    pijul_modules: "$pijul_channel",
  },
  evaluate(options, { scenario }) {
    return selectedVcsFormat(options, scenario) ? { variables: {} } : null;
  },
};
