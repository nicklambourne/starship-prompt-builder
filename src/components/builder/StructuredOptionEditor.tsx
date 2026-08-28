"use client";

import { TrashIcon } from "@/components/ui/icons";
import { StyleStringBuilder } from "./StyleStringBuilder";
import { StyleSwatch } from "@/components/ui/StyleSwatch";
import { SymbolInput } from "@/components/ui/SymbolInput";
import { Toggle } from "@/components/ui/Toggle";
import type { Palette } from "@/lib/engine/styleString";
import type { TerminalTheme } from "@/lib/terminalThemes";
import type { StyleRules } from "@/lib/config/styleOptions";
import { useState } from "react";
import {
  commandRows,
  substitutionRows,
  type StructuredEditor,
  type SubstitutionRow,
} from "./structuredOptions";

interface Props {
  editor: StructuredEditor;
  value: unknown;
  onChange(value: unknown): void;
  palette?: Palette;
  paletteNames?: string[];
  inUseColors?: string[];
  theme: TerminalTheme;
  fontStack: string;
  label: string;
  isOverridden: boolean;
  styleRules?: StyleRules;
}

const INPUT = "w-full min-w-0 rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none";
const SMALL_BUTTON = "rounded border border-white/15 px-2 py-1 text-xs text-neutral-200 transition hover:border-accent-400 hover:text-accent-200";
const TRASH_BUTTON = "shrink-0 rounded px-1.5 py-1 text-neutral-500 transition hover:bg-white/10 hover:text-red-300";

function updatedRecord(record: Record<string, unknown>, patch: Record<string, unknown>) {
  const next = { ...record, ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) delete next[key];
  }
  return next;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-neutral-400">
      {label}
      {children}
    </label>
  );
}

function RuleStyleEditor({
  row,
  overridden,
  fallback,
  setStyle,
  ...props
}: Props & {
  row: Record<string, unknown>;
  overridden: boolean;
  fallback: { value: string; source: string };
  setStyle(style: string | undefined): void;
}) {
  const [open, setOpen] = useState(false);
  const value = overridden && typeof row.style === "string" ? row.style : fallback.value;
  return (
    <div className="rounded border border-white/10 p-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-sm text-neutral-200">style</span>
        <button
          type="button"
          aria-expanded={open}
          aria-label="Change the style of style"
          title={open ? "Close style editor" : "Edit this style"}
          onClick={() => setOpen((current) => !current)}
          className="grid size-7 place-items-center rounded border border-white/15 text-neutral-400 transition hover:border-accent-400 hover:text-accent-200"
        >
          <StyleSwatch style={value} palette={props.palette} theme={props.theme} />
        </button>
      </div>
      {open ? (
        <div className="mt-2">
          <StyleStringBuilder
            value={value}
            onChange={(style) => setStyle(style)}
            inheritance={{
              inherited: !overridden,
              source: fallback.source,
              onChange: (inherit) => setStyle(inherit ? undefined : fallback.value),
            }}
            palette={props.palette}
            paletteNames={props.paletteNames}
            inUseColors={props.inUseColors}
            theme={props.theme}
          />
        </div>
      ) : null}
    </div>
  );
}

