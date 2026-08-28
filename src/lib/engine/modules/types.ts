/**
 * Module registry contract.
 *
 * Each starship module is one file exporting a `ModuleDefinition`. The engine
 * calls `evaluate` with the module's resolved options and the active scenario;
 * the returned variables are interpolated into the module's `format` option.
 *
 * Returning `null` means "this module does not appear" — the same as starship
 * deciding a module has nothing to show (wrong directory, tool absent, etc.).
 */

import type { Scenario } from "@/lib/scenarios/types";
import type { Segment } from "../types";

/** A value a module can bind to one of its format variables. */
export type ModuleVariable = string | undefined | { segments: Segment[] };

export interface ModuleResult {
  /** Variables available to the module's `format` string, e.g. `$branch`. */
  variables: Record<string, ModuleVariable>;
  /**
   * Style-string variables, e.g. `$style`. Defaults to the module's `style`
   * option when not supplied.
   */
  styleVariables?: Record<string, string | undefined>;
}

export interface ModuleContext {
  scenario: Scenario;
  /** The whole resolved config, for modules that read root-level options. */
  rootConfig: Record<string, unknown>;
}

export type ModuleOptions = Record<string, unknown>;

export interface ModuleDefinition {
  /** Config key and `$variable` name, e.g. `git_branch`. */
  name: string;
  /**
   * Default option values, exactly as starship defines them. `vcs` is a
   * dispatcher and is the one module without its own `format` option.
   */
  defaults: ModuleOptions & { format?: string; disabled: boolean };
  /**
   * Produces the module's variables, or null when the module should not
   * render at all.
   */
  evaluate(options: ModuleOptions, ctx: ModuleContext): ModuleResult | null;
}

/** Reads a string option, falling back to the default. */
export function optString(options: ModuleOptions, key: string): string {
  const value = options[key];
  return typeof value === "string" ? value : "";
}

export function optBool(options: ModuleOptions, key: string, fallback = false): boolean {
  const value = options[key];
  return typeof value === "boolean" ? value : fallback;
}

export function optNumber(options: ModuleOptions, key: string, fallback = 0): number {
  const value = options[key];
  return typeof value === "number" ? value : fallback;
}

export function optStringArray(options: ModuleOptions, key: string): string[] {
  const value = options[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Whether the current directory matches a module's detection options — the
 * shared gate every language module uses.
 */
export function detects(options: ModuleOptions, scenario: Scenario): boolean {
  const files = optStringArray(options, "detect_files");
  const extensions = optStringArray(options, "detect_extensions");
  const folders = optStringArray(options, "detect_folders");

  const entries = scenario.files;

  if (files.some((f) => entries.includes(f))) return true;
  if (folders.some((f) => entries.includes(f) || entries.includes(`${f}/`))) return true;
  if (
    extensions.some((ext) =>
      entries.some((entry) => entry.endsWith(`.${ext}`) && !entry.endsWith("/")),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Applies starship's `version_format` to a raw version string.
 * Supports `${raw}`, `${major}`, `${minor}`, `${patch}`.
 */
export function formatVersion(raw: string, versionFormat: string): string {
  const cleaned = raw.trim().replace(/^v/, "");
  const parts = cleaned.split(/[.\-+]/);
  const [major = "", minor = "", patch = ""] = parts;
  return versionFormat
    .replace(/\$\{?raw\}?/g, raw.trim())
    .replace(/\$\{?major\}?/g, major)
    .replace(/\$\{?minor\}?/g, minor)
    .replace(/\$\{?patch\}?/g, patch);
}
