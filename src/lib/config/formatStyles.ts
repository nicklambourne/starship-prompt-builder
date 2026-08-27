import { tryParseFormatString } from "@/lib/engine/formatString";
import type { ModuleDefinition } from "@/lib/engine/modules/types";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";
import { moduleOptionsForConfig } from "@/lib/engine/modules";
import type { FormatItem } from "./formatItems";
import type { Path } from "./formatTree";

export type FormatStyleVariables = Record<string, string | undefined>;

/** Use the same evaluated style bindings as the prompt, including stateful styles. */
export function moduleFormatStyles(
  definition: ModuleDefinition,
  config: StarshipConfig,
  scenario: Scenario,
): FormatStyleVariables {
  const options = { ...definition.defaults, ...moduleOptionsForConfig(config, definition.name) };
  const base = { style: typeof options.style === "string" ? options.style : undefined };
  try {
    return { ...base, ...definition.evaluate(options, { scenario, rootConfig: config })?.styleVariables };
  } catch {
    // The preview reports evaluation errors; the editor must remain usable.
    return base;
  }
}

/** Resolve style references for display only; never replace them in the config. */
export function resolveFormatStyle(source: string, variables: FormatStyleVariables): string {
  const parsed = tryParseFormatString(`[x](${source})`);
  const group = parsed.ok ? parsed.elements[0] : undefined;
  if (group?.type !== "textGroup") return source;
  return group.style.map((part) => part.type === "text" ? part.value : (variables[part.name] ?? "")).join("");
}

/** Bare children use the closest group; an explicit empty group resets style. */
export function formatItemStyleSource(
  items: FormatItem[],
  path: Path,
): string | undefined {
  let source: string | undefined;
  let children = items;
  for (const index of path) {
    const item = children[index];
    if (!item || item.kind === "raw") return undefined;
    if (item.kind === "group") {
      if (item.style !== undefined || item.conditional === undefined) source = item.style ?? "";
      children = item.items;
    } else if (item.style !== undefined) {
      source = item.style;
    }
  }
  return source;
}

export function formatItemStyle(
  items: FormatItem[],
  path: Path,
  variables: FormatStyleVariables = {},
): string | undefined {
  const source = formatItemStyleSource(items, path);
  return source === undefined ? undefined : resolveFormatStyle(source, variables);
}