function BatteryDisplayEditor(props: Props) {
  const rows = Array.isArray(props.value) ? props.value : [];
  const update = (index: number, patch: Record<string, unknown>) => {
    props.onChange(rows.map((entry, i) => i === index ? updatedRecord(entry as Record<string, unknown>, patch) : entry));
  };
  return (
    <div className="flex flex-col gap-2">
      {rows.map((entry, index) => {
        const row = entry && typeof entry === "object" && !Array.isArray(entry)
          ? entry as Record<string, unknown>
          : {};
        return (
          <fieldset key={index} aria-label={`Style rule ${index + 1}`} className="rounded border border-white/10 p-2">
            <legend className="px-1 text-xs text-neutral-400">Battery rule {index + 1}</legend>
            <div className="flex flex-col gap-2">
              <Field label="At or below (%)">
                <input className={INPUT} type="number" min={0} max={100} value={typeof row.threshold === "number" ? row.threshold : 10} onChange={(event) => update(index, { threshold: Number(event.target.value) })} />
              </Field>
              <RuleStyleEditor
                {...props}
                row={row}
                overridden={props.isOverridden && typeof row.style === "string"}
                fallback={props.styleRules?.fallback ?? { value: "red bold", source: "Starship default for battery display" }}
                setStyle={(style) => update(index, { style })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Charging symbol (optional)">
                  <SymbolInput value={typeof row.charging_symbol === "string" ? row.charging_symbol : ""} onChange={(charging_symbol) => update(index, { charging_symbol: charging_symbol || undefined })} fontStack={props.fontStack} ariaLabel={`Charging symbol for battery rule ${index + 1}`} />
                </Field>
                <Field label="Discharging symbol (optional)">
                  <SymbolInput value={typeof row.discharging_symbol === "string" ? row.discharging_symbol : ""} onChange={(discharging_symbol) => update(index, { discharging_symbol: discharging_symbol || undefined })} fontStack={props.fontStack} ariaLabel={`Discharging symbol for battery rule ${index + 1}`} />
                </Field>
              </div>
              <button type="button" className={`${TRASH_BUTTON} self-end`} aria-label={`Remove battery rule ${index + 1}`} onClick={() => props.onChange(rows.filter((_, i) => i !== index))}><TrashIcon /></button>
            </div>
          </fieldset>
        );
      })}
      <button type="button" className={`${SMALL_BUTTON} self-start`} onClick={() => props.onChange([...rows, { threshold: 10, style: "red bold" }])}>+ Add battery rule</button>
    </div>
  );
}

const KUBERNETES_FIELDS = [
  ["context_pattern", "Context pattern"],
  ["user_pattern", "User pattern (optional)"],
  ["context_alias", "Context alias (optional)"],
  ["user_alias", "User alias (optional)"],
] as const;

function KubernetesContextsEditor(props: Props) {
  const rows = Array.isArray(props.value) ? props.value : [];
  const update = (index: number, patch: Record<string, unknown>) => props.onChange(
    rows.map((entry, i) => i === index ? updatedRecord(entry as Record<string, unknown>, patch) : entry),
  );
  return (
    <div className="flex flex-col gap-2">
      {rows.map((entry, index) => {
        const row = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
        return (
          <fieldset key={index} aria-label={`Style rule ${index + 1}`} className="rounded border border-white/10 p-2">
            <legend className="px-1 text-xs text-neutral-400">Context rule {index + 1}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {KUBERNETES_FIELDS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <input className={INPUT} value={typeof row[key] === "string" ? row[key] : ""} onChange={(event) => update(index, { [key]: event.target.value || undefined })} />
                </Field>
              ))}
              <Field label="Symbol (optional)">
                <SymbolInput value={typeof row.symbol === "string" ? row.symbol : ""} onChange={(symbol) => update(index, { symbol: symbol || undefined })} fontStack={props.fontStack} ariaLabel={`Symbol for context rule ${index + 1}`} />
              </Field>
            </div>
            <div className="mt-2">
              <RuleStyleEditor
                {...props}
                row={row}
                overridden={props.isOverridden && typeof row.style === "string"}
                fallback={props.styleRules?.fallback ?? { value: "cyan bold", source: "Module style" }}
                setStyle={(style) => update(index, { style })}
              />
            </div>
            <button type="button" className={`${TRASH_BUTTON} mt-2 ml-auto block`} aria-label={`Remove context rule ${index + 1}`} onClick={() => props.onChange(rows.filter((_, i) => i !== index))}><TrashIcon /></button>
          </fieldset>
        );
      })}
      <button type="button" className={`${SMALL_BUTTON} self-start`} onClick={() => props.onChange([...rows, { context_pattern: ".*" }])}>+ Add context rule</button>
    </div>
  );
}

