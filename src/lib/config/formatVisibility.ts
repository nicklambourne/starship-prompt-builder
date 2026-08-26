import { collectVariables, parseFormatString } from "@/lib/engine/formatString";
import type { ModuleDefinition } from "@/lib/engine/modules/types";
import type { StarshipConfig } from "@/lib/engine/prompt";
import { renderFormat, type VariableMap } from "@/lib/engine/render";
import type { Scenario } from "@/lib/scenarios/types";
import { fromItems, type FormatItem } from "./formatItems";
import { getAt, type Path } from "./formatTree";

/** Bind the same plain/pre-styled values that the module's formatter sees. */
export function moduleFormatVariables(
  definition: ModuleDefinition,
  config: StarshipConfig,
  scenario: Scenario,
): VariableMap | undefined {
  const options = { ...definition.defaults, ...(config[definition.name] as Record<string, unknown>) };
  try {
    const result = definition.evaluate(options, { scenario, rootConfig: config });
    const variables: VariableMap = new Map();
    for (const [name, value] of Object.entries(result?.variables ?? {})) {
      variables.set(name, typeof value === "string"
        ? { type: "plain", value }
        : value && { type: "styled", segments: value.segments });
    }
    return variables;
  } catch {
    // Unknown, not hidden: the preview reports evaluation failures separately.
    return undefined;
  }
}

/** Ask the real formatter's visibility predicate, not a second approximation. */
export function conditionalIsVisible(items: FormatItem[], variables: VariableMap): boolean {
  const names = collectVariables(parseFormatString(fromItems(items)));
  const marker = "\u0000";
  return renderFormat([{ type: "conditional", format: [
    ...names.map(name => ({ type: "variable" as const, name })),
    { type: "text", value: marker },
  ] }], { variables, styleVariables: new Map() })
    .some(segment => segment.kind === "text" && segment.value === marker);
}

/** A nested section is hidden if its own condition or any ancestor is empty. */
export function groupVisibility(
  items: FormatItem[],
  path: Path,
  variables?: VariableMap,
): boolean | undefined {
  if (!variables) return undefined;
  for (let depth = 1; depth <= path.length; depth++) {
    const item = getAt(items, path.slice(0, depth));
    if (item?.kind === "group" && item.conditional && !conditionalIsVisible(item.items, variables)) return false;
  }
  return true;
}
