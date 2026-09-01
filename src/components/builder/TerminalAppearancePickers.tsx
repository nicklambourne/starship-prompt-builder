"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { CheckIcon, ChevronIcon, DownloadIcon } from "@/components/ui/icons";
import { Popover } from "@/components/ui/Popover";
import { TERMINAL_FONTS, type TerminalFont } from "@/lib/fonts";
import { TERMINAL_THEMES, type TerminalTheme } from "@/lib/terminalThemes";

interface PickerOption {
  id: string;
  label: string;
}

interface CardPickerProps<T extends PickerOption> {
  id: string;
  label: string;
  panelLabel: string;
  options: readonly T[];
  value: string;
  onChange(id: string): void;
  renderValue(option: T): ReactNode;
  renderOption(option: T): ReactNode;
  endAdornment?: ReactNode;
}

const TRIGGER_CLASS =
  "flex min-w-0 flex-1 self-stretch items-center justify-between gap-1.5 rounded border border-white/10 bg-neutral-950 px-2 py-1 text-sm text-neutral-200 transition hover:border-accent-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400";

function CardPicker<T extends PickerOption>({
  id,
  label,
  panelLabel,
  options,
  value,
  onChange,
  renderValue,
  renderOption,
  endAdornment,
}: CardPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-neutral-400">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button
          ref={setAnchor}
          id={id}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
          className={TRIGGER_CLASS}
        >
          <span className="min-w-0 flex-1 truncate">{renderValue(selected)}</span>
          <ChevronIcon
            className={`shrink-0 text-neutral-500 transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
          />
        </button>
        {endAdornment}
      </div>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        width={460}
        label={panelLabel}
      >
        <div className="flex max-h-[26rem] flex-col gap-1 overflow-y-auto p-2">
          {options.map((option) => {
            const isSelected = option.id === selected.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-label={option.label}
                aria-pressed={isSelected}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400 ${
                  isSelected
                    ? "border-accent-400/70 bg-accent-400/10"
                    : "border-transparent hover:border-accent-400/40 hover:bg-white/5"
                }`}
              >
                <span className="min-w-0 flex-1">{renderOption(option)}</span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-accent-300">
                  {isSelected ? <CheckIcon /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: TerminalTheme }) {
  return (
    <span
      data-theme-swatch={theme.id}
      aria-hidden="true"
      className="flex shrink-0 overflow-hidden rounded border border-white/15"
      style={{ backgroundColor: theme.background }}
    >
      {theme.ansi.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="h-2.5 w-1.5 sm:w-2"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

export function TerminalThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange(id: string): void;
}) {
  return (
    <CardPicker
      id="theme-picker"
      label="Terminal color scheme"
      panelLabel="Terminal color schemes"
      options={TERMINAL_THEMES}
      value={value}
      onChange={onChange}
      renderValue={(theme) => (
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate">{theme.label}</span>
          <ThemeSwatch theme={theme} />
        </span>
      )}
      renderOption={(theme) => (
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm text-neutral-100">{theme.label}</span>
            <span className="block text-[11px] text-neutral-400">
              {theme.dark ? "Dark" : "Light"}
            </span>
          </span>
          <ThemeSwatch theme={theme} />
        </span>
      )}
    />
  );
}

function fontStyle(font: TerminalFont): CSSProperties {
  return { fontFamily: font.stack };
}

export function TerminalFontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange(id: string): void;
}) {
  const selected = TERMINAL_FONTS.find((font) => font.id === value) ?? TERMINAL_FONTS[0];

  return (
    <CardPicker
      id="font-picker"
      label="Terminal font"
      panelLabel="Terminal fonts"
      options={TERMINAL_FONTS}
      value={value}
      onChange={onChange}
      renderValue={(font) => <span style={fontStyle(font)}>{font.label}</span>}
      renderOption={(font) => (
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="min-w-0">
            <span
              data-font-name={font.id}
              className="block truncate text-sm text-neutral-100"
              style={fontStyle(font)}
            >
              {font.label}
            </span>
            <span className="block truncate text-[11px] text-neutral-400">
              {font.licence}
            </span>
          </span>
          <span
            data-font-sample={font.id}
            aria-hidden="true"
            className="shrink-0 text-base text-neutral-300"
            style={fontStyle(font)}
          >
            Aa 01 
          </span>
        </span>
      )}
      endAdornment={
        selected.source ? (
          <a
            href={selected.source}
            target="_blank"
            rel="noreferrer"
            aria-label={`Download ${selected.label} from Nerd Fonts`}
            title={`Download ${selected.label}`}
            className="inline-flex shrink-0 items-center rounded border border-white/10 p-1.5 text-neutral-300 transition hover:border-accent-400 hover:text-accent-200"
          >
            <DownloadIcon />
          </a>
        ) : null
      }
    />
  );
}
