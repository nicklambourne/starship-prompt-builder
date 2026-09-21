import { expandAll } from "@/lib/config/defaultFormat";
import { fromItems, toItems, type FormatItem } from "@/lib/config/formatItems";
import { moduleMeta, optionKind, type OptionKind } from "@/lib/config/meta";
import { optionEnum } from "@/lib/config/optionEnums";
import { moduleOptionsForConfig, type ModuleDefinition } from "@/lib/engine/modules";
import { DEFAULT_FORMAT, type StarshipConfig } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";

const HISTORY_LIMIT = 100;

export interface Timeline {
  config: StarshipConfig;
  baseline: StarshipConfig | null;
  past: StarshipConfig[];
  future: StarshipConfig[];
}

export interface CliOption {
  key: string;
  kind: OptionKind;
  defaultValue: unknown;
  value: unknown;
  overridden: boolean;
  choices?: { value: string; label: string }[];
}

export function createTimeline(config: StarshipConfig, saved = true): Timeline {
  return { config, baseline: saved ? config : null, past: [], future: [] };
}

export function changeConfig(timeline: Timeline, config: StarshipConfig): Timeline {
  if (config === timeline.config) return timeline;
  return {
    ...timeline,
    config,
    past: [...timeline.past, timeline.config].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function undoConfig(timeline: Timeline): Timeline {
  const previous = timeline.past.at(-1);
  if (!previous) return timeline;
  return {
    ...timeline,
    config: previous,
    past: timeline.past.slice(0, -1),
    future: [timeline.config, ...timeline.future].slice(0, HISTORY_LIMIT),
  };
}

export function redoConfig(timeline: Timeline): Timeline {
  const next = timeline.future[0];
  if (!next) return timeline;
  return {
    ...timeline,
    config: next,
    past: [...timeline.past, timeline.config].slice(-HISTORY_LIMIT),
    future: timeline.future.slice(1),
  };
}

export function markSaved(timeline: Timeline): Timeline {
  return { ...timeline, baseline: timeline.config };
}

export function isDirty(timeline: Timeline): boolean {
  return timeline.baseline === null
    || JSON.stringify(timeline.config) !== JSON.stringify(timeline.baseline);
}

export function editableFormatItems(config: StarshipConfig): FormatItem[] {
  const format = typeof config.format === "string" ? config.format : DEFAULT_FORMAT;
  const expanded = expandAll(format, PROMPT_ORDER);
  return toItems(expanded) ?? [{ kind: "raw", source: expanded }];
}

export function withFormatItems(
  config: StarshipConfig,
  items: FormatItem[],
): StarshipConfig {
  return { ...config, format: fromItems(items) };
}

export function optionsForModule(
  definition: ModuleDefinition,
  config: StarshipConfig,
): CliOption[] {
  const values = moduleOptionsForConfig(config, definition.name);
  const meta = moduleMeta(definition.name);
  return Object.entries(definition.defaults)
    .filter(([key]) => key !== "disabled")
    .map(([key, defaultValue]) => {
      const enumeration = optionEnum(definition.name, key);
      return {
        key,
        kind: enumeration ? "enum" : optionKind(definition.name, key, defaultValue, meta),
        defaultValue,
        value: Object.hasOwn(values, key) ? values[key] : defaultValue,
        overridden: Object.hasOwn(values, key),
        choices: enumeration?.choices,
      };
    });
}

export function displayValue(value: unknown, width = 42): string {
  let text: string;
  if (typeof value === "string") text = value.length === 0 ? "(empty)" : value;
  else if (value === undefined) text = "(unset)";
  else text = JSON.stringify(value);
  const characters = [...text];
  return characters.length <= width ? text : `${characters.slice(0, width - 1).join("")}…`;
}

export function parseEditedValue(kind: OptionKind, input: string): unknown {
  if (kind === "string" || kind === "format" || kind === "style" || kind === "enum") {
    return input;
  }
  if (kind === "number") {
    const value = Number(input);
    if (!Number.isFinite(value)) throw new Error("Enter a finite number.");
    return value;
  }
  if (kind === "boolean") {
    if (input === "true") return true;
    if (input === "false") return false;
    throw new Error("Enter true or false.");
  }
  try {
    return JSON.parse(input);
  } catch {
    throw new Error(`${kind === "array" ? "Arrays" : "Structured values"} must be valid JSON.`);
  }
}
