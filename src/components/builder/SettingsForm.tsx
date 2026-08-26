"use client";

/**
 * Schema-driven settings form for one module.
 *
 * Controls are chosen from the option's type plus the curated metadata that
 * says which strings are format strings and which are style strings — the JSON
 * schema types both as plain `string`, so the distinction cannot come from the
 * schema alone. Anything the form cannot model falls back to a raw JSON editor
 * so the whole config surface stays reachable.
 */

import { useEffect, useId, useState } from "react";
import type { VariableMap } from "@/lib/engine/render";

import { FormatBuilder } from "./FormatBuilder";
import { ChevronIcon, RestoreIcon } from "@/components/ui/icons";
import { StyleStringBuilder } from "./StyleStringBuilder";
import { MapEditor } from "@/components/ui/MapEditor";
import { SymbolInput } from "@/components/ui/SymbolInput";
import { Toggle } from "@/components/ui/Toggle";
import { StyleSwatch } from "@/components/ui/StyleSwatch";
import type { StyleFallback, StyleRules } from "@/lib/config/styleOptions";
import type { FormatStyleVariables } from "@/lib/config/formatStyles";
import type { Palette } from "@/lib/engine/styleString";
import type { TerminalTheme } from "@/lib/terminalThemes";

export interface OptionDescriptor {
  key: string;
  kind: "format" | "style" | "boolean" | "number" | "string" | "enum" | "array" | "raw";
  description?: string;
  enumValues?: string[];
  defaultValue: unknown;
  styleFallback?: StyleFallback;
  styleRules?: StyleRules;
}

interface SettingsFormProps {
  options: OptionDescriptor[];
  /** Values explicitly set by the user; missing keys fall back to defaults. */
  values: Record<string, unknown>;
  onChange(key: string, value: unknown): void;
  onReset(key: string): void;
  /** Variables valid inside this module's format strings. */
  formatVariables?: string[];
  /** One line about a variable, shown beside it in the format editor. */
  describeVariable?(name: string): string | undefined;
  palette?: Palette;
  paletteNames?: string[];
  /** Colours the prompt already uses, for the style editors' own row. */
  inUseColors?: string[];
  /** Resolved in the current scenario, just as in the terminal preview. */
  styleVariables?: FormatStyleVariables;
  variables?: VariableMap;
  /**
   * This module's `style` option, for the format editors below: a piece the
   * format paints with `$style` is painted by it, and its swatch says so.
   */
  ownStyle?: {
    value: string;
    isDefault: boolean;
    defaultValue: string;
    set(value: string | undefined): void;
  };
  /**
   * An option to open because something outside this form has just written it.
   * The nonce is what makes a second edit of the same option open it again
   * after the reader has closed it.
   */
  reveal?: { key: string; nonce: number };
  /** Nested format editors show style swatches, which are theme-coloured. */
  theme: TerminalTheme;
  /** Terminal font stack: module symbols are Nerd Font glyphs. */
  fontStack: string;
}

/**
 * Whether a value is a plain object of strings, and so editable as a map.
 * `directory.substitutions` is an array despite looking map-like, and arrays
 * of objects have no sensible row form, so both stay on the JSON fallback.
 */
