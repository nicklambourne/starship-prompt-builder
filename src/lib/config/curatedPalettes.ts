/**
 * Palettes worth starting from, taken from the presets that ship one.
 *
 * Nothing here is invented: each is lifted whole from a bundled preset's
 * `[palettes]` table, so the names and the hex values are the palette's
 * authors' — and each carries who they are. A preset that gains a palette upstream turns up here on the next
 * `pnpm build:presets` without anyone writing it down twice.
 *
 * Terminal themes are deliberately not a source. They would give a palette
 * per bundled scheme, but their colours are the sixteen ANSI names — and a
 * palette entry called `red` shadows ANSI red everywhere in the app, so
 * "curated" would mean handing someone that trap on a plate.
 */

import { PRESETS, type Preset } from "./presets";
import { parseConfig } from "./toml";

export interface CuratedPalette {
  /** Unique across the list; also the name it is copied in under. */
  name: string;
  /** Where it came from, for the picker. */
  from: string;
  /**
   * Whose work it is. A palette is the part of a theme its authors are known
   * for — the hex values *are* Catppuccin, or Rosé Pine — so the credit
   * travels with it rather than stopping at the preset it was lifted from.
   */
  source: Preset["source"];
  colours: Record<string, string>;
}

function collect(): CuratedPalette[] {
  const out: CuratedPalette[] = [];
  for (const preset of PRESETS) {
    const parsed = parseConfig(preset.toml);
    if (!parsed.ok) continue;
    const palettes = parsed.config.palettes as
      | Record<string, Record<string, string>>
      | undefined;
    for (const [name, colours] of Object.entries(palettes ?? {})) {
      if (Object.keys(colours).length === 0) continue;
      const existing = out.find((candidate) => candidate.name === name);
      if (existing) {
        /*
         * The same palette can be vendored twice — starship's Catppuccin
         * Powerline carries all four Catppuccin flavours, and so does
         * Catppuccin's own preset. The colours are Catppuccin's either way, so
         * the credit follows the project that publishes them rather than
         * whichever preset happened to be read first.
         */
        if (
          existing.source.project === "starship" &&
          preset.source.project !== "starship"
        ) {
          existing.from = preset.label;
          existing.source = preset.source;
        }
        continue;
      }
      out.push({ name, from: preset.label, source: preset.source, colours });
    }
  }
  return out;
}

export const CURATED_PALETTES: CuratedPalette[] = collect();