function DirectorySubstitutionsEditor(props: Props) {
  const isMap = Boolean(props.value && typeof props.value === "object" && !Array.isArray(props.value));
  const rows = substitutionRows(props.value);
  const emit = (next: SubstitutionRow[]) => {
    if (isMap) props.onChange(Object.fromEntries(next.map(({ from, to }) => [from, to])));
    else props.onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Substitution representation">
        <button type="button" className={SMALL_BUTTON} aria-pressed={isMap} onClick={() => props.onChange(Object.fromEntries(rows.filter((row) => !row.regex).map(({ from, to }) => [from, to])))}>Literal map</button>
        <button type="button" className={SMALL_BUTTON} aria-pressed={!isMap} onClick={() => props.onChange(rows)}>Ordered / regex rules</button>
      </div>
      {!isMap ? <p className="text-xs text-neutral-400">Rules run in order. Enable regex only when “From” is a regular expression.</p> : null}
      {rows.map((row, index) => (
        <div key={index} className="grid min-w-0 gap-1.5 rounded border border-white/10 p-2 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="From"><input className={INPUT} value={row.from} onChange={(event) => emit(rows.map((current, i) => i === index ? { ...current, from: event.target.value } : current))} /></Field>
          <Field label="To"><SymbolInput value={row.to} onChange={(to) => emit(rows.map((current, i) => i === index ? { ...current, to } : current))} fontStack={props.fontStack} ariaLabel={`Substitution value ${index + 1}`} /></Field>
          <div className="flex items-end gap-1">
            {!isMap ? <Toggle label={`Regex rule ${index + 1}`} checked={Boolean(row.regex)} onChange={(regex) => emit(rows.map((current, i) => i === index ? { ...current, regex } : current))} /> : null}
            <button type="button" className={TRASH_BUTTON} aria-label={`Remove substitution ${index + 1}`} onClick={() => emit(rows.filter((_, i) => i !== index))}><TrashIcon /></button>
          </div>
        </div>
      ))}
      <button type="button" className={`${SMALL_BUTTON} self-start`} onClick={() => emit([...rows, { from: "", to: "" }])}>+ Add substitution</button>
    </div>
  );
}

function CustomWhenEditor(props: Props) {
  const isCommand = typeof props.value === "string";
  const enabled = props.value === true;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Custom command condition type">
        <button type="button" className={SMALL_BUTTON} aria-pressed={!isCommand && !enabled} onClick={() => props.onChange(false)}>Never</button>
        <button type="button" className={SMALL_BUTTON} aria-pressed={!isCommand && enabled} onClick={() => props.onChange(true)}>Always</button>
        <button type="button" className={SMALL_BUTTON} aria-pressed={isCommand} onClick={() => props.onChange(isCommand ? props.value : "")}>Run condition command</button>
      </div>
      {isCommand ? (
        <Field label="Show when this command succeeds">
          <input className={INPUT} value={props.value as string} onChange={(event) => props.onChange(event.target.value)} spellCheck={false} placeholder="test -d .git" />
        </Field>
      ) : null}
    </div>
  );
}

function CommandListEditor(props: Props) {
  const rows = commandRows(props.value);
  const emit = (next: string[][]) => props.onChange(next);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-400">Each row is one executable candidate; each field is one argument. Starship tries them from top to bottom.</p>
      {rows.map((command, rowIndex) => (
        <fieldset key={rowIndex} className="rounded border border-white/10 p-2">
          <legend className="px-1 text-xs text-neutral-400">Command {rowIndex + 1}</legend>
          <div className="flex flex-col gap-1.5">
            {command.map((token, tokenIndex) => (
              <div key={tokenIndex} className="flex gap-1.5">
                <input aria-label={`Command ${rowIndex + 1} argument ${tokenIndex + 1}`} className={INPUT} value={token} onChange={(event) => emit(rows.map((current, i) => i === rowIndex ? current.map((part, j) => j === tokenIndex ? event.target.value : part) : current))} spellCheck={false} placeholder={tokenIndex === 0 ? "executable" : "argument"} />
                <button type="button" className={TRASH_BUTTON} aria-label={`Remove argument ${tokenIndex + 1} from command ${rowIndex + 1}`} onClick={() => emit(rows.map((current, i) => i === rowIndex ? current.filter((_, j) => j !== tokenIndex) : current))}><TrashIcon /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={SMALL_BUTTON} onClick={() => emit(rows.map((current, i) => i === rowIndex ? [...current, ""] : current))}>+ Add argument</button>
              <button type="button" className={SMALL_BUTTON} onClick={() => emit(rows.filter((_, i) => i !== rowIndex))}>Remove command</button>
            </div>
          </div>
        </fieldset>
      ))}
      <button type="button" className={`${SMALL_BUTTON} self-start`} onClick={() => emit([...rows, [""]])}>+ Add command</button>
    </div>
  );
}

export function StructuredOptionEditor(props: Props) {
  switch (props.editor) {
    case "battery-display": return <BatteryDisplayEditor {...props} />;
    case "kubernetes-contexts": return <KubernetesContextsEditor {...props} />;
    case "directory-substitutions": return <DirectorySubstitutionsEditor {...props} />;
    case "custom-when": return <CustomWhenEditor {...props} />;
    case "command-list": return <CommandListEditor {...props} />;
  }
}
