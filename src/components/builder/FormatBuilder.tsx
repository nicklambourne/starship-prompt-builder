"use client";

/**
 * Visual editor for a format string.
 *
 * The format is the prompt, so this is the only place modules are managed:
 * each row switches its module on or off, holds that module's settings, and
 * can be dragged, grouped and recoloured. Groups nest, and their children get
 * exactly the same affordances as the top level.
 *
 * Conditional sections share the same editing controls as styled groups.
 * Redundant style wrappers are hidden by default, not removed from the config.
 */

import { useMemo, useRef, useState } from "react";

import { FormatNode, type FormatNodeCallbacks } from "./FormatNode";
import { usePointerDrag } from "./usePointerDrag";
import { StyleStringBuilder } from "./StyleStringBuilder";
import {
  type FormatItem,
  type DropPosition,
  fromItems,
  gatherCategory,
  groupName,
  groupableCategories,
  isRedundantStyleWrapper,
  toItems,
  ungroup,
} from "@/lib/config/formatItems";
import {
  type Path,
  collectModuleNames,
  getAt,
  moveTo,
  nudge,
  pathKey,
  removeAt,
  updateAt,
} from "@/lib/config/formatTree";
import { describeModule } from "@/lib/config/descriptions";
import { isStyleVariable } from "@/lib/config/styleReach";
import { formatItemStyle, formatItemStyleSource, type FormatStyleVariables } from "@/lib/config/formatStyles";
import { groupVisibility } from "@/lib/config/formatVisibility";
import type { VariableMap } from "@/lib/engine/render";
import { MODULE_META } from "@/lib/config/meta";
import { tryParseFormatString } from "@/lib/engine/formatString";
import type { Palette } from "@/lib/engine/styleString";
import type { TerminalTheme } from "@/lib/terminalThemes";

interface FormatBuilderProps {
  value: string;
  onChange(next: string): void;
  vocabulary: string[];
  /**
   * One line about an entry in the vocabulary. Defaults to the module
   * descriptions, which is right for the root format; a module's own format
   * holds variables instead, and describes them from starship's docs.
   */
  describe?(name: string): string | undefined;
  palette?: Palette;
  paletteNames?: string[];
  /** Colours the prompt already uses, for the style editors' own row. */
  inUseColors?: string[];
  styleVariables?: FormatStyleVariables;
  variables?: VariableMap;
  noun?: string;
  allowCategoryGrouping?: boolean;
  scope?: string;
  theme: TerminalTheme;
  /** Terminal font stack, so glyph-bearing values render rather than tofu. */
  fontStack: string;
  /** Present only for the root format, where rows manage real modules. */
  modules?: {
    isEnabled(name: string): boolean;
    inactiveNote(name: string): string | null;
    styleReaches(name: string): boolean;
    /**
     * The module's own `style` option, when it has one. The row's style
     * control edits that rather than a style written around the module in the
     * format string, which is the one starship actually paints with.
     */
    styleOption(name: string): {
      value: string;
      isDefault: boolean;
      defaultValue: string;
      /** Whether the module's format still spends `$style`. */
      spent: boolean;
    } | null;
    setStyleOption(name: string, value: string | undefined): void;
    /** Rewrites the module's format so it spends `$style` again. */
    restoreStyleVariable(name: string): void;
    setEnabled(name: string, enabled: boolean): void;
    renderSettings(name: string): React.ReactNode;
  };
  /**
   * The `style` option of the module whose format this is, when this editor is
   * a module's own format. Items can inherit this option through `$style`
   * or explicitly detach from it to edit their own style.
   */
  ownerStyle?: {
    value: string;
    isDefault: boolean;
    defaultValue: string;
    set(value: string | undefined): void;
  };
  /** Shows a search box; worth it once the tree is long. */
  searchable?: boolean;
}

const SMALL_BUTTON_SHAPE = "rounded border px-2 py-1 text-xs transition";
const SMALL_BUTTON =
  `${SMALL_BUTTON_SHAPE} border-white/15 text-neutral-200 hover:border-accent-400 hover:text-accent-200`;
/*
  A toggle that is currently open. Separate string rather than extra classes
  appended to SMALL_BUTTON: two utilities setting the same property resolve by
  their order in the stylesheet, not in the attribute, so "override by
  appending" is a coin toss.
*/
const SMALL_BUTTON_OPEN =
  `${SMALL_BUTTON_SHAPE} border-accent-400 bg-accent-400/15 text-accent-200`;

