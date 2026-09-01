"use client";

/**
 * Picks a starting configuration.
 *
 * A `<select>` can hold the labels but not what any of them does, and names
 * such as "Jetpack", "No Empty Icons" and "Powerlevel10k Lean" are only
 * meaningful to someone who has already seen them. So the list is a panel,
 * each entry carrying a description, and the ones starship does not publish
 * say whose work they come from.
 */

import { useMemo, useState } from "react";

import { Terminal } from "@/components/terminal/Terminal";
import { ChevronIcon } from "@/components/ui/icons";
import { Popover } from "@/components/ui/Popover";
import { PRESETS, type Preset } from "@/lib/config/presets";
import {
  PRESET_PREVIEW_WIDTH,
  renderPresetPreview,
} from "@/lib/config/presetPreview";
import type { TerminalTheme } from "@/lib/terminalThemes";

interface PresetPickerProps {
  onPick(id: string): void;
  theme: TerminalTheme;
  fontStack: string;
}

/** Grouped in the order the panel shows them: starship's own first. */
function group(presets: readonly Preset[]) {
  const official = presets.filter((preset) => preset.source.project === "starship");
  const inspired = presets.filter(
    (preset) => preset.source.project === "romkatv/powerlevel10k",
  );
  const community = presets.filter(
    (preset) => !["starship", "romkatv/powerlevel10k"].includes(preset.source.project),
  );
  return [
    { key: "starship", heading: "From starship", presets: official },
    { key: "community", heading: "From palette projects", presets: community },
    { key: "inspired", heading: "Inspired by Powerlevel10k", presets: inspired },
  ].filter((section) => section.presets.length > 0);
}

export function PresetPicker({ onPick, theme, fontStack }: PresetPickerProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  // Parsing every preset is unnecessary while the picker is closed. Once
  // opened, this map remains stable until it closes again.
  const previews = useMemo(
    () =>
      open
        ? new Map(PRESETS.map((preset) => [preset.id, renderPresetPreview(preset)]))
        : new Map(),
    [open],
  );

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded border border-white/10 bg-neutral-950 px-2 py-1 text-sm text-neutral-200 transition hover:border-accent-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
      >
        Start from a preset
        <ChevronIcon
          className={`text-neutral-500 transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
        />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        width={460}
        label="Presets"
      >
        <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto p-2">
          <p className="px-1 text-xs text-neutral-500">
            A preset replaces the whole configuration. Some also load a matching simulated
            environment. Undo brings back your previous configuration.
          </p>
          {group(PRESETS).map((section) => (
            <section key={section.key} className="flex flex-col gap-1">
              <h3 className="px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {section.heading}
              </h3>
              {section.presets.map((preset) => {
                const preview = previews.get(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    /*
                      Named by the preset, described by the sentence under it:
                      a row's accessible name is otherwise the whole paragraph,
                      which is a mouthful to hear and impossible to address.
                    */
                    aria-labelledby={`preset-${preset.id}-label`}
                    aria-describedby={`preset-${preset.id}-description`}
                    onClick={() => {
                      onPick(preset.id);
                      setOpen(false);
                    }}
                    className="flex flex-col gap-1 rounded border border-transparent px-2 py-1.5 text-left transition hover:border-accent-400/40 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
                  >
                    <span
                      id={`preset-${preset.id}-label`}
                      className="text-sm text-neutral-100"
                    >
                      {preset.label}
                    </span>
                    {preview ? (
                      <span className="block w-full" data-preset-preview={preset.id}>
                        <Terminal
                          compact
                          lines={preview.lines}
                          right={preview.right}
                          terminalWidth={PRESET_PREVIEW_WIDTH}
                          theme={theme}
                          fontStack={fontStack}
                          fontSize={10}
                        />
                      </span>
                    ) : null}
                    <span
                      id={`preset-${preset.id}-description`}
                      className="text-xs leading-relaxed text-neutral-400"
                    >
                      {preset.description}
                    </span>
                    {preset.source.project === "starship" ? null : (
                      /*
                        Not decoration: these are other people's work, vendored
                        here, and the panel is where someone deciding to use one
                        would want to know whose it is.
                      */
                      <span className="font-mono text-[11px] text-neutral-500">
                        {preset.source.project} · {preset.source.licence}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </Popover>
    </>
  );
}
