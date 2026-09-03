"use client";

/**
 * Naming colours, and choosing which set of names is live.
 *
 * A palette is a `[palettes.<name>]` table of colour names, activated by the
 * root `palette` option. Four of the bundled presets ship one, and the style
 * pickers have always offered their entries as swatches — but there was no way
 * to add, rename or recolour anything without hand-writing TOML, which is the
 * one thing this app exists to avoid.
 */

import { useId, useState } from "react";

import { ColorField } from "@/components/ui/ColorField";
import { Popover } from "@/components/ui/Popover";
import { StyleSwatch } from "@/components/ui/StyleSwatch";
import type { ColorInUse } from "@/lib/config/colorsInUse";
import { CURATED_PALETTES, type CuratedPalette } from "@/lib/config/curatedPalettes";
import { ChevronIcon, TrashIcon } from "@/components/ui/icons";
import { parseColorString, type Palette } from "@/lib/engine/styleString";
import { resolveSwatchColor } from "@/components/ui/StyleSwatch";
import type { TerminalTheme } from "@/lib/terminalThemes";
import type { StarshipConfig } from "@/lib/engine/prompt";
import {
  applyPaletteSwitch,
  planPaletteSwitch,
  type PaletteSwitchPlan,
} from "@/lib/config/paletteSwitch";

interface PaletteEditorProps {
  /** Every named palette in the config, keyed by palette name. */
  palettes: Record<string, Record<string, string>>;
  /** The one the prompt is using, if any. */
  active: string | null;
  onChange(palettes: Record<string, Record<string, string>>): void;
  onActivate(name: string | null): void;
  /** Commits an atomic palette switch plus any requested style rewrites. */
  config: StarshipConfig;
  onConfigChange(config: StarshipConfig): void;
  /** Colours the prompt asks for right now, whether named here or not. */
  inUse: ColorInUse[];
  theme: TerminalTheme;
}

const INPUT =
  "w-full rounded border border-white/10 bg-neutral-950 px-2 py-1 text-base text-neutral-100 focus:border-accent-400 focus:outline-none";

const BUTTON =
  "rounded border border-white/15 px-2 py-1 text-xs text-neutral-200 transition hover:border-accent-400 hover:text-accent-200";

/** Grouped like the prompt preset picker: starship's own first. */
function groupCuratedPalettes(palettes: readonly CuratedPalette[]) {
  const official = palettes.filter((palette) => palette.source.project === "starship");
  const community = palettes.filter((palette) => palette.source.project !== "starship");
  return [
    { key: "starship", heading: "From starship", palettes: official },
    { key: "community", heading: "From the palettes' own projects", palettes: community },
  ].filter((section) => section.palettes.length > 0);
}

