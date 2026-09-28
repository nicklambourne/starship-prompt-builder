/**
 * Share links.
 *
 * The whole builder state is the config, so a share link is the minimal TOML
 * compressed into the URL fragment. Keeping it in the fragment means the
 * config never reaches a server — this app is a static export with no backend
 * — and lz-string's URI-component alphabet survives copy-paste and browser
 * history without further escaping.
 */

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { parseConfig, serialiseConfig } from "./toml";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";

export const SHARE_LIMITS = {
  payloadCharacters: 64 * 1024,
  tomlCharacters: 512 * 1024,
  objectDepth: 32,
  collectionEntries: 20_000,
  arrayEntries: 4_096,
  tableEntries: 4_096,
} as const;

const SHARE_FRAGMENT_OVERHEAD = 64;

export function encodeShare(config: StarshipConfig): string {
  return compressToEncodedURIComponent(
    serialiseConfig(config, { header: false }),
  );
}

export interface ReviewShare {
  config: StarshipConfig;
  scenario: Scenario;
  themeId: string;
  fontId: string;
  fontSize: number;
}

function validReviewScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const scenario = value as Record<string, unknown>;
  const record = (item: unknown): item is Record<string, unknown> =>
    typeof item === "object" && item !== null && !Array.isArray(item);
  const stringMap = (item: unknown) => record(item) && Object.entries(item).every(([key, entry]) =>
    !["__proto__", "constructor", "prototype"].includes(key) && typeof entry === "string");
  const strings = ["id", "label", "description", "path", "home", "username", "hostname", "shell", "keymap", "time"];
  const booleans = ["readOnly", "ssh", "isRoot"];
  const numbers = ["status", "cmdDurationMs", "jobs"];
  const git = scenario.git;
  return strings.every((key) => typeof scenario[key] === "string") &&
    booleans.every((key) => typeof scenario[key] === "boolean") &&
    numbers.every((key) => typeof scenario[key] === "number" && Number.isFinite(scenario[key])) &&
    Number.isInteger(scenario.terminalWidth) && (scenario.terminalWidth as number) >= 20 &&
    (scenario.terminalWidth as number) <= 500 &&
    Array.isArray(scenario.files) && scenario.files.every((file) => typeof file === "string") &&
    stringMap(scenario.env) && stringMap(scenario.toolVersions) &&
    record(scenario.os) && typeof scenario.os.name === "string" && typeof scenario.os.type === "string" &&
    (git === undefined || record(git) &&
      typeof git.commit === "string" && typeof git.root === "string" &&
      typeof git.detached === "boolean" && typeof git.hasRemote === "boolean" &&
      ["ahead", "behind", "staged", "modified", "deleted", "renamed", "untracked", "conflicted", "stashed"]
        .every((key) => typeof git[key] === "number" && Number.isFinite(git[key]))) &&
    (scenario.custom === undefined || record(scenario.custom) &&
      Object.values(scenario.custom).every((entry) => record(entry) &&
        typeof entry.output === "string" && typeof entry.when === "boolean"));
}

/** A separate, versioned link for reviewing the same visual context together. */
export function encodeReviewShare(value: ReviewShare): string {
  const document = {
    version: 1,
    configToml: serialiseConfig(value.config, { header: false }),
    scenario: value.scenario,
    themeId: value.themeId,
    fontId: value.fontId,
    fontSize: value.fontSize,
  };
  return `review=${compressToEncodedURIComponent(JSON.stringify(document))}`;
}

export function decodeReviewShare(fragment: string): ReviewShare | null {
  const text = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!text.startsWith("review=") || text.length > SHARE_LIMITS.payloadCharacters + SHARE_FRAGMENT_OVERHEAD) return null;
  try {
    const expanded = decompressFromEncodedURIComponent(text.slice("review=".length));
    if (!expanded || expanded.length > SHARE_LIMITS.tomlCharacters) return null;
    const data: unknown = JSON.parse(expanded);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    const scenario = record.scenario;
    if (record.version !== 1 || typeof record.configToml !== "string" ||
      typeof record.themeId !== "string" || typeof record.fontId !== "string" ||
      typeof record.fontSize !== "number" || !Number.isFinite(record.fontSize) ||
      !validReviewScenario(scenario)) return null;
    const parsed = parseConfig(record.configToml);
    if (!parsed.ok || !withinShareLimits(parsed.config)) return null;
    return { config: parsed.config, scenario, themeId: record.themeId, fontId: record.fontId, fontSize: record.fontSize };
  } catch {
    return null;
  }
}

/**
 * Decodes a fragment produced by `encodeShare`. Accepts a bare payload, a
 * leading `#`, or a `#key=payload` pair, and returns null for anything that
 * does not decompress to a valid config.
 */
export function decodeShare(fragment: string): StarshipConfig | null {
  if (
    fragment.length >
    SHARE_LIMITS.payloadCharacters + SHARE_FRAGMENT_OVERHEAD
  ) {
    return null;
  }

  const payload = extractPayload(fragment);
  if (
    payload.length === 0 ||
    payload.length > SHARE_LIMITS.payloadCharacters
  ) {
    return null;
  }

  let toml: string | null;
  try {
    toml = decompressFromEncodedURIComponent(payload);
  } catch {
    return null;
  }
  // lz-string signals failure by returning null or an empty string rather than
  // throwing, and happily produces mojibake for arbitrary input — so the TOML
  // parse below is the real validation step.
  if (!toml || toml.length > SHARE_LIMITS.tomlCharacters) return null;

  const result = parseConfig(toml);
  if (!result.ok || !withinShareLimits(result.config)) return null;
  return result.config;
}

function extractPayload(fragment: string): string {
  const withoutHash = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  const separator = withoutHash.indexOf("=");
  return separator === -1 ? withoutHash : withoutHash.slice(separator + 1);
}

function withinShareLimits(config: StarshipConfig): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [
    { value: config, depth: 0 },
  ];
  let entries = 0;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    if (current.depth > SHARE_LIMITS.objectDepth) return false;

    if (Array.isArray(current.value)) {
      if (current.value.length > SHARE_LIMITS.arrayEntries) return false;
      entries += current.value.length;
      if (entries > SHARE_LIMITS.collectionEntries) return false;
      for (const value of current.value) {
        pending.push({ value, depth: current.depth + 1 });
      }
      continue;
    }

    if (current.value && typeof current.value === "object") {
      const values = Object.values(current.value);
      if (values.length > SHARE_LIMITS.tableEntries) return false;
      entries += values.length;
      if (entries > SHARE_LIMITS.collectionEntries) return false;
      for (const value of values) {
        pending.push({ value, depth: current.depth + 1 });
      }
    }
  }

  return true;
}
