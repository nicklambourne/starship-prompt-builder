"use client";

/**
 * One node of the format tree, rendered recursively.
 *
 * Every piece — module, literal text, or group — is the same kind of row, so a
 * group's children get the same handle, toggle, style swatch and expansion as
 * anything at the top level. That is what makes editing inside a group work
 * without a second, weaker UI.
 *
 * A module row also holds that module's settings, which is why there is no
 * separate module list: the thing that puts `$git_branch` in your prompt and
 * the thing that configures it are one row.
 */

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import { StyleSwatch } from "@/components/ui/StyleSwatch";
import { Toggle } from "@/components/ui/Toggle";
import { SymbolInput } from "@/components/ui/SymbolInput";
import { ChevronIcon, EyeOffIcon, GroupIcon, TrashIcon } from "@/components/ui/icons";
import {
  type DropPosition,
  type FormatItem,
  itemLabel,
} from "@/lib/config/formatItems";
import { type Path, pathKey } from "@/lib/config/formatTree";
import type { Palette } from "@/lib/engine/styleString";
import type { TerminalTheme } from "@/lib/terminalThemes";

/**
 * Every control on a row is the same size. They sit in a line, so one of them
 * being smaller than the rest read as an accident rather than a hierarchy.
 */
const ROW_BUTTON_SHAPE =
  "grid size-7 shrink-0 place-items-center rounded border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400";
const ROW_BUTTON = `${ROW_BUTTON_SHAPE} border-white/15 text-neutral-400`;
const GROUP_BUTTON = `${ROW_BUTTON} hover:border-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-200`;
const NEUTRAL_BUTTON = `${ROW_BUTTON} hover:border-accent-400 hover:bg-white/5 hover:text-neutral-100`;
/*
  A row control holding a panel open. Built from the shape rather than by
  adding classes to NEUTRAL_BUTTON: two utilities setting the same property
  resolve by their order in the stylesheet, not in the attribute, so
  overriding a border colour by appending one is a coin toss.
*/
/*
  A row control holding a panel open. Built from the shape rather than by
  adding classes to NEUTRAL_BUTTON: two utilities setting the same property
  resolve by their order in the stylesheet, not in the attribute, so
  overriding a border colour by appending one is a coin toss.
*/
const NEUTRAL_BUTTON_OPEN =
  `${ROW_BUTTON_SHAPE} border-accent-400 bg-accent-400/15 text-accent-200`;

/** Why a row has nothing to open. */
function emptyReason(item: FormatItem): string {
  if (item.kind === "group") return "This group is empty.";
  if (item.kind === "module") {
    return item.name === "all"
      ? "$all stands for every other module, so its settings are theirs."
      : "A variable takes its value from the module it belongs to — there is nothing to set here.";
  }
  return "Nothing to open.";
}

/** Why a row's style control is dead for this module. */
function inertStyleReason(label: string): string {
  return `A style set here cannot reach ${label} — its whole format sits inside its own style group, and starship replaces the surrounding style rather than inheriting it. Open the row and set the module's style option instead.`;
}
const DANGER_BUTTON = `${ROW_BUTTON} hover:border-red-400 hover:bg-red-400/10 hover:text-red-300`;

export interface FormatNodeCallbacks {
  /** Begins a drag from a row's handle; pointer events cover touch too. */
  onHandlePointerDown(event: PointerEvent<HTMLElement>, path: Path): void;
  onNudge(path: Path, direction: -1 | 1): void;
  onGroup(path: Path): void;
  onUngroup(path: Path): void;
  onRemove(path: Path): void;
  onStyleToggle(path: Path): void;
  onExpandToggle(path: Path): void;
  onTextChange(path: Path, value: string): void;
  /**
   * One line about what a `$name` in this tree stands for. The root format
   * holds modules; a module's own format holds that module's variables, and
   * both parse to the same kind of node — so the answer comes from whoever
   * built the tree rather than from the module dictionary.
   */
  describe(name: string): string | undefined;
  /** Modules are switched on and off via their own `disabled` option. */
  isModuleEnabled(name: string): boolean;
  /** Enabled, but rendering nothing right now — and why. */
  inactiveNote(name: string): string | null;
  /** False when a style set on the row cannot reach this module's output. */
  styleReaches(name: string): boolean;
  /**
   * Whether a `$name` in this tree is a module or one of a module's own
   * variables. They are the same node — same kind, same syntax — and only the
   * tree they sit in can tell them apart: the root format holds modules, a
   * module's format holds its variables.
   */
  nameKind(name: string): "module" | "variable";
  onToggleModule(name: string, enabled: boolean): void;
  /**
   * Literal text has no `disabled` option to set — starship has no such thing
   * — so switching a piece off wraps it in a conditional that renders
   * nothing, which is the format string's own way of saying the same.
   */
  onToggleText(path: Path, enabled: boolean): void;
  isGroupEnabled(item: Extract<FormatItem, { kind: "group" }>): boolean;
  onToggleGroup(item: Extract<FormatItem, { kind: "group" }>, enabled: boolean): void;
  groupLabel(item: Extract<FormatItem, { kind: "group" }>): string;
  renderModuleSettings(name: string): ReactNode;
  renderStyleEditor(path: Path, item: FormatItem): ReactNode;
  isExpanded(path: Path): boolean;
  isStyling(path: Path): boolean;
  /** Null when this node is not the current drop target. */
  dropPositionFor(path: Path): DropPosition | null;
  isDragging(path: Path): boolean;
  /** Hidden by the search filter. */
  isFiltered(item: FormatItem, path: Path): boolean;
  theme: TerminalTheme;
  palette?: Palette;
  /** Terminal font stack, so glyph-bearing values render rather than tofu. */
  fontStack: string;
}

