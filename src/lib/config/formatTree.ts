/**
 * Path-addressed edits over a nested format.
 *
 * Once groups can contain groups, a flat index is no longer enough to name a
 * piece — `[3, 1]` is "the second child of the fourth item". Every editing
 * operation therefore takes a path, which is what lets a piece be dragged
 * between nesting levels rather than only within its own list.
 */

import type { DropPosition, FormatItem } from "./formatItems";

export type Path = number[];

export function pathKey(path: Path): string {
  return path.join(".");
}

function isSamePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Whether `maybeAncestor` is a prefix of `path` — i.e. contains it. */
export function isAncestor(maybeAncestor: Path, path: Path): boolean {
  return (
    maybeAncestor.length < path.length &&
    maybeAncestor.every((value, index) => value === path[index])
  );
}

export function getAt(items: FormatItem[], path: Path): FormatItem | undefined {
  if (path.length === 0) return undefined;
  const [head, ...rest] = path;
  const item = items[head];
  if (!item) return undefined;
  if (rest.length === 0) return item;
  return item.kind === "group" ? getAt(item.items, rest) : undefined;
}

/** Replaces the item at `path`; returning null from `updater` removes it. */
export function updateAt(
  items: FormatItem[],
  path: Path,
  updater: (item: FormatItem) => FormatItem | null,
): FormatItem[] {
  if (path.length === 0) return items;
  const [head, ...rest] = path;
  const item = items[head];
  if (!item) return items;

  if (rest.length === 0) {
    const next = updater(item);
    if (next === null) return items.filter((_, index) => index !== head);
    return items.map((existing, index) => (index === head ? next : existing));
  }

  if (item.kind !== "group") return items;
  const children = updateAt(item.items, rest, updater);
  // A group emptied by an edit would serialise to `[]()`, which renders
  // nothing but lingers in the format string, so drop it.
  if (children.length === 0) return items.filter((_, index) => index !== head);
  return items.map((existing, index) =>
    index === head ? { ...item, items: children } : existing,
  );
}

export function removeAt(items: FormatItem[], path: Path): FormatItem[] {
  return updateAt(items, path, () => null);
}

/** Inserts `item` at `path`, shifting whatever is there along. */
export function insertAt(
  items: FormatItem[],
  path: Path,
  item: FormatItem,
): FormatItem[] {
  if (path.length === 0) return items;
  const [head, ...rest] = path;

  if (rest.length === 0) {
    const index = Math.max(0, Math.min(head, items.length));
    return [...items.slice(0, index), item, ...items.slice(index)];
  }

  const parent = items[head];
  if (!parent || parent.kind !== "group") return items;
  return items.map((existing, index) =>
    index === head
      ? { ...parent, items: insertAt(parent.items, rest, item) }
      : existing,
  );
}

/** Appends into the group at `path`. */
export function appendInto(
  items: FormatItem[],
  path: Path,
  item: FormatItem,
): FormatItem[] {
  return updateAt(items, path, (target) =>
    target.kind === "group"
      ? { ...target, items: [...target.items, item] }
      : { kind: "group", items: [target, item] },
  );
}

/**
 * Rewrites a destination path to account for a removal that happened first.
 *
 * Removing an item shifts its later siblings down by one, so a destination
 * that sits after the removed item in the same list — or inside one of those
 * later siblings — must be decremented at exactly that depth.
 */
export function adjustAfterRemoval(target: Path, removed: Path): Path {
  const depth = removed.length - 1;
  if (target.length <= depth) return target;
  const sharesParent = removed
    .slice(0, depth)
    .every((value, index) => value === target[index]);
  if (!sharesParent) return target;
  if (target[depth] > removed[depth]) {
    const next = [...target];
    next[depth] -= 1;
    return next;
  }
  return target;
}

/**
 * Moves the piece at `from` relative to the piece at `to`.
 *
 * Dropping a piece into its own descendant would detach the subtree from the
 * document, so that case is refused rather than corrupting the format.
 */
export function moveTo(
  items: FormatItem[],
  from: Path,
  to: Path,
  position: DropPosition,
): FormatItem[] {
  if (from.length === 0 || to.length === 0) return items;
  if (isSamePath(from, to) || isAncestor(from, to)) return items;

  const dragged = getAt(items, from);
  if (!dragged || !getAt(items, to)) return items;

  // Removing the last child also removes its empty ancestors. Account for
  // that whole branch when locating the destination, or a one-variable
  // conditional can be dropped from the format instead of moved.
  let removedPath = from;
  while (removedPath.length > 1) {
    const parentPath = removedPath.slice(0, -1);
    const parent = getAt(items, parentPath);
    if (parent?.kind !== "group" || parent.items.length !== 1) break;
    removedPath = parentPath;
  }
  if (isSamePath(to, removedPath) || isAncestor(removedPath, to)) return items;

  const without = removeAt(items, from);
  const destination = adjustAfterRemoval(to, removedPath);

  if (position === "into") {
    return appendInto(without, destination, dragged);
  }

  const insertPath = [...destination];
  if (position === "after") insertPath[insertPath.length - 1] += 1;
  return insertAt(without, insertPath, dragged);
}

/** Moves a piece one step within its own parent, for keyboard reordering. */
export function nudge(
  items: FormatItem[],
  path: Path,
  direction: -1 | 1,
): FormatItem[] {
  const target = [...path];
  const last = target.length - 1;
  const next = target[last] + direction;
  if (next < 0) return items;
  target[last] = next;
  return moveTo(items, path, target, direction === -1 ? "before" : "after");
}

/** Every module name appearing anywhere in the tree. */
export function collectModuleNames(items: FormatItem[]): string[] {
  const out: string[] = [];
  const walk = (list: FormatItem[]) => {
    for (const item of list) {
      if (item.kind === "module") out.push(item.name);
      else if (item.kind === "group") walk(item.items);
    }
  };
  walk(items);
  return out;
}
