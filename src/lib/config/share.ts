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
