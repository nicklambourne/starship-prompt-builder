"use client";

/**
 * Visual editor for a starship style string.
 *
 * Style strings are whitespace-separated tokens (`bold fg:#af8700 bg:blue`).
 * This edits them as structured state — modifier toggles plus two colour
 * pickers — while always round-tripping through the real parser, so what the
 * control shows is exactly what the engine will render. A raw text field stays
 * available because the token space is larger than the controls cover
 * (`prev_fg`, palette names, 256-colour indices).
 *
 * The modifiers are icon buttons: eight text labels in a row cost more width
 * than the colour pickers below them and read as a wall of words. Each keeps
 * its name as label and tooltip, so nothing hinges on recognising the mark.
 */

import { useId, useMemo, useState } from "react";

import { MODIFIER_ICONS } from "@/components/ui/modifierIcons";
import { NAMED_COLORS, type Color } from "@/lib/engine/types";
import { STYLE_MODIFIERS } from "@/lib/engine/types";
import { type Palette, parseColorString, parseStyleString } from "@/lib/engine/styleString";
import { resolveSwatchColor } from "@/components/ui/StyleSwatch";
import type { TerminalTheme } from "@/lib/terminalThemes";

interface StyleStringBuilderProps {
  /** Colours the prompt already uses, offered as a row of their own. */
  inUseColors?: string[];
  value: string;
  onChange(next: string): void;
  palette?: Palette;
  paletteNames?: string[];
  /** Needed to resolve palette entries that name an ANSI colour. */
  theme: TerminalTheme;
  /** Format items can follow the module or use an independent style. */
  inheritance?: {
    inherited: boolean;
    onChange(inherited: boolean): void;
  };
}

