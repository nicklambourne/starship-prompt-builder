"use client";

/**
 * Preview pane: the simulated terminal, the controls for how it looks, and the
 * environment it is simulating.
 *
 * There is no scenario picker: the environment panel can express every
 * scenario the app used to ship and any number besides, so a fixed menu beside
 * it would only be a second, weaker way to say the same thing.
 *
 * The font selector is the reason the terminal is hand-rendered: switching
 * between patched Nerd Fonts and an unpatched system stack is the fastest way
 * for someone to see whether their prompt will actually render on a machine
 * without a patched font.
 */

import {
  TerminalFontPicker,
  TerminalThemePicker,
} from "@/components/builder/TerminalAppearancePickers";
import { Terminal } from "@/components/terminal/Terminal";
import { MAX_FONT_SIZE, MIN_FONT_SIZE, clampFontSize } from "@/lib/fonts";
import type { Segment } from "@/lib/engine/types";
import type { TerminalTheme } from "@/lib/terminalThemes";

interface PreviewPaneProps {
  lines: Segment[][];
  right: Segment[];
  terminalWidth: number;
  leadingNewline: boolean;
  warnings: string[];

  themeId: string;
  onThemeChange(id: string): void;
  fontId: string;
  onFontChange(id: string): void;
  fontSize: number;
  onFontSizeChange(size: number): void;
  theme: TerminalTheme;
  fontStack: string;
}

const SELECT_CLASS =
  "rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none";

export function PreviewPane({
  lines,
  right,
  terminalWidth,
  leadingNewline,
  warnings,
  themeId,
  onThemeChange,
  fontId,
  onFontChange,
  fontSize,
  onFontSizeChange,
  theme,
  fontStack,
}: PreviewPaneProps) {
  return (
    <div className="flex flex-col gap-3">
      <Terminal
        lines={lines}
        right={right}
        terminalWidth={terminalWidth}
        leadingNewline={leadingNewline}
        theme={theme}
        fontStack={fontStack}
        fontSize={fontSize}
      />

      {/*
        One control per row on a phone, three columns once there is room. The
        font control is a name, an info button and a download button; sharing a
        narrow screen with the colour scheme left the name as "Hack…", and the
        point of the picker is reading which font is selected.
      */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <TerminalThemePicker value={themeId} onChange={onThemeChange} />

        <TerminalFontPicker value={fontId} onChange={onFontChange} />

        <div className="flex flex-col gap-1">
          <label htmlFor="font-size" className="text-xs text-neutral-400">
            Font size
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="font-size"
              type="number"
              inputMode="numeric"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              value={fontSize}
              onChange={(e) => onFontSizeChange(clampFontSize(Number(e.target.value)))}
              className={`${SELECT_CLASS} w-16 font-mono`}
            />
            <span className="text-xs text-neutral-500">px</span>
          </div>
        </div>
      </div>

      {warnings.length > 0 ? (
        <ul
          role="status"
          className="flex flex-col gap-1 rounded border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-200"
        >
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