/** A colour value the browser's own picker can show, or black if it cannot. */
function asHex(value: string, palette: Palette | undefined, theme: TerminalTheme): string {
  const parsed = parseColorString(value.toLowerCase(), palette);
  if (parsed?.kind === "rgb") {
    return `#${[parsed.r, parsed.g, parsed.b]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  }
  if (parsed?.kind === "named") {
    const index = [
      "black", "red", "green", "yellow", "blue", "purple", "cyan", "white",
      "bright-black", "bright-red", "bright-green", "bright-yellow",
      "bright-blue", "bright-purple", "bright-cyan", "bright-white",
    ].indexOf(parsed.name);
    if (index >= 0) return theme.ansi[index];
  }
  return "#000000";
}

export function PaletteEditor({
  palettes,
  active,
  onChange,
  onActivate,
  config,
  onConfigChange,
  inUse,
  theme,
}: PaletteEditorProps) {
  const selectId = useId();
  const curatedId = useId();
  const [curatedAnchor, setCuratedAnchor] = useState<HTMLButtonElement | null>(null);
  const [adding, setAdding] = useState(false);
  const [curatedOpen, setCuratedOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, setPending] = useState<{
    target: string | null;
    palette?: Palette;
    plan: PaletteSwitchPlan;
  } | null>(null);

  const names = Object.keys(palettes);
  const entries = active ? Object.entries(palettes[active] ?? {}) : [];
  const current = active ? palettes[active] : undefined;

  const notInPalette = inUse.filter((colour) => !colour.fromPalette).length;

  const configWithPalette = (name: string, colours: Palette): StarshipConfig => ({
    ...config,
    palettes: { ...(config.palettes ?? {}), [name]: { ...colours } },
  });

  const requestSwitch = (target: string | null, palette?: Palette) => {
    const candidate = target && palette ? configWithPalette(target, palette) : config;
    const plan = planPaletteSwitch(candidate, target);
    if (plan.affected.length === 0) {
      onConfigChange(applyPaletteSwitch(candidate, target, { remap: false }));
      setPending(null);
      return;
    }
    setPending({ target, palette, plan });
  };

  const finishSwitch = (remap: boolean) => {
    if (!pending) return;
    const candidate = pending.target && pending.palette
      ? configWithPalette(pending.target, pending.palette)
      : config;
    onConfigChange(applyPaletteSwitch(candidate, pending.target, { remap }));
    setPending(null);
  };

  /**
   * Copies a colour token into the active palette under the same temporary name.
   *
   * Existing styles are deliberately left alone: inventing a reusable name or
   * silently rewriting every matching style would guess at how the user wants
   * to organise their scheme.
   */
  const copyIntoPalette = (token: string) => {
    if (!active) return;
    setEntries({ ...(current ?? {}), [token]: token });
  };

  const setEntries = (next: Record<string, string>) => {
    if (!active) return;
    onChange({ ...palettes, [active]: next });
  };

  /*
   * Renaming a key rebuilds the table rather than editing it in place, so the
   * row keeps its position while it is being typed. Dropping and re-adding
   * would send a half-typed name to the bottom on every keystroke.
   */
  const renameEntry = (from: string, to: string) => {
    if (!current) return;
    setEntries(
      Object.fromEntries(
        Object.entries(current).map(([key, value]) => (key === from ? [to, value] : [key, value])),
      ),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-neutral-500">
        A palette pairs a reusable name with a colour. To make a style follow
        it, choose the name — for example <code className="text-neutral-400">peach</code>{" "}
        instead of <code className="text-neutral-400">#fab387</code>. Changing the
        entry then updates every style that uses <code className="text-neutral-400">peach</code>.
      </p>

      <div className="flex flex-col gap-3 rounded border border-white/10 bg-neutral-900/40 p-2.5">
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-xs text-neutral-400">
            Active palette — its names appear in every style picker
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id={selectId}
              value={active ?? ""}
              onChange={(event) => requestSwitch(event.target.value || null)}
              className={`${INPUT} min-w-0 flex-1`}
            >
              <option value="">None — styles use colours directly</option>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {adding ? (
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newName.trim();
                  if (!name) return;
                  requestSwitch(name, palettes[name] ?? {});
                  setNewName("");
                  setAdding(false);
                }}
              >
                <input
                  autoFocus
                  aria-label="New palette name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="name"
                  className={`${INPUT} nerd-font w-36`}
                />
                <button type="submit" className={BUTTON}>
                  Create
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className={BUTTON}>
                + Empty palette
              </button>
            )}
          </div>
        </div>

        {pending ? (
          <div
            aria-live="polite"
            className="flex flex-col gap-2 rounded border border-yellow-400/30 bg-yellow-400/5 p-2.5"
          >
            <p className="text-xs leading-relaxed text-neutral-300">
              <span className="font-semibold text-neutral-100">
                {pending.plan.affected.length} palette name
                {pending.plan.affected.length === 1 ? "" : "s"} used by this config{" "}
                {pending.plan.affected.length === 1 ? "is" : "are"} not defined by{" "}
                <code>{pending.target ?? "no palette"}</code>.
              </span>{" "}
              Switching only can drop those styles or make ANSI colours take over.
            </p>
            <div className="flex flex-wrap gap-1.5" aria-label="Proposed colour remapping">
              {pending.plan.affected.map((name) => (
                <code
                  key={name}
                  className="rounded border border-white/10 bg-neutral-950 px-1.5 py-0.5 text-xs text-neutral-300"
                >
                  {name} → {pending.plan.replacements[name]}
                </code>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-neutral-500">
              Remap uses the nearest colour in the destination palette. If there is no
              comparable entry, it writes the current colour value directly.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPending(null)} className={BUTTON}>
                Keep current
              </button>
              <button type="button" onClick={() => finishSwitch(false)} className={BUTTON}>
                Switch only
              </button>
              <button
                type="button"
                onClick={() => finishSwitch(true)}
                className={`${BUTTON} border-accent-400 bg-accent-400/15 text-accent-200`}
              >
                Switch &amp; remap {pending.plan.affected.length} name
                {pending.plan.affected.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">
            Curated palettes
            <span className="ml-2 text-neutral-500">copied in, then yours to edit</span>
          </span>
          <button
            ref={setCuratedAnchor}
            type="button"
            aria-expanded={curatedOpen}
            aria-haspopup="dialog"
            onClick={() => setCuratedOpen((currentOpen) => !currentOpen)}
            className="flex w-fit items-center gap-1.5 rounded border border-white/10 bg-neutral-950 px-2 py-1 text-sm text-neutral-200 transition hover:border-accent-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
          >
            Choose a curated palette
            <ChevronIcon
              className={`text-neutral-500 transition-transform ${curatedOpen ? "-rotate-90" : "rotate-90"}`}
            />
          </button>

          <Popover
            open={curatedOpen}
            onClose={() => setCuratedOpen(false)}
            anchor={curatedAnchor}
            width={460}
            label="Curated palettes"
          >
            <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto p-2">
              <p className="px-1 text-xs text-neutral-500">
                Choosing one copies its colours into your config and makes it active.
              </p>
              {groupCuratedPalettes(CURATED_PALETTES).map((section) => (
                <section key={section.key} className="flex flex-col gap-1">
                  <h3 className="px-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                    {section.heading}
                  </h3>
                  {section.palettes.map((palette) => {
                    const labelId = `${curatedId}-${palette.name}-label`;
                    const descriptionId = `${curatedId}-${palette.name}-description`;
                    const creditId = `${curatedId}-${palette.name}-credit`;
                    return (
                      <button
                        key={palette.name}
                        type="button"
                        aria-labelledby={labelId}
                        aria-describedby={`${descriptionId} ${creditId}`}
                        onClick={() => {
                          requestSwitch(palette.name, palette.colours);
                          setCuratedOpen(false);
                        }}
                        className="flex flex-col gap-1 rounded border border-transparent px-2 py-1.5 text-left transition hover:border-accent-400/40 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
                      >
                        <span id={labelId} className="font-mono text-sm text-neutral-100">
                          {palette.name}
                        </span>
                        {/*
                          The colours are what is being copied, so the row
                          shows them: a name and a count describe a palette
                          about as well as a filename describes a photograph.
                          Hidden from assistive tech — the count beneath says
                          the same thing in words, and 26 unnameable squares
                          read out one by one say nothing.
                        */}
                        <span
                          aria-hidden="true"
                          data-palette-preview={palette.name}
                          className="flex w-full flex-wrap gap-0.5"
                        >
                          {Object.entries(palette.colours).map(([colour, value]) => (
                            <span
                              key={colour}
                              title={`${colour} · ${value}`}
                              className="size-3.5 rounded-[2px] border border-black/25"
                              style={{
                                // Resolved against the palette itself: an entry
                                // can name another entry rather than a colour.
                                backgroundColor: asHex(value, palette.colours, theme),
                              }}
                            />
                          ))}
                        </span>
                        <span
                          id={descriptionId}
                          className="text-xs leading-relaxed text-neutral-400"
                        >
                          {Object.keys(palette.colours).length} colours · from {palette.from}
                        </span>
                        <span id={creditId} className="font-mono text-[11px] text-neutral-500">
                          {palette.source.project} · {palette.source.licence}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          </Popover>
        </div>
      </div>

      {/*
        Detached from the palette above: these are the colours the prompt on
        screen is painted with. Matching an active-palette key and being
        written directly are separate states, and copying a direct token into
        the palette does not silently rewrite the styles that use it.
      */}
      <div className="flex flex-col gap-1.5 rounded border border-white/10 bg-neutral-900/40 p-2.5">
        <span className="text-xs text-neutral-400">
          Colours used by this prompt
          <span className="ml-2 text-neutral-500">
            {inUse.length === 0
              ? "nothing is styled yet"
              : notInPalette === 0
                ? `every colour has a matching entry in ${active}`
                : active
                  ? `${notInPalette} ${notInPalette === 1 ? "colour is" : "colours are"} not in ${active}`
                  : `${notInPalette} ${notInPalette === 1 ? "colour is" : "colours are"} written directly`}
          </span>
        </span>
        {inUse.length > 0 ? (
          <p className="text-xs leading-relaxed text-neutral-500">
            {active ? (
              <>
                Solid chips have matching entries in{" "}
                <code className="text-neutral-400">{active}</code>; dashed chips do not.
                Copying a dashed chip creates an entry with the same text as a temporary
                name, without changing the style.
              </>
            ) : (
              <>Choose or create a palette to turn direct colours into reusable entries.</>
            )}
          </p>
        ) : null}
        {inUse.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {inUse.map((colour) => {
              /*
                A filled square, not the two-tone style chip used on the rows
                below: a token here is one colour, and showing it as a
                foreground over an empty background made every chip look
                blank.
              */
              const fill = resolveSwatchColor(
                parseColorString(colour.token.toLowerCase(), current),
                theme,
              );
              const chip = (
                <>
                  <span
                    aria-hidden="true"
                    className="size-3.5 shrink-0 rounded-sm border border-white/20"
                    style={fill ? { backgroundColor: fill } : undefined}
                  />
                  <span className="nerd-font">{colour.token}</span>
                </>
              );
              const shape =
                "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-xs";
              // Already matched, or nowhere to copy it: a label, not a control.
              if (colour.fromPalette || !active) {
                return (
                  <span
                    key={colour.token}
                    title={
                      colour.fromPalette
                        ? `${colour.token} — matches the active palette`
                        : `${colour.token} — written directly in a style`
                    }
                    className={`${shape} ${
                      colour.fromPalette
                        ? "border-white/10 text-neutral-300"
                        : "border-dashed border-white/20 text-neutral-400"
                    }`}
                  >
                    {chip}
                  </span>
                );
              }
              return (
                <button
                  key={colour.token}
                  type="button"
                  aria-label={`Copy ${colour.token} into ${active} as a palette entry`}
                  title={`Copy ${colour.token} into ${active} as a palette entry`}
                  onClick={() => copyIntoPalette(colour.token)}
                  className={`${shape} cursor-pointer border-dashed border-white/20 text-neutral-400 transition hover:border-accent-400 hover:text-accent-200`}
                >
                  {chip}
                  <span aria-hidden="true" className="text-neutral-500">
                    +
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {active ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs leading-relaxed text-neutral-500">
            A palette name changes only styles that use it. Copying or renaming a
            palette entry does not update existing styles; choose that name in their
            style pickers.
          </p>
          {entries.length > 0 ? (
            <div className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
              <span className="w-6" />
              <span className="w-36">Name — what a style says</span>
              <span className="min-w-0 flex-1">Colour — hex, an ANSI name, or 0-255</span>
              <span className="w-9" />
              <span className="w-7" />
            </div>
          ) : null}

          {entries.length === 0 ? (
            <p className="text-xs text-neutral-500">
              Nothing in <code className="text-neutral-400">{active}</code> yet.
            </p>
          ) : null}

          {entries.map(([name, value], index) => (
            /*
              Keyed by position. Keyed by name, every keystroke in the name
              field made React throw the row away and build a new one, which
              took the focus with it — so the field accepted exactly one
              character at a time.
            */
            <div key={index} className="flex items-start gap-2 sm:items-center">
              <StyleSwatch style={value} theme={theme} palette={current} />
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                <input
                  aria-label={`Name of colour ${name}`}
                  value={name}
                  onChange={(event) => renameEntry(name, event.target.value)}
                  placeholder="name it"
                  className={`${INPUT} nerd-font sm:max-w-36 sm:shrink-0`}
                />
                <input
                  aria-label={`Value of colour ${name}`}
                  value={value}
                  onChange={(event) => setEntries({ ...current, [name]: event.target.value })}
                  spellCheck={false}
                  placeholder="#rrggbb, a colour name, or 0-255"
                  className={`${INPUT} nerd-font min-w-0 flex-1`}
                />
              </div>
              <ColorField
                label={`Pick a colour for ${name}`}
                value={asHex(value, current, theme)}
                onChange={(next) => setEntries({ ...current, [name]: next })}
              />
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => {
                  const next = { ...current };
                  delete next[name];
                  setEntries(next);
                }}
                className="shrink-0 rounded px-1.5 py-1 text-neutral-500 transition hover:bg-white/10 hover:text-red-300"
              >
                <TrashIcon />
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEntries({ ...current, "": "#ffffff" })}
              className={`${BUTTON} self-start`}
            >
              + Add a colour
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...palettes };
                delete next[active];
                onChange(next);
                onActivate(null);
              }}
              className={`${BUTTON} self-start hover:border-red-400 hover:text-red-300`}
            >
              Delete this palette
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
