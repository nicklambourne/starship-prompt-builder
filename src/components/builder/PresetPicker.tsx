"use client";

/**
 * Picks a starting configuration.
 *
 * A `<select>` can hold seventeen labels but not what any of them does, and
 * the names do not say it: "Jetpack", "No Empty Icons" and "Rosé Pine Dawn"
 * are only meaningful to someone who has already seen them. So the list is a
 * panel, each entry carrying the sentence its own project uses to describe it,
 * and the ones starship does not publish say whose they are.
 */

import { useRef, useState } from "react";

import { ChevronIcon } from "@/components/ui/icons";
import { Popover } from "@/components/ui/Popover";
import { PRESETS, type Preset } from "@/lib/config/presets";

interface PresetPickerProps {
  onPick(id: string): void;
}

/** Grouped in the order the panel shows them: starship's own first. */
function group(presets: readonly Preset[]) {
  const official = presets.filter((preset) => preset.source.project === "starship");
  const community = presets.filter((preset) => preset.source.project !== "starship");
  return [
    { key: "starship", heading: "From starship", presets: official },
    { key: "community", heading: "From the palettes' own projects", presets: community },
  ].filter((section) => section.presets.length > 0);
}

export function PresetPicker({ onPick }: PresetPickerProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchor}
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
        anchor={anchor.current}
        width={460}
        label="Presets"
      >
        <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto p-2">
          <p className="px-1 text-xs text-neutral-500">
            A preset replaces the whole configuration. Undo brings back what you had.
          </p>
          {group(PRESETS).map((section) => (
            <section key={section.key} className="flex flex-col gap-1">
              <h3 className="px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {section.heading}
              </h3>
              {section.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  /*
                    Named by the preset, described by the sentence under it: a
                    row's accessible name is otherwise the whole paragraph,
                    which is a mouthful to hear and impossible to address.
                  */
                  aria-labelledby={`preset-${preset.id}-label`}
                  aria-describedby={`preset-${preset.id}-description`}
                  onClick={() => {
                    onPick(preset.id);
                    setOpen(false);
                  }}
                  className="flex flex-col gap-0.5 rounded border border-transparent px-2 py-1.5 text-left transition hover:border-accent-400/40 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
                >
                  <span id={`preset-${preset.id}-label`} className="text-sm text-neutral-100">
                    {preset.label}
                  </span>
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
              ))}
            </section>
          ))}
        </div>
      </Popover>
    </>
  );
}
