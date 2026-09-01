/**
 * The presets the builder can start from, vendored from upstream.
 *
 * Starship's twelve official presets live in `data/presets/` exactly as it
 * publishes them, and the themes their own projects publish — Catppuccin,
 * Dracula, Rosé Pine — in `data/presets-community/`, equally verbatim and
 * equally MIT. `scripts/build-presets.mjs` folds both into
 * `data/presets.generated.json` with their labels, descriptions and where they
 * came from, because neither Next.js nor vitest can import a `.toml` as text
 * without extra loader configuration in both.
 */

import generated from "../../../data/presets.generated.json";
import { parseConfig } from "./toml";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";

export interface Preset {
  /** Upstream filename stem, e.g. `tokyo-night`. */
  id: string;
  label: string;
  description: string;
  /** Who publishes it, credited in the picker and on the licences page. */
  source: {
    project: string;
    url: string;
    licence: string;
    copyright: string;
    licenceUrl: string;
  };
  /** The preset's TOML, verbatim. */
  toml: string;
  /** Optional shell state chosen to demonstrate the preset's conditional content. */
  environment?: Scenario;
}

export const PRESETS: readonly Preset[] = Object.freeze(
  generated.presets as Preset[],
);

/**
 * The preset the builder opens on. Chosen because it exercises palettes,
 * groups and Nerd Font glyphs, so the first thing a visitor sees demonstrates
 * what the editor is for.
 */
export const DEFAULT_PRESET_ID = "catppuccin-powerline";

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** Parses a preset's TOML. Returns null if the vendored file is malformed. */
export function loadPreset(id: string): StarshipConfig | null {
  const preset = getPreset(id);
  if (!preset) return null;
  const result = parseConfig(preset.toml);
  return result.ok ? result.config : null;
}
