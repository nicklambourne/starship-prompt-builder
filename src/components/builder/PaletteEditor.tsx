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

import { Fragment, useId, useState } from "react";
import Link from "next/link";

import { ColorField } from "@/components/ui/ColorField";
import { StyleSwatch } from "@/components/ui/StyleSwatch";
import type { ColorInUse } from "@/lib/config/colorsInUse";
import { CURATED_PALETTES, type CuratedPalette } from "@/lib/config/curatedPalettes";
import { TrashIcon } from "@/components/ui/icons";
import { parseColorString, type Palette } from "@/lib/engine/styleString";
import { resolveSwatchColor } from "@/components/ui/StyleSwatch";
import type { TerminalTheme } from "@/lib/terminalThemes";

interface PaletteEditorProps {
  /** Every named palette in the config, keyed by palette name. */
  palettes: Record<string, Record<string, string>>;
  /** The one the prompt is using, if any. */
  active: string | null;
  onChange(palettes: Record<string, Record<string, string>>): void;
  onActivate(name: string | null): void;
  /** Colours the prompt asks for right now, whether named here or not. */
  inUse: ColorInUse[];
  theme: TerminalTheme;
}

/**
 * One entry per project the curated palettes come from, in the order they
 * first appear. Derived rather than listed: a preset added upstream brings its
 * palette, and its credit, without anyone remembering to write it here.
 */
const CREDITS = CURATED_PALETTES.reduce<CuratedPalette["source"][]>((found, palette) => {
  if (!found.some((credit) => credit.project === palette.source.project)) {
    found.push(palette.source);
  }
  return found;
}, []);

const INPUT =
  "w-full rounded border border-white/10 bg-neutral-950 px-2 py-1 text-base text-neutral-100 focus:border-accent-400 focus:outline-none";

const BUTTON =
  "rounded border border-white/15 px-2 py-1 text-xs text-neutral-200 transition hover:border-accent-400 hover:text-accent-200";

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
  inUse,
  theme,
}: PaletteEditorProps) {
  const selectId = useId();
  const curatedId = useId();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const names = Object.keys(palettes);
  const entries = active ? Object.entries(palettes[active] ?? {}) : [];
  const current = active ? palettes[active] : undefined;

  const unnamed = inUse.filter((colour) => !colour.fromPalette).length;

  /**
   * Names a colour the prompt already uses, in one click.
   *
   * The name is the colour itself to begin with — `#fab387` under the key
   * `#fab387` is odd but honest, and renaming it is the next thing anyone
   * does. Inventing "peach" for them would be guessing at a scheme they may
   * not be following.
   */
  const onName = (token: string) => {
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
        A palette gives colours names, so a prompt can say{" "}
        <code className="text-neutral-400">peach</code> instead of{" "}
        <code className="text-neutral-400">#fab387</code> and every module using
        it changes at once. Names defined here appear in every style picker.
      </p>

      <div className="flex flex-col gap-3 rounded border border-white/10 bg-neutral-900/40 p-2.5">
        <div className="flex flex-col gap-1">
          <label htmlFor={selectId} className="text-xs text-neutral-400">
            Active palette — the names every style picker offers
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id={selectId}
              value={active ?? ""}
              onChange={(event) => onActivate(event.target.value || null)}
              className={`${INPUT} min-w-0 flex-1`}
            >
              <option value="">None — colours are written out in full</option>
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
                  onChange({ ...palettes, [name]: palettes[name] ?? {} });
                  onActivate(name);
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

        <div className="flex flex-col gap-1">
          <label htmlFor={curatedId} className="text-xs text-neutral-400">
            Curated palettes
            <span className="ml-2 text-neutral-500">copied in, then yours to edit</span>
          </label>
          <select
            id={curatedId}
            value=""
            onChange={(event) => {
              const chosen = CURATED_PALETTES.find((p) => p.name === event.target.value);
              if (!chosen) return;
              onChange({ ...palettes, [chosen.name]: { ...chosen.colours } });
              onActivate(chosen.name);
            }}
            className={INPUT}
          >
            <option value="">Choose one…</option>
            {CURATED_PALETTES.map((palette) => (
              <option key={palette.name} value={palette.name}>
                {palette.name} — {Object.keys(palette.colours).length} colours, from{" "}
                {palette.from}
                {palette.source.project === "starship" ? "" : ` (${palette.source.project})`}
              </option>
            ))}
          </select>
          {/*
            The colours are the part of a theme its authors are known for, so
            the panel that hands them out says whose they are. The full notices
            are on the licences page; this is the line that stops the palettes
            reading as ours.
          */}
          <p className="text-xs text-neutral-500">
            Palettes belong to their projects —{" "}
            {CREDITS.map((credit, index) => (
              <Fragment key={credit.project}>
                {index > 0 ? ", " : ""}
                <a
                  href={credit.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-neutral-400 underline underline-offset-2 hover:text-accent-200"
                >
                  {credit.project}
                </a>{" "}
                ({credit.licence})
              </Fragment>
            ))}
            .{" "}
            <Link
              href="/licences"
              className="text-neutral-400 underline underline-offset-2 hover:text-accent-200"
            >
              Full notices
            </Link>
            .
          </p>
        </div>
      </div>

      {/*
        Detached from the palette above: these are the colours the prompt on
        screen is painted with, named or not. A colour written out in full is
        one that will not follow the palette when it changes — which is the
        whole argument for naming it, and the reason each one here can be
        named in a single click.
      */}
      <div className="flex flex-col gap-1.5 rounded border border-white/10 bg-neutral-900/40 p-2.5">
        <span className="text-xs text-neutral-400">
          In the prompt now
          <span className="ml-2 text-neutral-500">
            {inUse.length === 0
              ? "nothing is styled yet"
              : unnamed === 0
                ? "every colour has a name"
                : `${unnamed} not named yet${active ? " — click one to add it" : ""}`}
          </span>
        </span>
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
              // Already named, or nowhere to put it: a label, not a control.
              if (colour.fromPalette || !active) {
                return (
                  <span
                    key={colour.token}
                    title={
                      colour.fromPalette
                        ? `${colour.token} — from the active palette`
                        : `${colour.token} — written out in full`
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
                  // Named explicitly: the visible text is a hex or a bare
                  // word, which says nothing about what pressing it does.
                  aria-label={`Add ${colour.token} to ${active}`}
                  title={`Add ${colour.token} to ${active}`}
                  onClick={() => onName(colour.token)}
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
          {entries.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
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
            <div key={index} className="flex items-center gap-2">
              <StyleSwatch style={value} theme={theme} palette={current} />
              <input
                aria-label={`Name of colour ${name}`}
                value={name}
                onChange={(event) => renameEntry(name, event.target.value)}
                placeholder="name it"
                className={`${INPUT} nerd-font w-36`}
              />
              <input
                aria-label={`Value of colour ${name}`}
                value={value}
                onChange={(event) => setEntries({ ...current, [name]: event.target.value })}
                spellCheck={false}
                placeholder="#rrggbb, a colour name, or 0-255"
                className={`${INPUT} nerd-font min-w-0 flex-1`}
              />
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