/**
 * The panel behind the module row's swatch, editing its shared `style` option.
 */
function ModuleStyleEditor({
  own,
  set,
  onRestore,
  note,
  palette,
  paletteNames,
  inUseColors,
  theme,
}: {
  own: {
    value: string;
    isDefault: boolean;
    defaultValue: string;
    spent: boolean;
    /** The format that putting `$style` back would write. */
    restoreTo?: string | null;
  };
  set(value: string | undefined): void;
  /** Offered where the format has stopped spending the option. */
  onRestore?(): void;
  note: React.ReactNode;
  palette?: Palette;
  paletteNames?: string[];
  inUseColors?: string[];
  theme: TerminalTheme;
}) {
  return (
    <>
      <p className="mb-2 text-xs text-neutral-500">{note}</p>
      {own.spent ? null : (
        /*
          The value is still the module's to hold, so the control stays; what
          is missing is the format that would spend it, and that is a sentence
          — with the edit that fixes it attached — rather than a reason to
          remove the only way to set it.
        */
        <p className="mb-2 text-xs text-amber-300/90">
          This module&rsquo;s format no longer uses{" "}
          <code className="text-amber-200">$style</code>, so nothing set here will
          show until it does.{" "}
          {onRestore ? (
            <button
              type="button"
              onClick={onRestore}
              title={
                own.restoreTo
                  ? `Sets this module's format option to ${own.restoreTo}`
                  : undefined
              }
              className="underline underline-offset-2 hover:text-amber-200"
            >
              Put $style back
            </button>
          ) : null}
          {onRestore ? (
            <span className="mt-1 block text-neutral-500">
              Edits the module&rsquo;s <code className="text-neutral-400">format</code>{" "}
              option, which opens below.
            </span>
          ) : null}
        </p>
      )}
      <StyleStringBuilder
        value={own.value}
        onChange={set}
        palette={palette}
        paletteNames={paletteNames}
        inUseColors={inUseColors}
        theme={theme}
      />
      {own.isDefault ? null : (
        <button
          type="button"
          onClick={() => set(undefined)}
          className="mt-2 self-start text-xs text-neutral-400 underline underline-offset-2 hover:text-accent-200"
        >
          Reset to the default ({own.defaultValue || "no style"})
        </button>
      )}
    </>
  );
}

