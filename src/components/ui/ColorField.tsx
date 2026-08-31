"use client";

/**
 * A colour swatch that opens a picker in the page.
 *
 * `<input type="color">` opens the operating system's colour dialogue, which
 * is a different application: it covers the prompt you are colouring, looks
 * nothing like the rest of the app, and on a Mac remembers its own state
 * across sites. This is react-colorful — 2 kB, no dependencies — in the same
 * popover the symbol picker uses, so the preview stays visible while you drag.
 *
 * The hex field beside it stays authoritative: a palette entry may hold things
 * a picker cannot express (`red`, `bold`, `12`), and typing one must not be
 * fought by a control that only understands hex.
 */

import { useState } from "react";
import { HexColorPicker } from "react-colorful";

import { Popover } from "./Popover";

interface ColorFieldProps {
  /** Accessible name for the swatch button. */
  label: string;
  /** A hex colour to open on. */
  value: string;
  onChange(next: string): void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{ backgroundColor: value }}
        className="h-8 w-9 shrink-0 cursor-pointer rounded border border-white/20 transition hover:border-accent-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
      />
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor}
        label={label}
        width={232}
      >
        <div className="flex flex-col gap-2 p-1">
          <HexColorPicker color={value} onChange={onChange} />
          <span className="text-center font-mono text-xs text-neutral-400">{value}</span>
        </div>
      </Popover>
    </>
  );
}
