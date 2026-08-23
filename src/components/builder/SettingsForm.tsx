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

import { useId, useState } from "react";

import { FormatBuilder } from "./FormatBuilder";
import { ChevronIcon, RestoreIcon } from "@/components/ui/icons";
import { StyleStringBuilder } from "./StyleStringBuilder";
import { MapEditor } from "@/components/ui/MapEditor";
import { SymbolInput } from "@/components/ui/SymbolInput";
import { Toggle } from "@/components/ui/Toggle";
import type { Palette } from "@/lib/engine/styleString";
import type { TerminalTheme } from "@/lib/terminalThemes";

export interface OptionDescriptor {
  key: string;
  kind: "format" | "style" | "boolean" | "number" | "string" | "enum" | "array" | "raw";
  description?: string;
  enumValues?: string[];
  defaultValue: unknown;
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

/**
 * What an option holds, short enough to sit on a collapsed row.
 *
 * Without it a closed module is a column of bare keys, which is worse than
 * the wall of controls it replaced: you would have to open each one to find
 * the one you meant.
 */
function summarise(value: unknown): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "empty";
    return trimmed.length > 44 ? `${trimmed.slice(0, 44)}…` : trimmed;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (value && typeof value === "object") {
    const size = Object.keys(value).length;
    return size === 0 ? "none" : `${size} entr${size === 1 ? "y" : "ies"}`;
  }
  // An option the schema leaves without a default, e.g. `notification_timeout`.
  return "unset";
}

function Row({
  label,
  labelFor,
  description,
  summary,
  isOverridden,
  onReset,
  open,
  onToggle,
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
  summary: string;
  isOverridden: boolean;
  onReset(): void;
  open: boolean;
  onToggle(): void;
  children: React.ReactNode;
}) {
  const regionId = useId();
  return (
    <div
      data-option={label}
      className="flex flex-col border-b border-white/5 py-2 last:border-b-0"
    >
      <div className="flex items-center gap-3">
        {/*
          A module has a dozen options and most people came for one of them, so
          each opens on demand. The row still says its name and what it holds,
          which is what makes a closed list worth reading.
        */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="shrink-0 font-mono text-sm text-neutral-200">{label}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-neutral-500">
            {summary}
          </span>
          <ChevronIcon
            className={`shrink-0 text-neutral-500 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
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
            className="grid size-7 shrink-0 place-items-center rounded border border-white/15 text-neutral-400 transition hover:border-accent-400 hover:text-accent-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
          >
            <RestoreIcon />
          </button>
        ) : null}
      </div>
      {open ? (
        <div id={regionId} className="mt-2 flex flex-col gap-1.5">
          {/*
            The name is on the header button above, but a bare input still
            needs one of its own, so it is here and hidden rather than shown
            twice.
          */}
          {labelFor ? (
            <label htmlFor={labelFor} className="sr-only">
              {label}
            </label>
          ) : null}
          {description ? (
            <p className="text-xs leading-relaxed text-neutral-500">{description}</p>
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
  theme,
  fontStack,
}: SettingsFormProps) {
  const formId = useId();
  /** Closed until asked for; the module decides which of its dozen matters. */
  const [open, setOpen] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col">
      {options.map((option) => {
        const isOverridden = Object.hasOwn(values, option.key);
        const value = isOverridden ? values[option.key] : option.defaultValue;
        const controlId = `${formId}-${option.key}`;

        return (
          <Row
            key={option.key}
            label={option.key}
            labelFor={
              option.kind === "number" || option.kind === "enum" ? controlId : undefined
            }
            description={option.description}
            summary={summarise(value)}
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
                theme={theme}
                fontStack={fontStack}
              />
            ) : option.kind === "style" ? (
              <StyleStringBuilder
                value={typeof value === "string" ? value : ""}
                onChange={(next) => onChange(option.key, next)}
                palette={palette}
                paletteNames={paletteNames}
                theme={theme}
              />
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