export function FormatBuilder({
  value,
  onChange,
  vocabulary,
  describe = describeModule,
  palette,
  paletteNames,
  inUseColors,
  noun = "module",
  allowCategoryGrouping = false,
  scope,
  theme,
  fontStack,
  modules,
  ownerStyle,
  styleVariables,
  variables,
  searchable = false,
}: FormatBuilderProps) {
  const formatStyles = styleVariables ?? { style: ownerStyle?.value };
  const moduleStyle = formatStyles.style;
  const [showRaw, setShowRaw] = useState(false);
  const [showAllStyleWrappers, setShowAllStyleWrappers] = useState(false);
  const [styling, setStyling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  /** Groups the reader has closed, where the default is open. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [dragging, setDragging] = useState<Path | null>(null);
  const [dropTarget, setDropTarget] = useState<
    { path: Path; position: DropPosition } | null
  >(null);

  const derived = useMemo(() => toItems(value), [value]);
  /*
   * The arrangement the reader is working on, which the format string cannot
   * always express. "a" then "b" is the same string as "ab", and a text piece
   * emptied of its last character is the same string as no text piece at all
   * — so a tree re-derived from the string on every keystroke silently joins
   * adjacent text and deletes a row the moment it goes empty, mid-typing.
   *
   * Kept only while it still describes exactly this string. Anything that
   * changes the string from elsewhere — a preset, a paste into the TOML pane,
   * undo — no longer matches, and the string wins.
   */
  const [arrangement, setArrangement] = useState<FormatItem[] | null>(null);
  const items = arrangement && fromItems(arrangement) === value ? arrangement : derived;
  const parse = useMemo(() => tryParseFormatString(value), [value]);

  const commit = (next: FormatItem[]) => {
    setStyling(null);
    setArrangement(next);
    onChange(fromItems(next));
  };

  const categoryOf = (name: string) => MODULE_META[name]?.group;

  const candidates = useMemo(() => {
    const needle = addSearch.trim().toLowerCase();
    return vocabulary
      .filter((name) => !needle || name.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [vocabulary, addSearch]);

  const categories = allowCategoryGrouping && items
    ? groupableCategories(items, categoryOf)
    : [];

  /*
    Everything below runs before the early return for an unparseable format,
    hooks included — React counts them, and a format that stops parsing
    mid-edit used to take a shorter path through this component than the
    render before it. That is React error #300, and it crashed the whole page
    the moment someone deleted a bracket.
  */
  // The list as it stands right now, for handlers that outlive their render.
  const itemsRef = useRef(items ?? []);
  itemsRef.current = items ?? [];

  // A compact row moves with its hidden wrappers. Styling and dropping INTO
  // it still address the visible child, so edits reach the intended group.
  const movePath = (path: Path): Path => {
    let target = path;
    while (!showAllStyleWrappers && target.length > 1) {
      const parentPath = target.slice(0, -1);
      const parent = getAt(itemsRef.current, parentPath);
      if (!parent || !isRedundantStyleWrapper(parent)) break;
      target = parentPath;
    }
    return target;
  };

  /*
   * One drag implementation for mouse, pen and touch. The native HTML5 API
   * this replaced never fired on a phone, which left the handles inert there
   * and reordering reachable only from a keyboard.
   */
  const startPointerDrag = usePointerDrag({
    onDragStart: (path) => {
      setDragging(path);
      setDropTarget(null);
    },
    onDragOver: (path, position) => setDropTarget({ path, position }),
    onDrop: (from, to, position) => {
      // Read through a ref for the same reason `from` is passed in: this
      // closure is as old as the drag.
      commit(moveTo(itemsRef.current, movePath(from), position === "into" ? to : movePath(to), position));
      setDragging(null);
      setDropTarget(null);
    },
    onCancel: () => setDropTarget(null),
  });

  if (!items) {
    return (
      <div className="flex flex-col gap-2" data-format-scope={scope}>
        <textarea
          value={value}
          rows={3}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Format string"
          aria-invalid
          className="w-full resize-y rounded border border-red-500/60 bg-neutral-950 px-2.5 py-2 font-mono text-base text-neutral-100 focus:outline-none"
        />
        {!parse.ok ? (
          <p role="alert" className="text-xs text-red-400">
            {parse.error} (at character {parse.index + 1})
          </p>
        ) : null}
      </div>
    );
  }

  const needle = filter.trim().toLowerCase();

  /** Whether a subtree contains anything matching the search. */
  const matches = (item: FormatItem): boolean => {
    if (!needle) return true;
    if (item.kind === "module") {
      return (
        item.name.toLowerCase().includes(needle) ||
        (describe(item.name)?.toLowerCase().includes(needle) ?? false)
      );
    }
    if (item.kind === "group") return item.items.some(matches);
    return false;
  };

  const toggleSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const callbacks: FormatNodeCallbacks = {
    theme,
    fontStack,
    palette,
    managesModules: Boolean(modules),
    showAllStyleWrappers,
    groupVisibility: (path) => groupVisibility(items, path, variables),
    onConditionalChange: (path, conditional) => commit(updateAt(items, path, (item) =>
      item.kind === "group" ? { ...item, conditional, style: item.style ?? (item.conditional === undefined ? "" : undefined) } : item,
    )),
    renderGroupAdditions: (path) => {
      const append = (child: FormatItem) => commit(updateAt(items, path, (item) =>
        item.kind === "group" ? { ...item, items: [...item.items, child] } : item,
      ));
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-2 px-2 py-1.5">
          <select
            aria-label={`Add ${noun} to group`}
            value=""
            onChange={(event) => { if (event.target.value) append({ kind: "module", name: event.target.value }); }}
            className="min-w-0 max-w-full rounded border border-white/15 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
          >
            <option value="">+ Add {noun}…</option>
            {vocabulary.map(name => <option key={name} value={name}>${name}</option>)}
          </select>
          <button type="button" className={SMALL_BUTTON} onClick={() => append({ kind: "text", value: " " })}>+ Add text</button>
        </div>
      );
    },
    onHandlePointerDown: startPointerDrag,
    onNudge: (path, direction) => commit(nudge(items, movePath(path), direction)),
    onGroup: (path) =>
      commit(
        updateAt(items, path, (item) =>
          item.kind === "group" ? item : { kind: "group", items: [item] },
        ),
      ),
    onUngroup: (path) => {
      // ungroup() works on a list, so operate on the parent's children.
      const parentPath = path.slice(0, -1);
      const index = path[path.length - 1];
      if (parentPath.length === 0) {
        commit(ungroup(items, index));
        return;
      }
      commit(
        updateAt(items, parentPath, (parent) =>
          parent.kind === "group"
            ? { ...parent, items: ungroup(parent.items, index) }
            : parent,
        ),
      );
    },
    onRemove: (path) => commit(removeAt(items, path)),
    onStyleToggle: (path) =>
      setStyling(styling === pathKey(path) ? null : pathKey(path)),
    onExpandToggle: (path) => {
      const key = pathKey(path);
      /*
        The style editor is a panel of its own, opened from the same row but
        rendered outside the part that collapses — so closing a row used to
        leave its style editor standing there, attached to a row that was no
        longer showing anything else. Closing a row now closes the editor it
        opened, and any belonging to something inside it.
      */
      const closeStyleEditorUnder = () => {
        if (styling === null) return;
        if (styling === key || styling.startsWith(`${key}.`)) setStyling(null);
      };

      // In a module's format an untouched group is already open, so the first
      // toggle has to close it rather than record it as opened.
      if (!modules && !expanded.has(key) && !collapsed.has(key)) {
        const item = getAt(items, path);
        if (item?.kind === "group") {
          setCollapsed(toggleSet(collapsed, key));
          closeStyleEditorUnder();
          return;
        }
      }
      if (expanded.has(key)) closeStyleEditorUnder();
      setCollapsed((current) => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setExpanded(toggleSet(expanded, key));
    },
    // Through `commit` like every other edit, so the row survives being
    // emptied: "" and "no text piece here" are the same format string, and
    // only the arrangement remembers which one this is.
    onTextChange: (path, next) =>
      commit(
        updateAt(items, path, (item) =>
          item.kind === "text" ? { ...item, value: next } : item,
        ),
      ),
    describe,
    // The root format is the only one holding modules; every other instance of
    // this editor is a module's own format, and holds that module's variables.
    nameKind: () => (modules ? "module" : "variable"),
    isModuleEnabled: (name) => modules?.isEnabled(name) ?? true,
    inactiveNote: (name) => modules?.inactiveNote(name) ?? null,
    styleReaches: (name) => modules?.styleReaches(name) ?? true,
    rowStyle: (item, path) => {
      if (item.kind === "raw") return {};
      if (item.kind === "module") {
        const own = modules?.styleOption(item.name) ?? null;
        if (own) return { value: own.value, ownTitle: `Set $${item.name}'s own style` };
      }
      const value = formatItemStyle(items, path, formatStyles);
      if (moduleStyle !== undefined && isStyleVariable(formatItemStyleSource(items, path) ?? "")) {
        return {
          value,
          ownTitle: "Inherits the module's style — choose Override to style only this item",
          paintedByStyle: true,
        };
      }
      return { value };
    },
    onToggleModule: (name, enabled) => modules?.setEnabled(name, enabled),
    onToggleText: (path, enabled) =>
      commit(
        updateAt(items, path, (item) =>
          item.kind === "text" ? { ...item, disabled: !enabled } : item,
        ),
      ),
    isGroupEnabled: (group) =>
      collectModuleNames(group.items).some((name) => modules?.isEnabled(name) ?? true),
    onToggleGroup: (group, enabled) => {
      for (const name of collectModuleNames(group.items)) {
        modules?.setEnabled(name, enabled);
      }
    },
    groupLabel: (group) =>
      `${modules ? groupName(group, categoryOf) : "Group"} (${group.items.length})`,
    renderModuleSettings: (name) => modules?.renderSettings(name) ?? null,
    renderStyleEditor: (path, item) => {
      const own = item.kind === "module" ? (modules?.styleOption(item.name) ?? null) : null;
      if (!own && !modules && item.kind !== "raw") {
        const parentStyle = formatItemStyleSource(items, path.slice(0, -1));
        const transparent = item.style === undefined && (item.kind !== "group" || item.conditional !== undefined);
        const inherited = transparent || isStyleVariable(item.style ?? "");
        const effective = formatItemStyle(items, path, formatStyles) ?? "";
        const setItemStyle = (style: string | undefined) => {
          const next = updateAt(items, path, (target) =>
            target.kind === "raw" ? target : target.kind === "group" && style === undefined
              ? { ...target, style, conditional: target.conditional ?? false }
              : { ...target, style },
          );
          // Preserve the arrangement and the open editor while changing mode.
          setArrangement(next);
          onChange(fromItems(next));
        };
        return (
          <StyleStringBuilder
            value={inherited ? effective : (item.style ?? "")}
            onChange={(style) => setItemStyle(style.trim() ? style : "none")}
            inheritance={{
              inherited,
              source: isStyleVariable(item.style ?? "") ? "Module style" : parentStyle !== undefined ? "Surrounding group" : "Terminal default",
              onChange: (inherit) => {
                if (inherit === inherited) return;
                setItemStyle(inherit
                  ? (parentStyle !== undefined || moduleStyle === undefined ? undefined : "$style")
                  : (effective.trim() || "none"));
              },
            }}
            palette={palette}
            paletteNames={paletteNames}
            inUseColors={inUseColors}
            theme={theme}
          />
        );
      }
      /*
        For a module that has one, this is its `style` option — the value
        `$style` resets to inside its own format, and the only style most
        modules ever show. It is edited here rather than in the list below so
        that the swatch on the row is the colour the module prints.
      */
      if (own && item.kind === "module") {
        return (
          <ModuleStyleEditor
            own={own}
            set={(style) => modules?.setStyleOption(item.name, style)}
            onRestore={() => {
              modules?.restoreStyleVariable(item.name);
              // The settings are what the edit lands in, so open them: the
              // option itself opens from the other end, in the form.
              setExpanded((current) => new Set(current).add(pathKey(path)));
            }}
            note={
              <>
                Sets <code className="text-neutral-400">${item.name}</code>&rsquo;s{" "}
                <code className="text-neutral-400">style</code> option, which is what{" "}
                <code className="text-neutral-400">$style</code> stands for in its
                format.
              </>
            }
            palette={palette}
            paletteNames={paletteNames}
            inUseColors={inUseColors}
            theme={theme}
          />
        );
      }
      return (
        <>
          {item.kind === "module" ? (
            <p className="mb-2 text-xs text-neutral-500">
              Applies only to parts of{" "}
              <code className="text-neutral-400">${item.name}</code> that do not
              set their own style.
            </p>
          ) : null}
          <StyleStringBuilder
            value={item.kind === "raw" ? "" : (item.style ?? "")}
            onChange={(style) =>
              onChange(
                fromItems(
                  updateAt(items, path, (target) =>
                    target.kind === "raw"
                      ? target
                      : { ...target, style: style || undefined },
                  ),
                ),
              )
            }
            palette={palette}
            paletteNames={paletteNames}
            inUseColors={inUseColors}
            theme={theme}
          />
        </>
      );
    },
    isExpanded: (path) => {
      // A search auto-opens the groups holding its matches.
      if (needle) {
        const item = getAt(items, path);
        if (item?.kind === "group") return true;
      }
      if (expanded.has(pathKey(path))) return true;
      /*
        A module's own format opens with its groups already open, unlike the
        root, and for the opposite reason: the root holds a hundred modules,
        where a collapsed group is what makes the list readable, while a
        module holds a handful of variables and almost always wraps them in
        one style group. Collapsed, that panel is a single "Group (5)" row —
        the variables and what each of them means, which is the whole point of
        opening it, are one more click away with nothing on screen to suggest
        it. Only ever an initial state: `collapsed` records what the reader
        has since closed.
      */
      if (!modules && !collapsed.has(pathKey(path))) {
        return getAt(items, path)?.kind === "group";
      }
      return false;
    },
    isStyling: (path) => styling === pathKey(path),
    dropPositionFor: (path) =>
      dropTarget && pathKey(dropTarget.path) === pathKey(path)
        ? dropTarget.position
        : null,
    isDragging: (path) => dragging !== null && pathKey(dragging) === pathKey(path),
    isFiltered: (item) => !matches(item),
  };

  const visibleCount = needle
    ? collectModuleNames(items).filter((name) =>
        matches({ kind: "module", name }),
      ).length
    : collectModuleNames(items).length;
  const hasRedundantWrappers = (list: FormatItem[]): boolean => list.some(item =>
    isRedundantStyleWrapper(item) || (item.kind === "group" && hasRedundantWrappers(item.items)),
  );

  return (
    <div className="flex flex-col gap-2" data-format-scope={scope}>
      {searchable ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`filter-${scope}`} className="sr-only">
            Search prompt items
          </label>
          <input
            id={`filter-${scope}`}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search modules…"
            className="w-full rounded border border-white/10 bg-neutral-950 px-2.5 py-1.5 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          />
          {needle ? (
            <p className="text-xs text-neutral-500" aria-live="polite">
              {visibleCount} matching {visibleCount === 1 ? "module" : "modules"}
            </p>
          ) : null}
        </div>
      ) : null}

      <ul className="flex flex-col gap-1">
        {items.map((item, index) => (
          <FormatNode
            key={index}
            item={item}
            path={[index]}
            callbacks={callbacks}
          />
        ))}
        {items.length === 0 ? (
          <li className="rounded border border-dashed border-white/15 px-2 py-3 text-center text-xs text-neutral-500">
            Empty — nothing will be rendered.
          </li>
        ) : null}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {/*
          The list this opens appears below the row of buttons, and on a long
          format it can open off-screen — so the button itself has to say it
          is the thing holding the list open. `aria-expanded` said so already;
          this is the same fact for people who are looking rather than
          listening, in the accent the rest of the app uses for "on".
        */}
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-expanded={adding}
          className={adding ? SMALL_BUTTON_OPEN : SMALL_BUTTON}
        >
          {adding ? "−" : "+"} Add {noun}
        </button>
        <button
          type="button"
          onClick={() => commit([...items, { kind: "text", value: " " }])}
          className={SMALL_BUTTON}
        >
          + Add text
        </button>
        <button
          type="button"
          onClick={() => commit([...items, { kind: "group", items: [], conditional: true }])}
          className={SMALL_BUTTON}
        >
          + Add conditional group
        </button>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => commit(gatherCategory(items, categoryOf, category))}
            title={`Collect every ${category} module into one group. This moves them together in the prompt.`}
            className={SMALL_BUTTON}
          >
            Group {category.toLowerCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="ml-auto text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-300"
        >
          {showRaw ? "Hide" : "Edit"} raw format string
        </button>
      </div>

      {hasRedundantWrappers(items) ? (
        <label className="flex items-start gap-2 text-xs text-neutral-400">
          <input type="checkbox" checked={showAllStyleWrappers} onChange={event => setShowAllStyleWrappers(event.target.checked)} className="mt-0.5 accent-accent-500" />
          Show all style wrappers (advanced)
        </label>
      ) : null}

      {adding ? (
        <div className="flex flex-col gap-2 rounded border border-white/10 bg-neutral-900/60 p-2">
          <label className="sr-only" htmlFor={`add-${scope ?? noun}`}>
            Search {noun}s to add
          </label>
          <input
            id={`add-${scope ?? noun}`}
            type="search"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder={`Search ${noun}s…`}
            className="w-full rounded border border-white/10 bg-neutral-950 px-2 py-1 text-base text-neutral-100 focus:border-accent-400 focus:outline-none"
          />
          <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
            {candidates.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => {
                    commit([...items, { kind: "module", name }]);
                    setAdding(false);
                    setAddSearch("");
                  }}
                  className="flex w-full flex-col rounded px-1.5 py-1 text-left transition hover:bg-white/5"
                >
                  <span
                    className={`font-mono text-xs ${
                      modules ? "text-accent-200" : "text-sky-200"
                    }`}
                  >
                    {modules ? `$${name}` : `\${${name}}`}
                  </span>
                  {describe(name) ? (
                    <span className="truncate text-xs text-neutral-500">
                      {describe(name)}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
            {candidates.length === 0 ? (
              <li className="px-1 py-2 text-xs text-neutral-500">No matches.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {showRaw ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`raw-${scope ?? noun}`} className="sr-only">
            Raw format string
          </label>
          <textarea
            id={`raw-${scope ?? noun}`}
            value={value}
            rows={3}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!parse.ok}
            className={`w-full resize-y rounded border bg-neutral-950 px-2.5 py-2 font-mono text-base text-neutral-100 focus:outline-none ${
              parse.ok ? "border-white/10 focus:border-accent-400" : "border-red-500/60"
            }`}
          />
          {!parse.ok ? (
            <p role="alert" className="text-xs text-red-400">
              {parse.error} (at character {parse.index + 1})
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