/** A module's own variable, which is not a module however alike they look. */
const VARIABLE_TONE = "text-sky-200";

const TONE: Record<FormatItem["kind"], string> = {
  module: "text-accent-200",
  text: "text-neutral-400",
  group: "text-emerald-200",
  raw: "text-amber-200",
};

/**
 * Splits a row into three bands: the outer quarters insert before or after,
 * the middle half drops into a group. Half the row goes to grouping because it
 * is the harder gesture to aim.
 */
export function FormatNode({
  item,
  path,
  callbacks: cb,
}: {
  item: FormatItem;
  path: Path;
  callbacks: FormatNodeCallbacks;
}) {
  if (cb.isFiltered(item, path)) return null;

  const key = pathKey(path);
  const expanded = cb.isExpanded(path);
  const styling = cb.isStyling(path);
  const dropPosition = cb.dropPositionFor(path);
  const dragging = cb.isDragging(path);

  const isModule = item.kind === "module";
  const isGroup = item.kind === "group";
  const isVariable =
    isModule
    && cb.nameKind((item as Extract<FormatItem, { kind: "module" }>).name) === "variable";
  /*
   * `${branch}` rather than `$branch` for a variable: starship accepts both
   * spellings for the same thing, so the braces cost nothing and say which
   * of the two identical-looking rows you are on. The colour says it again
   * for anyone scanning rather than reading.
   */
  const label = isGroup
    ? cb.groupLabel(item)
    : isVariable
      ? `\${${(item as Extract<FormatItem, { kind: "module" }>).name}}`
      : itemLabel(item);
  const isText = item.kind === "text";
  const enabled = isModule
    ? cb.isModuleEnabled(item.name)
    : isGroup
      ? cb.isGroupEnabled(item)
      : isText
        ? !(item as Extract<FormatItem, { kind: "text" }>).disabled
        : true;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      cb.onNudge(path, -1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      cb.onNudge(path, 1);
    }
  };

  /*
   * Rendered once and reused: it is both the answer to "is there anything
   * under this row" and the thing the row shows when opened. A variable
   * inside a module's format looks exactly like a module here — same node
   * kind, same `$name` — and has no settings of its own, so its disclosure
   * used to open on an empty box.
   */
  const settings = isModule
    ? cb.renderModuleSettings((item as Extract<FormatItem, { kind: "module" }>).name)
    : null;
  const hasContent = isText
    || (isGroup && (item as Extract<FormatItem, { kind: "group" }>).items.length > 0)
    || (isModule && settings !== null);
  // Text carries a setting of its own — the literal it prints — so it opens
  // like a module rather than editing in the row, where the field crowded the
  // controls and the symbol picker had nowhere to sit.
  const canExpand = isModule || isGroup || isText;
  /*
   * A row style only paints what a module emits unstyled. `$os` is
   * `[$symbol]($style)` end to end, so nothing set here ever shows — offering
   * a live control would be a lie.
   */
  const styleIsInert =
    isModule && !cb.styleReaches((item as Extract<FormatItem, { kind: "module" }>).name);
  const moduleNote = isModule
    ? cb.inactiveNote((item as Extract<FormatItem, { kind: "module" }>).name)
    : null;

  return (
    <li
      data-format-row={key}
      className={`relative rounded border bg-neutral-900/60 transition ${
        dragging ? "border-accent-400/40 opacity-40" : "border-white/10"
      } ${dropPosition === "into" ? "ring-2 ring-emerald-400/70" : ""} ${
        // 55% put the text below the contrast floor and 75% still missed it
        // by a hair (4.45 against 4.5); 85% clears it, and with the switch
        // beside it the row still reads as off.
        enabled ? "" : "opacity-85"
      }`}
    >
      {dropPosition === "before" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-0.5 left-0 right-0 h-0.5 rounded bg-accent-400"
        />
      ) : null}
      {dropPosition === "after" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-0.5 rounded bg-accent-400"
        />
      ) : null}

      <div className="flex items-center gap-1 px-1.5 py-1">
        <button
          type="button"
          onPointerDown={(event) => cb.onHandlePointerDown(event, path)}
          onKeyDown={handleKeyDown}
          aria-label={`Reorder ${label}. Press the arrow keys to move it, or drag it onto another piece to group them.`}
          // Without `touch-action: none` the browser claims the gesture as a
          // scroll before the first pointermove arrives, which is why the
          // handles did nothing on a phone.
          style={{ touchAction: "none" }}
          className="shrink-0 cursor-grab rounded px-1 py-0.5 text-neutral-600 transition hover:bg-white/10 hover:text-neutral-200 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true" fill="currentColor">
            <circle cx="2.5" cy="3" r="1.3" />
            <circle cx="7.5" cy="3" r="1.3" />
            <circle cx="2.5" cy="8" r="1.3" />
            <circle cx="7.5" cy="8" r="1.3" />
            <circle cx="2.5" cy="13" r="1.3" />
            <circle cx="7.5" cy="13" r="1.3" />
          </svg>
        </button>

        {isModule || isGroup || isText ? (
          <Toggle
            size="sm"
            label={
              isModule
                ? `Enable ${(item as Extract<FormatItem, { kind: "module" }>).name}`
                : isText
                  ? `Enable ${label}`
                  : `Enable everything in ${label}`
            }
            checked={enabled}
            onChange={(next) =>
              isModule
                ? cb.onToggleModule(
                    (item as Extract<FormatItem, { kind: "module" }>).name,
                    next,
                  )
                : isText
                  ? cb.onToggleText(path, next)
                  : cb.onToggleGroup(
                      item as Extract<FormatItem, { kind: "group" }>,
                      next,
                    )
            }
          />
        ) : null}

        {canExpand ? (
          <button
            type="button"
            onClick={() => cb.onExpandToggle(path)}
            aria-expanded={hasContent ? expanded : undefined}
            disabled={!hasContent}
            className={`flex min-w-0 flex-1 flex-col text-left ${
              hasContent ? "" : "cursor-default"
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`truncate font-mono text-sm ${
                  isVariable ? VARIABLE_TONE : TONE[item.kind]
                } ${isText ? "nerd-font" : ""}`}
              >
                {label}
              </span>
              {isModule && enabled && moduleNote ? (
                /*
                 * A module can be on and still print nothing, which reads as a
                 * bug unless it is said out loud. The reason is a sentence and
                 * the row is narrow, so the row carries the state and the
                 * tooltip carries the explanation.
                 */
                <span
                  title={moduleNote}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-300/90"
                >
                  <EyeOffIcon className="size-3 shrink-0" />
                  Not visible
                </span>
              ) : null}
            </span>
            {isModule ? (
              <span
                className={`truncate text-xs ${
                  enabled ? "text-neutral-500" : "text-neutral-400"
                }`}
              >
                {cb.describe((item as Extract<FormatItem, { kind: "module" }>).name)}
              </span>
            ) : null}
          </button>
        ) : (
          // Only raw fragments are left: nothing to open, nothing to edit.
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={`truncate font-mono text-sm ${TONE[item.kind]}`}>
              {label}
            </span>
          </span>
        )}

        {isGroup ? (
          <button
            type="button"
            className={NEUTRAL_BUTTON}
            aria-label={`Ungroup ${label}`}
            title="Dissolve this group, keeping its contents"
            onClick={() => cb.onUngroup(path)}
          >
            ⧉
          </button>
        ) : (
          <button
            type="button"
            className={GROUP_BUTTON}
            aria-label={`Put ${label} in a group`}
            title="Put this in a group of its own, then drag others onto it"
            onClick={() => cb.onGroup(path)}
          >
            <GroupIcon />
          </button>
        )}

        {/*
          * A group of one cannot carry a style — the format string writes it
          * exactly like a styled module — so the member's own style button
          * does that job instead.
          */}
        {item.kind !== "raw" && !(isGroup && item.items.length === 1) ? (
          /*
           * The reason sits on a wrapper, not the button: a disabled button
           * takes no pointer events, so its own `title` may never appear —
           * and with the control disabled, the style panel that used to
           * explain this can no longer be opened.
           */
          <span
            className="inline-flex"
            title={styleIsInert ? inertStyleReason(label) : undefined}
          >
            <button
              type="button"
              aria-label={
                styleIsInert
                  ? `Style of ${label} — no effect. ${inertStyleReason(label)}`
                  : `Change the style of ${label}`
              }
              aria-expanded={styleIsInert ? undefined : styling}
              // The accent below is the visible half of this; the attribute is
              // the same fact in a form a test can read without measuring
              // colours a hovering mouse also changes.
              data-open={styling ? "" : undefined}
              disabled={styleIsInert}
              onClick={() => cb.onStyleToggle(path)}
              /*
                The editor it opens is a panel further down the row, and on a
                long format it can be the only thing on screen — so the button
                says whether it is the one holding it open, in the accent the
                rest of the app uses for "on". `aria-expanded` above says the
                same to a screen reader.
              */
              /*
                The editor it opens is a panel further down the row, and on a
                long format it can be the only thing on screen — so the button
                says whether it is the one holding it open, in the accent the
                rest of the app uses for "on". `aria-expanded` above says the
                same to a screen reader.
              */
              className={
                styleIsInert
                  ? `${NEUTRAL_BUTTON} cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-transparent hover:text-neutral-300`
                  : styling
                    ? NEUTRAL_BUTTON_OPEN
                    : NEUTRAL_BUTTON
              }
            >
              <span className="relative inline-grid place-items-center">
                <StyleSwatch style={item.style} theme={cb.theme} palette={cb.palette} />
                {styleIsInert ? (
                  // Struck through: the control stays where the eye expects
                  // it, and says plainly that it does nothing here.
                  <span
                    aria-hidden="true"
                    className="absolute h-px w-7 rotate-45 rounded bg-neutral-200"
                  />
                ) : null}
              </span>
            </button>
          </span>
        ) : null}

        <button
          type="button"
          aria-label={`Remove ${label} from the prompt`}
          title={
            isModule
              ? "Remove from the prompt. To keep it but hide it, use the switch."
              : "Remove from the prompt"
          }
          onClick={() => cb.onRemove(path)}
          className={DANGER_BUTTON}
        >
          <TrashIcon />
        </button>

        {canExpand ? (
          <button
            type="button"
            aria-label={
              hasContent
                ? `${expanded ? "Collapse" : "Expand"} ${label}`
                : `${label} — nothing to open. ${emptyReason(item)}`
            }
            aria-expanded={hasContent ? expanded : undefined}
            disabled={!hasContent}
            title={
              !hasContent
                ? emptyReason(item)
                : isModule
                  ? "Show this module's settings"
                  : isText
                    ? "Edit the text this prints"
                    : "Show what is in this group"
            }
            onClick={() => cb.onExpandToggle(path)}
            className={
              hasContent
                ? NEUTRAL_BUTTON
                : `${NEUTRAL_BUTTON} cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-transparent hover:text-neutral-300`
            }
          >
            <ChevronIcon
              className={`transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        ) : null}
      </div>

      {styling && item.kind !== "raw" ? (
        <div className="border-t border-white/10 p-2">{cb.renderStyleEditor(path, item)}</div>
      ) : null}

      {expanded && isModule && settings ? (
        <div className="border-t border-white/10 px-2.5 pb-3 pt-1">{settings}</div>
      ) : null}

      {expanded && isText ? (
        <div className="flex flex-col gap-1.5 border-t border-white/10 px-2.5 pb-3 pt-2">
          <span className="text-xs text-neutral-400">
            Printed exactly as written, between the pieces either side of it
          </span>
          <SymbolInput
            value={(item as Extract<FormatItem, { kind: "text" }>).value}
            onChange={(next) => cb.onTextChange(path, next)}
            fontStack={cb.fontStack}
            ariaLabel={`Text content of ${label}`}
            className="w-full rounded border border-white/10 bg-neutral-950 px-2 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          />
        </div>
      ) : null}

      {expanded && isGroup ? (
        <ul className="ml-4 flex flex-col gap-1 border-l border-white/10 py-1 pl-2 pr-1.5">
          {(item as Extract<FormatItem, { kind: "group" }>).items.map(
            (child, childIndex) => (
              <FormatNode
                key={`${key}.${childIndex}`}
                item={child}
                path={[...path, childIndex]}
                callbacks={cb}
              />
            ),
          )}
        </ul>
      ) : null}
    </li>
  );
}
