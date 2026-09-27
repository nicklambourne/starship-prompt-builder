import { fromItems, itemLabel, toItems, type FormatItem } from "@/lib/config/formatItems";
import {
  getAt,
  insertAt,
  moveTo,
  nudge,
  pathKey,
  removeAt,
  updateAt,
  type Path,
} from "@/lib/config/formatTree";
import { expandAll } from "@/lib/config/defaultFormat";
import { DEFAULT_FORMAT, type StarshipConfig } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";

export type FormatSide = "left" | "right";

export interface FormatRow {
  item: FormatItem;
  path: Path;
  depth: number;
  label: string;
}

export function formatItems(config: StarshipConfig, side: FormatSide): FormatItem[] {
  const source = side === "left"
    ? (typeof config.format === "string" ? config.format : DEFAULT_FORMAT)
    : (typeof config.right_format === "string" ? config.right_format : "");
  const expanded = side === "left" ? expandAll(source, PROMPT_ORDER) : source;
  return toItems(expanded) ?? [{ kind: "raw", source: expanded }];
}

export function setFormatItems(config: StarshipConfig, side: FormatSide, items: FormatItem[]): StarshipConfig {
  return { ...config, [side === "left" ? "format" : "right_format"]: fromItems(items) };
}

export function flattenFormat(items: FormatItem[], collapsed: ReadonlySet<string> = new Set()): FormatRow[] {
  const rows: FormatRow[] = [];
  const visit = (children: FormatItem[], parent: Path) => {
    children.forEach((item, index) => {
      const path = [...parent, index];
      const depth = parent.length;
      rows.push({ item, path, depth, label: `${"  ".repeat(depth)}${item.kind === "group" ? collapsed.has(pathKey(path)) ? "▸ " : "▾ " : ""}${itemLabel(item)}` });
      if (item.kind === "group" && !collapsed.has(pathKey(path))) visit(item.items, path);
    });
  };
  visit(items, []);
  return rows;
}

export function wrapInGroup(items: FormatItem[], path: Path): FormatItem[] {
  return updateAt(items, path, (item) => ({ kind: "group", items: [item] }));
}

export function dissolveGroup(items: FormatItem[], path: Path): FormatItem[] {
  const group = getAt(items, path);
  if (group?.kind !== "group") return items;
  let next = removeAt(items, path);
  group.items.forEach((item, offset) => {
    next = insertAt(next, [...path.slice(0, -1), path[path.length - 1] + offset], item);
  });
  return next;
}

export function duplicateItem(items: FormatItem[], path: Path): FormatItem[] {
  const item = getAt(items, path);
  return item ? insertAt(items, [...path.slice(0, -1), path[path.length - 1] + 1], item) : items;
}

export function indentItem(items: FormatItem[], path: Path): FormatItem[] {
  const previous = [...path.slice(0, -1), path[path.length - 1] - 1];
  if (path[path.length - 1] <= 0 || getAt(items, previous)?.kind !== "group") return items;
  return moveTo(items, path, previous, "into");
}

export function outdentItem(items: FormatItem[], path: Path): FormatItem[] {
  if (path.length < 2) return items;
  const item = getAt(items, path);
  if (!item) return items;
  const parentPath = path.slice(0, -1);
  const without = removeAt(items, path);
  const insertPath = [...parentPath];
  if (getAt(without, parentPath)) insertPath[insertPath.length - 1] += 1;
  return insertAt(without, insertPath, item);
}

export function moveSibling(items: FormatItem[], path: Path, direction: -1 | 1): FormatItem[] {
  return nudge(items, path, direction);
}
