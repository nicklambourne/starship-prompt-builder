/**
 * A flat, editable view of a format string.
 *
 * The format grammar is a tree, but the thing people actually want to
 * manipulate is a sequence: this module goes here, that literal sits between
 * them, this part is purple. `toItems` flattens the top level of a parsed
 * format into that sequence and `fromItems` puts it back.
 *
 * Constructs the flat view cannot represent faithfully (conditionals, groups
 * mixing variables and text, anything nested) become `raw` items. They are
 * preserved verbatim and can be moved or deleted, just not restructured —
 * which keeps the visual editor lossless for configs it does not fully
 * understand, rather than silently rewriting them.
 */

import {
  type FormatElement,
  parseFormatString,
  printFormat,
} from "@/lib/engine/formatString";
import { spaceName } from "./unicodeSymbols";

export type FormatItem =
  | { kind: "module"; name: string; style?: string }
  /**
   * Literal text. `disabled` is written as starship's own `(…)` — a
   * conditional holding no variables renders nothing, verified against the
   * binary — so switching a piece off keeps it in the config rather than in
   * this app's memory, and it survives an export, a reload and a share link.
   */
  | { kind: "text"; value: string; style?: string; disabled?: boolean }
  /**
   * A starship text group holding several pieces. Grouping is what lets a run
   * of related modules — every VCS module, say — share one style, so it is a
   * real construct here rather than a UI-only convenience.
   */
  | { kind: "group"; items: FormatItem[]; style?: string }
  | { kind: "raw"; source: string };

/** Renders a text group's style elements back to a style string. */
function styleToString(
  style: { type: "text" | "variable"; value?: string; name?: string }[],
): string {
  return style
    .map((s) => (s.type === "text" ? (s.value ?? "") : `$${s.name}`))
    .join("");
}

function elementToItem(element: FormatElement): FormatItem {
  if (element.type === "variable") {
    return { kind: "module", name: element.name };
  }
  if (element.type === "text") {
    return { kind: "text", value: element.value };
  }
  if (element.type === "textGroup") {
    const style = styleToString(element.style);
    const inner = element.format;
    /*
     * A group wrapping exactly one variable is how a styled module is
     * written, so it reads back as one — but only when it carries a style.
     * `[$directory]()` styles nothing, so the wrapper exists for one reason
     * only: someone grouped it. Collapsing that case dissolved every group
     * the moment it was made, since a new group starts with one item.
     */
    if (inner.length === 1 && inner[0].type === "variable" && style !== "") {
      return { kind: "module", name: inner[0].name, style };
    }
    // A group of pure text is styled literal text.
    if (inner.length > 0 && inner.every((el) => el.type === "text")) {
      return {
        kind: "text",
        value: inner.map((el) => (el.type === "text" ? el.value : "")).join(""),
        style,
      };
    }
    // Anything else is a genuine group; recurse so its members stay editable.
    if (inner.length > 0 && !inner.some((el) => el.type === "conditional")) {
      return { kind: "group", items: inner.map(elementToItem), style };
    }
  }
  if (element.type === "conditional") {
    const inner = element.format;
    // A styled piece switched off is `([text](style))`, so ask the usual
    // conversion what the inside is rather than only matching bare text.
    if (inner.length === 1) {
      const only = elementToItem(inner[0]);
      if (only.kind === "text") return { ...only, disabled: true };
    }
    // Only a run of pure literal: a conditional with a variable in it is a
    // real conditional, and its author meant it.
    if (inner.length > 0 && inner.every((el) => el.type === "text")) {
      return {
        kind: "text",
        value: inner.map((el) => (el.type === "text" ? el.value : "")).join(""),
        disabled: true,
      };
    }
  }
  return { kind: "raw", source: printFormat([element]) };
}

export function toItems(format: string): FormatItem[] | null {
  try {
    return parseFormatString(format).map(elementToItem);
  } catch {
    return null;
  }
}

