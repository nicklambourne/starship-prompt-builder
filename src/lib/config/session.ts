/**
 * Keeping a session across a refresh.
 *
 * The config travels in the URL fragment, but the rest of what someone sets up
 * — the simulated environment they built, the terminal font and colour scheme
 * they picked — lived only in memory, so a reload threw it away. This puts all
 * of it in local storage.
 *
 * Storage is treated as untrusted: it can be absent, full, disabled, or hold
 * something written by an older version of this app. Nothing here throws, and
 * anything that does not look right is ignored in favour of the defaults.
 */

import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";
import { isScenario } from "@/lib/scenarios/validation";
import validateSchema from "./validation.generated.mjs";

const KEY = "starship-prompt-builder.session";

/**
 * Bumped whenever the shape below changes incompatibly. An older payload is
 * dropped rather than migrated: it is a convenience, not a document.
 */
const VERSION = 1;
const MAX_CHARS = 2 * 1024 * 1024;
let resetting = false;

export interface PersistedSession {
  version: number;
  config: StarshipConfig;
  scenario: Scenario;
  themeId: string;
  fontId: string;
  /** Absent in sessions stored before the size was settable. */
  fontSize?: number;
  /** Only present once the toggle has been used; otherwise the OS decides. */
  appTheme?: "dark" | "light";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether a parsed payload is this version's shape. */
function isSession(value: unknown): value is PersistedSession {
  if (!isRecord(value)) return false;
  if (value.version !== VERSION) return false;
  if (!isRecord(value.config) || !isScenario(value.scenario)) return false;
  if (!validateSchema(value.config) && validateSchema.errors?.some((error) => error.keyword !== "additionalProperties")) return false;
  if (typeof value.themeId !== "string" || typeof value.fontId !== "string") return false;
  if (value.fontSize !== undefined && (typeof value.fontSize !== "number" || !Number.isFinite(value.fontSize))) return false;
  return value.appTheme === undefined || value.appTheme === "dark" || value.appTheme === "light";
}

export function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw || raw.length > MAX_CHARS) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : null;
  } catch {
    // Disabled storage, or something that is not JSON. Neither is worth
    // interrupting someone over.
    return null;
  }
}

export function saveSession(session: Omit<PersistedSession, "version">): void {
  if (typeof window === "undefined" || resetting) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...session, version: VERSION }));
  } catch {
    // Private browsing, or a full quota. The app works fine without it.
  }
}

export function clearSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/** Suppress pending lifecycle flushes until the reset navigation finishes. */
export function resetSessionForReload(): boolean {
  if (!clearSession()) return false;
  resetting = true;
  return true;
}