function colorToken(color: Color | undefined): string {
  if (!color) return "";
  switch (color.kind) {
    case "named":
      return color.name;
    case "fixed":
      return String(color.index);
    case "rgb":
      return `#${[color.r, color.g, color.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    case "prev":
      return color.source === "fg" ? "prev_fg" : "prev_bg";
  }
}

/** Splits a style string into its modifier tokens and its two colour tokens. */
function decompose(value: string) {
  const tokens = value.split(/\s+/).filter(Boolean);
  const modifiers = new Set<string>();
  let fg = "";
  let bg = "";
  const extra: string[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (STYLE_MODIFIERS.includes(lower as never)) {
      modifiers.add(lower);
    } else if (lower.startsWith("bg:")) {
      bg = lower.slice(3);
    } else if (lower.startsWith("fg:")) {
      fg = lower.slice(3);
    } else if (lower === "none") {
      extra.push(lower);
    } else {
      fg = lower;
    }
  }

  return { modifiers, fg, bg, extra };
}

function compose(parts: {
  modifiers: Set<string>;
  fg: string;
  bg: string;
  extra: string[];
}): string {
  const tokens: string[] = [];
  for (const modifier of STYLE_MODIFIERS) {
    if (parts.modifiers.has(modifier)) tokens.push(modifier);
  }
  if (parts.fg) tokens.push(parts.fg);
  if (parts.bg) tokens.push(`bg:${parts.bg}`);
  tokens.push(...parts.extra);
  return tokens.join(" ");
}

const SWATCH_BASE =
  "size-6 rounded border border-white/20 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400";

function ColorPicker({
  label,
  value,
  onChange,
  paletteNames = [],
  inUseColors = [],
  palette,
  theme,
}: {
  label: string;
  value: string;
  onChange(next: string): void;
  paletteNames?: string[];
  /** Colours the prompt is already painted with, named or not. */
  inUseColors?: string[];
  palette?: Palette;
  theme: TerminalTheme;
}) {
  const id = useId();
  const hexValue = value.startsWith("#") ? value : "#000000";

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </legend>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label={`${label}: none`}
          aria-pressed={value === ""}
          onClick={() => onChange("")}
          className={`${SWATCH_BASE} grid place-items-center bg-neutral-800 text-[10px] text-neutral-400 ${
            value === "" ? "ring-2 ring-accent-400" : ""
          }`}
        >
          ⊘
        </button>
        {NAMED_COLORS.map((name) => (
          <button
            key={name}
            type="button"
            aria-label={`${label}: ${name}`}
            aria-pressed={value === name}
            title={name}
            onClick={() => onChange(name)}
            className={`${SWATCH_BASE} ${value === name ? "ring-2 ring-accent-400" : ""}`}
            style={{ backgroundColor: `var(--ansi-${name})` }}
          />
        ))}
        {paletteNames.map((name) => {
          /*
           * A palette entry is a name pointing at a colour, so it has to be
           * resolved before it can be shown — these used to render as a grey
           * chip with the first two letters of the name, which told you what
           * the colour was called and nothing about what it looked like.
           *
           * An entry can also name an ANSI colour rather than a hex value,
           * which is why the theme is needed to resolve it.
           */
          const resolved = resolveSwatchColor(
            parseColorString(name.toLowerCase(), palette),
            theme,
          );
          return (
            <button
              key={name}
              type="button"
              aria-label={`${label}: palette colour ${name}`}
              aria-pressed={value === name}
              title={resolved ? `palette: ${name}` : `palette: ${name} — unresolved`}
              onClick={() => onChange(name)}
              className={`${SWATCH_BASE} ${
                resolved
                  ? ""
                  : "grid place-items-center bg-neutral-700 text-[9px] text-neutral-200"
              } ${value === name ? "ring-2 ring-accent-400" : ""}`}
              style={resolved ? { backgroundColor: resolved } : undefined}
            >
              {/* Only a dangling reference falls back to naming itself. */}
              {resolved ? null : name.slice(0, 2)}
            </button>
          );
        })}
      </div>
      {/*
        The colours this prompt already uses, which are the ones most likely
        to be wanted again — a second module matching the first is the whole
        reason someone opens this. Names the palette defines are above; these
        are whatever is in the prompt, including the ones written out in full.
      */}
      {inUseColors.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">In the prompt now</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {inUseColors.map((token) => (
              <button
                key={token}
                type="button"
                aria-label={`${label}: in the prompt, ${token}`}
                aria-pressed={value === token}
                title={token}
                onClick={() => onChange(token)}
                className={`${SWATCH_BASE} ${value === token ? "ring-2 ring-accent-400" : ""}`}
                style={{
                  backgroundColor:
                    resolveSwatchColor(parseColorString(token.toLowerCase(), palette), theme) ??
                    undefined,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <label htmlFor={id} className="text-xs text-neutral-500">
          Custom
        </label>
        <input
          id={id}
          type="color"
          value={hexValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
        />
      </div>
    </fieldset>
  );
}

export function StyleStringBuilder({
  value,
  onChange,
  palette,
  paletteNames,
  inUseColors,
  theme,
  inheritance,
}: StyleStringBuilderProps) {
  const [showRaw, setShowRaw] = useState(false);
  const parts = useMemo(() => decompose(value), [value]);
  const parsed = useMemo(() => parseStyleString(value, palette), [value, palette]);
  const rawId = useId();
  const inherited = inheritance?.inherited ?? false;

  const update = (next: Partial<typeof parts>) => {
    // A new colour/modifier replaces an explicit reset, otherwise `none`
    // would silently cancel the user's first edit after choosing Override.
    onChange(compose({
      ...parts,
      ...next,
      extra: parts.extra.filter((token) => token !== "none"),
    }));
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-neutral-900/60 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {STYLE_MODIFIERS.map((modifier) => {
          const active = parts.modifiers.has(modifier);
          return (
            <button
              key={modifier}
              type="button"
              aria-pressed={active}
              disabled={inherited}
              onClick={() => {
                const next = new Set(parts.modifiers);
                if (active) next.delete(modifier);
                else next.add(modifier);
                update({ modifiers: next });
              }}
              aria-label={modifier}
              title={modifier}
              className={`grid size-7 place-items-center rounded border transition disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? "border-accent-400 bg-accent-400/15 text-accent-200"
                  : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
              }`}
            >
              {MODIFIER_ICONS[modifier]}
            </button>
          );
        })}
        {inheritance ? (
          <div
            role="group"
            aria-label="Style source"
            className="ml-auto flex shrink-0 rounded border border-white/15 p-0.5"
          >
            {[true, false].map((inherit) => (
              <button
                key={String(inherit)}
                type="button"
                aria-pressed={inherited === inherit}
                title={inherit ? "Use the module's style" : "Set a style for just this item"}
                onClick={() => {
                  if (inherited !== inherit) inheritance.onChange(inherit);
                }}
                className={`rounded px-2 py-1 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400 ${
                  inherited === inherit
                    ? "bg-accent-400/15 text-accent-200"
                    : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                }`}
              >
                {inherit ? "Inherit" : "Override"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <fieldset
        disabled={inherited}
        aria-label="Style colours"
        className="grid min-w-0 gap-3 disabled:opacity-50 sm:grid-cols-2"
      >
        <ColorPicker
          label="Foreground"
          value={parts.fg}
          onChange={(fg) => update({ fg })}
          paletteNames={paletteNames}
          inUseColors={inUseColors}
          palette={palette}
          theme={theme}
        />
        <ColorPicker
          label="Background"
          value={parts.bg}
          onChange={(bg) => update({ bg })}
          paletteNames={paletteNames}
          inUseColors={inUseColors}
          palette={palette}
          theme={theme}
        />
      </fieldset>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200"
        >
          {showRaw ? "Hide" : "Edit"} raw style string
        </button>
        {parsed === undefined && value.trim().length > 0 ? (
          <span className="text-xs text-amber-400">
            Unparseable — starship will ignore this whole style
          </span>
        ) : null}
      </div>

      {showRaw ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={rawId} className="sr-only">
            Raw style string
          </label>
          <input
            id={rawId}
            value={value}
            disabled={inherited}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="w-full rounded border border-white/10 bg-neutral-950 px-2 py-1.5 font-mono text-base text-neutral-100 focus:border-accent-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="bold fg:#af8700 bg:blue"
          />
          <p className="text-xs text-neutral-500">
            Supports modifiers, named colours, 0–255 indices, #rrggbb, palette
            names, and prev_fg / prev_bg.
          </p>
        </div>
      ) : null}
    </div>
  );
}
