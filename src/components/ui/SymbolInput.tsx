"use client";

/**
 * A text field whose value may contain Nerd Font glyphs.
 *
 * Two things distinguish it from a plain input: it renders in the terminal
 * font, so private-use glyphs are visible rather than tofu, and it offers the
 * symbol picker — those characters cannot be typed on any keyboard.
 */

import { useRef, useState } from "react";

import { SymbolPicker } from "./SymbolPicker";

interface SymbolInputProps {
  value: string;
  onChange(next: string): void;
  fontStack: string;
  ariaLabel: string;
  id?: string;
  placeholder?: string;
  className?: string;
}

export function SymbolInput({
  value,
  onChange,
  fontStack,
  ariaLabel,
  id,
  placeholder,
  className,
}: SymbolInputProps) {
  const [picking, setPicking] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  const insert = (char: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + char + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + char.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="flex w-full items-center gap-1">
        <input
          id={id}
          ref={ref}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-label={ariaLabel}
          spellCheck={false}
          style={{ fontFamily: fontStack }}
          className={
            className ??
            "w-full rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          }
        />
        <button
          ref={setTrigger}
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-expanded={picking}
          aria-label={`Insert a symbol into ${ariaLabel}`}
          title="Insert a Nerd Font symbol"
          className="shrink-0 rounded border border-white/15 px-1.5 py-1 text-xs text-neutral-300 transition hover:border-accent-400 hover:text-accent-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
        >
          <span style={{ fontFamily: fontStack }} aria-hidden="true">
            &#xf0e7;
          </span>
      </button>
      <SymbolPicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={insert}
        fontStack={fontStack}
        anchor={trigger}
      />
    </div>
  );
}
