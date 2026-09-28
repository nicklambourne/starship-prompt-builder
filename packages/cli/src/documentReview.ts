import type { StarshipConfig } from "@/lib/engine/prompt";

function isTable(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Human-readable semantic changes; unknown config tables are included too. */
export function changedPaths(before: StarshipConfig, after: StarshipConfig): string[] {
  const changes: string[] = [];
  function visit(left: unknown, right: unknown, path: string) {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (isTable(left) && isTable(right)) {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        visit(left[key], right[key], path ? `${path}.${key}` : key);
      }
      return;
    }
    changes.push(path || "(root)");
  }
  visit(before, after, "");
  return changes;
}

/** Values for a compact agent review; the complete file remains in reviewLines. */
export function changedValues(before: StarshipConfig, after: StarshipConfig): Array<{ path: string; before?: unknown; after?: unknown }> {
  const changes: Array<{ path: string; before?: unknown; after?: unknown }> = [];
  function visit(left: unknown, right: unknown, path: string) {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (isTable(left) && isTable(right)) {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        visit(left[key], right[key], path ? `${path}.${key}` : key);
      }
    } else {
      changes.push({ path: path || "(root)", before: left, after: right });
    }
  }
  visit(before, after, "");
  return changes;
}

/** Exact old and proposed file bodies with visible line prefixes. */
export function reviewLines(before: string | null, after: string, proposedLabel = "proposed file (regenerated TOML)"): string[] {
  if (before === after) return ["No file changes. The original bytes will be kept."];
  const lines = [`--- ${before === null ? "(new file)" : "current file"}`, `+++ ${proposedLabel}`];
  const append = (content: string, marker: string) => {
    const split = content.split("\n");
    if (content.endsWith("\n")) split.pop();
    for (const line of split) lines.push(`${marker} ${line.replace(/\r/g, "␍").replace(/\t/g, "⇥").replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "?")}`);
    if (!content.endsWith("\n")) lines.push(`${marker} [no final newline]`);
  };
  if (before !== null) append(before, "-");
  append(after, "+");
  return lines;
}