function isStringMap(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

/** The row's controls, sized like every other icon button in the builder. */
const OPTION_BUTTON =
  "grid size-7 shrink-0 place-items-center rounded border border-white/15 text-neutral-400 transition hover:border-accent-400 hover:text-accent-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400";
const STYLE_BUTTON_OPEN =
  "grid size-7 shrink-0 place-items-center rounded border border-accent-400 bg-accent-400/15 text-accent-200 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400";

function Row({
  label,
  labelFor,
  description,
  isOverridden,
  onReset,
  open,
  onToggle,
  stylePreview,
  children,
}: {
  label: string;
  /**
   * The control this row names, when the control is a bare input. Toggles,
   * symbol fields and map editors carry their own accessible names, and a
   * label pointing at a wrapper rather than an input helps nobody.
   */
  labelFor?: string;
  description?: string;
  isOverridden: boolean;
  onReset(): void;
  open: boolean;
  onToggle(): void;
  stylePreview?: React.ReactNode;
  children: React.ReactNode;
}) {
  const regionId = useId();
  return (
    <div
      data-option={label}
      className="flex flex-col border-b border-white/5 py-2 last:border-b-0"
    >
      <div className="flex items-start gap-3">
        {/*
          A module has a dozen options and most people came for one of them, so
          each opens on demand and says what it is for while closed — clipped
          to a line, so a dozen of them stay scannable. The whole row opens it,
          as a module's own row does; the chevron at the end is the same
          control, kept because a row of text does not look like one.
        */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
        >
          <span className={`${stylePreview ? "min-w-0 break-all" : "shrink-0"} font-mono text-sm text-neutral-200`}>{label}</span>
          {description ? (
            <span
              className={`min-w-0 flex-1 text-xs leading-relaxed text-neutral-400 ${
                open ? "" : "truncate"
              }`}
            >
              {description}
            </span>
          ) : null}
        </button>
        {isOverridden ? (
          /*
            An icon rather than the word, now that the row is a control of its
            own: two pieces of text side by side read as two labels, and every
            other row in the app ends in icon buttons.
          */
          <button
            type="button"
            aria-label={`Reset ${label} to its default`}
            title={`Reset ${label} to its default`}
            onClick={onReset}
            className={OPTION_BUTTON}
          >
            <RestoreIcon />
          </button>
        ) : null}
        {/*
          The disclosure is its own control at the end of the row, where the
          rows above it keep theirs: an option is a row like any other, and a
          whole-row hit target would swallow clicks meant for the controls
          inside it once one is open.
        */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          aria-label={stylePreview ? `Change the style of ${label}` : `${open ? "Collapse" : "Expand"} ${label}`}
          title={stylePreview ? (open ? "Close style editor" : "Edit this style") : (open ? "Hide this option" : "Show this option")}
          data-open={stylePreview && open ? "" : undefined}
          onClick={onToggle}
          className={stylePreview && open ? STYLE_BUTTON_OPEN : OPTION_BUTTON}
        >
          {stylePreview ?? <ChevronIcon className={`transition-transform ${open ? "rotate-90" : ""}`} />}
        </button>
      </div>
      {open ? (
        <div id={regionId} className="mt-2 flex flex-col gap-1.5 pl-3">
          {/*
            The name is on the header above, but a bare input still needs one
            of its own, so it is here and hidden rather than shown twice.
          */}
          {labelFor ? (
            <label htmlFor={labelFor} className="sr-only">
              {label}
            </label>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SettingsForm({
  options,
  values,
  onChange,
  onReset,
  formatVariables,
  describeVariable,
  palette,
  paletteNames,
  inUseColors,
  styleVariables,
  variables,
  ownStyle,
  reveal,
  theme,
  fontStack,
}: SettingsFormProps) {
  const formId = useId();
  /** Closed until asked for; the module decides which of its dozen matters. */
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!reveal) return;
    // Same set back when it is already open: the prop is a fresh object every
    // render, and a fresh Set every time would be a loop.
    setOpen((current) =>
      current.has(reveal.key) ? current : new Set(current).add(reveal.key),
    );
  }, [reveal]);

  return (
    /*
      Set in from the row above and ruled off down the side: a module's options
      are a level below it, and a flat column of them read as a sibling list.
    */
    <div className="flex flex-col border-l border-white/10 pl-3">
      {options.map((option) => {
        const isOverridden = Object.hasOwn(values, option.key);
        const value = isOverridden ? values[option.key] : option.defaultValue;
        const controlId = `${formId}-${option.key}`;
        const fallback = option.styleFallback ?? {
          value: typeof option.defaultValue === "string" ? option.defaultValue : "",
          source: `Starship default for ${option.key}`,
        };
        const styleValue = isOverridden && typeof value === "string" ? value : fallback.value;

        return (
          <Row
            key={option.key}
            label={option.key}
            labelFor={
              option.kind === "number" || option.kind === "enum" ? controlId : undefined
            }
            description={option.description}
            open={open.has(option.key)}
            onToggle={() =>
              setOpen((current) => {
                const next = new Set(current);
                if (next.has(option.key)) next.delete(option.key);
                else next.add(option.key);
                return next;
              })
            }
            isOverridden={isOverridden}
            onReset={() => onReset(option.key)}
            stylePreview={option.kind === "style" ? (
              <StyleSwatch style={styleValue} palette={palette} theme={theme} />
            ) : undefined}
          >
            {option.kind === "boolean" ? (
              <Toggle
                label={option.key}
                checked={Boolean(value)}
                onChange={(next) => onChange(option.key, next)}
              />
            ) : option.kind === "format" ? (
              <FormatBuilder
                value={typeof value === "string" ? value : ""}
                onChange={(next) => onChange(option.key, next)}
                vocabulary={formatVariables ?? []}
                describe={describeVariable}
                palette={palette}
                paletteNames={paletteNames}
                inUseColors={inUseColors}
                noun="variable"
                ownerStyle={ownStyle}
                styleVariables={styleVariables}
                variables={option.key === "format" ? variables : undefined}
                theme={theme}
                fontStack={fontStack}
              />
            ) : option.kind === "style" ? (
              <StyleStringBuilder
                value={styleValue}
                onChange={(next) => onChange(option.key, next)}
                inheritance={{
                  inherited: !isOverridden,
                  source: fallback.source,
                  onChange: (inherit) => inherit
                    ? onReset(option.key)
                    : onChange(option.key, fallback.value),
                }}
                palette={palette}
                paletteNames={paletteNames}
                inUseColors={inUseColors}
                theme={theme}
              />
            ) : option.styleRules ? (
              <>
                {Array.isArray(value) ? value.map((entry, index) => {
                  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
                  const rule = entry as Record<string, unknown>;
                  const rules = option.styleRules!;
                  const label = rules.labelKey === "threshold"
                    ? `Battery at or below ${rule.threshold ?? 10}%`
                    : `Context: ${rule.context_pattern ?? "not set"}`;
                  const setStyle = (style: unknown) => {
                    const nextRule = { ...rule };
                    if (style === undefined) delete nextRule.style;
                    else nextRule.style = style;
                    onChange(option.key, value.map((current, i) => i === index ? nextRule : current));
                  };
                  return (
                    <fieldset key={index} aria-label={`Style rule ${index + 1}`} className="min-w-0 rounded border border-white/10 p-2">
                      <legend className="max-w-full break-words px-1 text-xs text-neutral-400">{label}</legend>
                      <SettingsForm
                        options={[{ key: "style", kind: "style", defaultValue: undefined, styleFallback: rules.fallback }]}
                        values={isOverridden ? rule : {}}
                        onChange={(_key, next) => setStyle(next)}
                        onReset={() => setStyle(undefined)}
                        palette={palette}
                        paletteNames={paletteNames}
                        inUseColors={inUseColors}
                        theme={theme}
                        fontStack={fontStack}
                      />
                    </fieldset>
                  );
                }) : null}
                <details className="text-xs text-neutral-400">
                  <summary className="cursor-pointer py-2">Edit {option.key} rules as JSON</summary>
                  <textarea
                    aria-label={`${option.key} rules JSON`}
                    value={JSON.stringify(value ?? [], null, 2)}
                    rows={6}
                    spellCheck={false}
                    onChange={(e) => {
                      try {
                        const next = JSON.parse(e.target.value);
                        if (Array.isArray(next)) onChange(option.key, next);
                      } catch {
                        // Commit a rule array only once the JSON parses.
                      }
                    }}
                    className="w-full rounded border border-white/10 bg-neutral-950 p-2 font-mono text-base text-neutral-100"
                  />
                </details>
              </>
            ) : option.kind === "number" ? (
              <input
                id={controlId}
                type="number"
                value={typeof value === "number" ? value : 0}
                onChange={(e) => onChange(option.key, Number(e.target.value))}
                className="w-32 rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
              />
            ) : option.kind === "enum" ? (
              <select
                id={controlId}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(option.key, e.target.value)}
                className="w-full rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
              >
                {(option.enumValues ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : option.kind === "array" ? (
              <SymbolInput
                id={controlId}
                value={Array.isArray(value) ? value.join(", ") : ""}
                onChange={(next) =>
                  onChange(
                    option.key,
                    next
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                fontStack={fontStack}
                ariaLabel={option.key}
                placeholder="comma, separated, values"
              />
            ) : option.kind === "string" ? (
              // Plain strings include every module's `symbol`, so they get the
              // terminal font and the glyph picker.
              <SymbolInput
                id={controlId}
                value={typeof value === "string" ? value : ""}
                onChange={(next) => onChange(option.key, next)}
                fontStack={fontStack}
                ariaLabel={option.key}
              />
            ) : isStringMap(value) ? (
              <MapEditor
                value={value as Record<string, string>}
                onChange={(next) => onChange(option.key, next)}
                fontStack={fontStack}
                label={option.key}
              />
            ) : (
              <textarea
                id={controlId}
                value={JSON.stringify(value ?? null, null, 2)}
                rows={4}
                spellCheck={false}
                onChange={(e) => {
                  try {
                    onChange(option.key, JSON.parse(e.target.value));
                  } catch {
                    // Keep the keystroke; invalid JSON simply is not committed.
                  }
                }}
                style={{ fontFamily: fontStack }}
                className="w-full resize-y rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
              />
            )}
          </Row>
        );
      })}
    </div>
  );
}