export function itemToSource(item: FormatItem): string {
  if (item.kind === "raw") return item.source;

  if (item.kind === "group") {
    /*
     * `[$a](bold)` is both "a group of one, styled bold" and "a bold module":
     * the format string cannot tell them apart, so a group of one can only
     * survive unstyled. When one is left holding a style — usually because a
     * group was emptied down to a single member — the style moves onto that
     * member, which renders the same and keeps it visible in the UI. A member
     * with its own style already overrides the group's, so it just keeps it.
     */
    if (item.items.length === 1 && item.style) {
      const only = item.items[0];
      if (only.kind !== "raw" && !only.style) {
        return itemToSource({ ...only, style: item.style });
      }
      return itemToSource(only);
    }
    return `[${item.items.map(itemToSource).join("")}](${item.style ?? ""})`;
  }

  if (item.kind === "module") {
    const variable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(item.name)
      ? `$${item.name}`
      : `\${${item.name}}`;
    return item.style ? `[${variable}](${item.style})` : variable;
  }

  const escaped = item.value.replace(/[[\]()\\$]/g, (ch) => `\\${ch}`);
  const styled = item.style ? `[${escaped}](${item.style})` : escaped;
  /*
   * Switched off: wrapped in a conditional holding no variables, which
   * starship renders as nothing — checked against the binary, not just
   * against this port. The text stays in the config, so it comes back with
   * the switch rather than living in a session somewhere.
   */
  return item.disabled ? `(${styled})` : styled;
}

export function fromItems(items: FormatItem[]): string {
  return items.map(itemToSource).join("");
}

/** Moves an item, returning a new array. Out-of-range moves are no-ops. */
export function moveItem(
  items: FormatItem[],
  index: number,
  direction: -1 | 1,
): FormatItem[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** A short human label for an item, used in the editor's rows. */
export function itemLabel(item: FormatItem): string {
  switch (item.kind) {
    case "module":
      return item.name === "all" ? "$all (every other module)" : `$${item.name}`;
    case "text":
      // Named as text so a lone separator glyph or a run of spaces is
      // identifiable as literal content rather than a module that failed to
      // render.
      if (item.value.trim().length > 0) return `Text "${item.value}"`;
      if (item.value.length === 0) return 'Text ""';
      /*
       * Named, not counted. A thin space and a space are both "whitespace" and
       * look identical in a row, but they are not interchangeable — the one
       * that makes a prompt read well is invisible, and being unable to tell
       * which one is in the format is how it gets lost.
       */
      const chars = [...item.value];
      const first = spaceName(chars[0]);
      const uniform = chars.every((char) => char === chars[0]);
      if (uniform && first) return `Text (${first} × ${chars.length})`;
      return `Text (whitespace × ${chars.length})`;
    case "group": {
      const modules = item.items.filter((i) => i.kind === "module").length;
      return `Group of ${item.items.length} (${modules} module${modules === 1 ? "" : "s"})`;
    }
    case "raw":
      return item.source;
  }
}

/**
 * Wraps a single item in a group of its own, ready to have things dragged in.
 */
export function groupItem(items: FormatItem[], index: number): FormatItem[] {
  const target = items[index];
  if (!target || target.kind === "group") return items;
  return items.map((item, i) =>
    i === index ? { kind: "group", items: [target] } : item,
  );
}

/**
 * Wraps a contiguous run of items in a group.
 *
 * Only contiguous runs are groupable: a format string is a sequence, so
 * bracketing non-adjacent pieces would silently reorder the prompt.
 */
export function groupRange(
  items: FormatItem[],
  start: number,
  end: number,
  style?: string,
): FormatItem[] {
  if (start < 0 || end >= items.length || start > end) return items;
  const inner = items.slice(start, end + 1);
  if (inner.length === 0) return items;
  return [
    ...items.slice(0, start),
    { kind: "group", items: inner, style },
    ...items.slice(end + 1),
  ];
}

/** Dissolves a group, splicing its members back into the sequence. */
export function ungroup(items: FormatItem[], index: number): FormatItem[] {
  const target = items[index];
  if (!target || target.kind !== "group") return items;
  return [...items.slice(0, index), ...target.items, ...items.slice(index + 1)];
}

/** Moves an item from one position to another, for drag-and-drop. */
export function reorderItem(
  items: FormatItem[],
  from: number,
  to: number,
): FormatItem[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const clamped = Math.max(0, Math.min(to, items.length - 1));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved);
  return next;
}

