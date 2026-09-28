import React, { Children, type ComponentProps } from "react";
import { Text as InkText } from "ink";
import type { Segment } from "@/lib/engine/types";

/** Literal user text never supplies terminal control bytes; styling stays structured. */
export function safeTerminalText(value: string, multiline = false): string {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, (char) => multiline && char === "\n" ? "\n" : "?");
}

export function safeSegments(segments: Segment[]): Segment[] {
  return segments.map((segment) => segment.kind === "lineTerm" ? segment :
    { ...segment, value: safeTerminalText(segment.value, true) });
}

/** Drop-in Ink boundary: every dynamic text leaf passes here before Ink styles it. */
export function Text({ children, ...props }: ComponentProps<typeof InkText>) {
  return <InkText {...props}>{Children.map(children, (child) => typeof child === "string" ? safeTerminalText(child, true) : child)}</InkText>;
}
