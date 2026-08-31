"use client";

/**
 * Drag coordination for a structured format tree.
 *
 * Pointer capture and hit-testing live in usePointerDrag. This layer translates
 * visible compact rows back to their preserved wrapper paths, commits the tree
 * move, and exposes the transient row state FormatNode needs to paint.
 */

import { useEffect, useRef, useState } from "react";

import { usePointerDrag } from "./usePointerDrag";
import {
  type DropPosition,
  type FormatItem,
  isRedundantStyleWrapper,
} from "@/lib/config/formatItems";
import {
  type Path,
  getAt,
  moveTo,
  pathKey,
} from "@/lib/config/formatTree";

interface FormatTreeDragOptions {
  items: FormatItem[] | null;
  showAllStyleWrappers: boolean;
  commit(items: FormatItem[]): void;
}

export function useFormatTreeDrag({
  items,
  showAllStyleWrappers,
  commit,
}: FormatTreeDragOptions) {
  const [dragging, setDragging] = useState<Path | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    path: Path;
    position: DropPosition;
  } | null>(null);

  // Handlers installed for the lifetime of a pointer gesture need the latest
  // tree even after a render occurs while that gesture is active.
  const itemsRef = useRef(items ?? []);
  useEffect(() => {
    itemsRef.current = items ?? [];
  }, [items]);

  // A compact row moves with its hidden wrappers. Dropping into the row still
  // addresses the visible child, so edits reach the intended group.
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

  const startPointerDrag = usePointerDrag({
    onDragStart: (path) => {
      setDragging(path);
      setDropTarget(null);
    },
    onDragOver: (path, position) => setDropTarget({ path, position }),
    onDrop: (from, to, position) => {
      commit(
        moveTo(
          itemsRef.current,
          movePath(from),
          position === "into" ? to : movePath(to),
          position,
        ),
      );
      setDragging(null);
      setDropTarget(null);
    },
    onCancel: () => setDropTarget(null),
  });

  return {
    movePath,
    startPointerDrag,
    dropPositionFor: (path: Path) =>
      dropTarget && pathKey(dropTarget.path) === pathKey(path)
        ? dropTarget.position
        : null,
    isDragging: (path: Path) =>
      dragging !== null && pathKey(dragging) === pathKey(path),
  };
}