/**
 * Gathers every module of one category into a single group.
 *
 * Starship's canonical order interleaves categories — build tools sit
 * alphabetically among the languages — so grouping only contiguous runs
 * produces a scatter of tiny groups rather than "the languages, together".
 * This collects a category's modules, in their existing relative order, into
 * one group placed where the first of them appeared.
 *
 * It therefore DOES change prompt order, which is why it acts on one category
 * at a time and is always an explicit choice: gathering every category would
 * drag `character` away from the end of the prompt, where it must stay.
 * Non-module pieces and other categories are left exactly where they are.
 */
export function gatherCategory(
  items: FormatItem[],
  categoryOf: (moduleName: string) => string | undefined,
  category: string,
): FormatItem[] {
  const matches = items.filter(
    (item) => item.kind === "module" && categoryOf(item.name) === category,
  );
  if (matches.length < 2) return items;

  const firstIndex = items.findIndex(
    (item) => item.kind === "module" && categoryOf(item.name) === category,
  );

  const out: FormatItem[] = [];
  items.forEach((item, index) => {
    if (index === firstIndex) {
      out.push({ kind: "group", items: matches });
      return;
    }
    const isMatch =
      item.kind === "module" && categoryOf(item.name) === category;
    if (!isMatch) out.push(item);
  });
  return out;
}

/** Categories with at least two modules present, so grouping is meaningful. */
export function groupableCategories(
  items: FormatItem[],
  categoryOf: (moduleName: string) => string | undefined,
): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "module") continue;
    const category = categoryOf(item.name);
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([category]) => category);
}


/**
 * A display name for a group, inferred from what is inside it.
 *
 * Format strings cannot carry a label, so a name is never stored — it is
 * derived from the categories of the modules in the group, which keeps it
 * truthful as members are dragged in and out.
 */
export function groupName(
  item: Extract<FormatItem, { kind: "group" }>,
  categoryOf: (moduleName: string) => string | undefined,
): string {
  const categories = new Set<string>();
  let modules = 0;
  for (const child of item.items) {
    if (child.kind !== "module") continue;
    modules += 1;
    const category = categoryOf(child.name);
    if (category) categories.add(category);
  }
  if (modules === 0) return "Group";
  if (categories.size === 1) return [...categories][0];
  if (categories.size === 0) return "Group";
  return "Mixed group";
}

/** Where a dragged item lands relative to the row it was dropped on. */
export type DropPosition = "before" | "after" | "into";

/**
 * Applies a drag. `into` appends to an existing group, or pairs two loose
 * items into a new one — dropping something onto something else is the most
 * direct way to say "these belong together".
 */
export function applyDrop(
  items: FormatItem[],
  from: number,
  to: number,
  position: DropPosition,
): FormatItem[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items;
  }

  const dragged = items[from];
  const target = items[to];

  if (position === "into") {
    const merged: FormatItem =
      target.kind === "group"
        ? { ...target, items: [...target.items, dragged] }
        : { kind: "group", items: [target, dragged] };
    return items
      .map((item, index) => (index === to ? merged : item))
      .filter((_, index) => index !== from);
  }

  const withoutDragged = items.filter((_, index) => index !== from);
  // Removing the dragged item shifts every later index down by one.
  const adjusted = from < to ? to - 1 : to;
  const insertAt = position === "before" ? adjusted : adjusted + 1;
  return [
    ...withoutDragged.slice(0, insertAt),
    dragged,
    ...withoutDragged.slice(insertAt),
  ];
}
