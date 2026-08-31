/**
 * Format renderer: walks a parsed format tree and produces styled segments.
 *
 * Port of starship's `StringFormatter::parse` (`src/formatter/string_formatter.rs`).
 * Behaviours that are easy to get wrong, and are therefore deliberate here:
 *
 *  - A text group's style REPLACES the inherited style; it does not merge.
 *  - An empty text group `[]( )` still emits an empty segment, so that a later
 *    `prev_fg`/`prev_bg` can chain off its style.
 *  - Styled variable values keep their own segment styles, inheriting the
 *    surrounding style only where a segment has none.
 *  - A conditional renders when ANY variable in its format positions is
 *    non-empty; unknown variables count as empty.
 *  - Style variables are concatenated as text and then parsed as one style
 *    string, so `[x]($style bold)` works.
 */

import {
  type FormatElement,
  type StyleElement,
  collectVariables,
  parseFormatString,
} from "./formatString";
import { type Palette, parseStyleString } from "./styleString";
import { type Segment, type Style, cloneStyle } from "./types";

/**
 * The value a variable resolves to.
 *
 *  - `plain`: a bare string.
 *  - `styled`: pre-rendered segments (used for whole modules).
 *  - `meta`: a nested format string, re-rendered in the current variable scope
 *    (used by `$all` and by module `format` options).
 *  - `undefined` entry: the variable is known but empty — renders to nothing
 *    and does not satisfy a conditional.
 */
export type VariableValue =
  | { type: "plain"; value: string }
  | { type: "styled"; segments: Segment[] }
  | { type: "meta"; format: FormatElement[] };

export type VariableMap = Map<string, VariableValue | undefined>;
/** Style variables resolve to raw style-string fragments, e.g. `$style`. */
type StyleVariableMap = Map<string, string | undefined>;

export interface RenderContext {
  variables: VariableMap;
  styleVariables: StyleVariableMap;
  palette?: Palette;
}

function isVariableValueEmpty(value: VariableValue | undefined): boolean {
  if (!value) return true;
  switch (value.type) {
    case "plain":
      return value.value.length === 0;
    case "styled":
      return !value.segments.some(
        (s) => (s.kind === "text" || s.kind === "fill") && s.value.length > 0,
      );
    case "meta":
      // Meta values are non-empty when the format they hold would render.
      return false;
  }
}

/**
 * Whether a conditional group should render.
 *
 * Mirrors `should_show_elements`: any variable in a format position being
 * non-empty is enough. Meta variables recurse into their own format.
 */
function shouldShow(elements: FormatElement[], ctx: RenderContext, depth = 0): boolean {
  if (depth > 16) return false;
  const names = collectVariables(elements);
  return names.some((name) => {
    if (!ctx.variables.has(name)) return false;
    const value = ctx.variables.get(name);
    if (!value) return false;
    if (value.type === "meta") {
      // Meta variables are checked against their inner format, with meta
      // values stripped to prevent unbounded recursion.
      const inner: RenderContext = {
        ...ctx,
        variables: cloneWithoutMeta(ctx.variables),
      };
      return shouldShow(value.format, inner, depth + 1);
    }
    return !isVariableValueEmpty(value);
  });
}

function cloneWithoutMeta(variables: VariableMap): VariableMap {
  const out: VariableMap = new Map();
  for (const [key, value] of variables) {
    if (value?.type === "meta") out.set(key, undefined);
    else out.set(key, value);
  }
  return out;
}

/** Resolves a text group's style elements into a concrete style. */
function resolveStyle(
  elements: StyleElement[],
  ctx: RenderContext,
): Style | undefined {
  const styleString = elements
    .map((el) =>
      el.type === "text" ? el.value : (ctx.styleVariables.get(el.name) ?? ""),
    )
    .join("");
  return parseStyleString(styleString, ctx.palette);
}

function renderElements(
  elements: FormatElement[],
  style: Style | undefined,
  ctx: RenderContext,
  depth: number,
): Segment[] {
  if (depth > 32) return [];

  const out: Segment[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "text": {
        if (el.value.length > 0) {
          out.push({ kind: "text", value: el.value, style: style && cloneStyle(style) });
        }
        break;
      }

      case "textGroup": {
        const groupStyle = resolveStyle(el.style, ctx);
        if (el.format.length === 0) {
          // Preserved so `prev_fg`/`prev_bg` can reference this style later.
          out.push({ kind: "text", value: "", style: groupStyle && cloneStyle(groupStyle) });
          break;
        }
        out.push(...renderElements(el.format, groupStyle, ctx, depth + 1));
        break;
      }

      case "conditional": {
        if (shouldShow(el.format, ctx)) {
          out.push(...renderElements(el.format, style, ctx, depth + 1));
        }
        break;
      }

      case "variable": {
        const value = ctx.variables.get(el.name);
        if (!value) break;

        if (value.type === "plain") {
          if (value.value.length > 0) {
            out.push({
              kind: "text",
              value: value.value,
              style: style && cloneStyle(style),
            });
          }
        } else if (value.type === "styled") {
          for (const segment of value.segments) {
            if (segment.kind === "lineTerm") {
              out.push(segment);
            } else if (segment.style === undefined && style) {
              out.push({ ...segment, style: cloneStyle(style) });
            } else {
              out.push(segment);
            }
          }
        } else {
          const inner: RenderContext = {
            ...ctx,
            variables: cloneWithoutMeta(ctx.variables),
          };
          out.push(...renderElements(value.format, style, inner, depth + 1));
        }
        break;
      }
    }
  }

  return out;
}

/** Renders a parsed format tree into segments. */
export function renderFormat(
  elements: FormatElement[],
  ctx: RenderContext,
  baseStyle?: Style,
): Segment[] {
  return renderElements(elements, baseStyle, ctx, 0);
}

/** Convenience: parse and render in one step. Throws on malformed input. */
export function renderFormatString(
  format: string,
  ctx: RenderContext,
  baseStyle?: Style,
): Segment[] {
  return renderFormat(parseFormatString(format), ctx, baseStyle);
}
