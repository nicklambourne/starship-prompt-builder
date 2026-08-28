/**
 * Prompt assembly: turns a whole config plus a scenario into rendered lines.
 *
 * This is the layer above `render.ts`. It resolves the root `format` (and
 * `right_format`), expands `$all`, evaluates each module into segments, and
 * finally distributes `fill` segments across the terminal width — mirroring
 * starship's `print::get_prompt` and `module::ansi_line`.
 */

import { collectVariables, parseFormatString } from "./formatString";
import { moduleOptionsForConfig, NAMED_MODULE_KINDS } from "./modules";
import { type ModuleDefinition } from "./modules/types";
import { type RenderContext, type VariableValue, renderFormat } from "./render";
import { type Palette, parseStyleString, resolvePalette } from "./styleString";
import { type Segment, type Style } from "./types";
import type { Scenario } from "@/lib/scenarios/types";
import { selectedVcsFormat } from "./modules/vcs";

export interface StarshipConfig {
  format?: string;
  right_format?: string;
  add_newline?: boolean;
  palette?: string;
  palettes?: Record<string, Palette>;
  /** Per-module option tables, keyed by module name. */
  [key: string]: unknown;
}

export interface RenderedPrompt {
  /** Left prompt lines; each line is a list of segments with fills resolved. */
  lines: Segment[][];
  /** Right prompt segments, when `right_format` is set. */
  right: Segment[];
  /** Whether a blank line precedes the prompt (`add_newline`). */
  leadingNewline: boolean;
  /** Non-fatal problems worth surfacing in the UI. */
  warnings: string[];
}

/**
 * Default root format. Starship's own default is `$all`, which expands to
 * every module in its canonical order.
 */
export const DEFAULT_FORMAT = "$all";

function moduleOptions(config: StarshipConfig, name: string): Record<string, unknown> {
  return moduleOptionsForConfig(config, name);
}

export function isModuleDisabled(
  config: StarshipConfig,
  definition: ModuleDefinition,
): boolean {
  const options = moduleOptions(config, definition.name);
  const explicit = options.disabled;
  if (typeof explicit === "boolean") return explicit;
  return definition.defaults.disabled;
}

/**
 * Evaluates one module to segments.
 *
 * The module's own `format` is rendered in a variable scope built from the
 * variables the module returned, with `$style` bound to its `style` option.
 */
function renderModule(
  definition: ModuleDefinition,
  config: StarshipConfig,
  scenario: Scenario,
  palette: Palette | undefined,
  warnings: string[],
): Segment[] {
  const options = { ...definition.defaults, ...moduleOptions(config, definition.name) };

  let result: ReturnType<ModuleDefinition["evaluate"]>;
  try {
    result = definition.evaluate(options, { scenario, rootConfig: config });
  } catch (err) {
    warnings.push(
      `Module ${definition.name} failed to evaluate: ${(err as Error).message}`,
    );
    return [];
  }
  if (!result) return [];

  const variables: RenderContext["variables"] = new Map();
  for (const [key, value] of Object.entries(result.variables)) {
    if (value === undefined) {
      variables.set(key, undefined);
    } else if (typeof value === "string") {
      variables.set(key, value.length > 0 ? { type: "plain", value } : undefined);
    } else {
      variables.set(key, { type: "styled", segments: value.segments });
    }
  }

  const styleVariables: RenderContext["styleVariables"] = new Map();
  const styleOption = options.style;
  styleVariables.set("style", typeof styleOption === "string" ? styleOption : "");
  for (const [key, value] of Object.entries(result.styleVariables ?? {})) {
    styleVariables.set(key, value);
  }

  const formatOption = options.format;
  const format = typeof formatOption === "string" ? formatOption : "";

  try {
    return renderFormat(parseFormatString(format), { variables, styleVariables, palette });
  } catch (err) {
    warnings.push(
      `Module ${definition.name} has an invalid format string: ${(err as Error).message}`,
    );
    return [];
  }
}

/**
 * Splits segments into lines at `lineTerm` boundaries, then resolves `fill`
 * segments by distributing the unused width evenly between them.
 *
 * Mirrors starship's `ansi_line`: fill width is integer-divided between the
 * chunks on a line, and each fill repeats its value (cycled) up to that width.
 */
export function assembleLines(segments: Segment[], terminalWidth: number): Segment[][] {
  const lines: Segment[][] = [];
  let current: Segment[] = [];

  for (const segment of segments) {
    if (segment.kind === "lineTerm") {
      lines.push(current);
      current = [];
    } else {
      current.push(segment);
    }
  }
  lines.push(current);

  return lines.map((line) => resolveFills(line, terminalWidth));
}

function displayWidth(segments: Segment[]): number {
  let width = 0;
  for (const segment of segments) {
    if (segment.kind === "text") width += [...segment.value].length;
  }
  return width;
}

function resolveFills(line: Segment[], terminalWidth: number): Segment[] {
  const fillCount = line.filter((s) => s.kind === "fill").length;
  if (fillCount === 0) return line;

  const used = displayWidth(line);
  const remaining = terminalWidth > used ? terminalWidth - used : 0;
  const perFill = Math.floor(remaining / fillCount);

  return line.map((segment) => {
    if (segment.kind !== "fill") return segment;
    const unit = segment.value.length > 0 ? segment.value : " ";
    let value = "";
    while ([...value].length < perFill) value += unit;
    // Cycling can overshoot on multi-character fills; trim to the exact width.
    value = [...value].slice(0, perFill).join("");
    return { kind: "text", value, style: segment.style };
  });
}

export interface RenderPromptOptions {
  config: StarshipConfig;
  scenario: Scenario;
  modules: ModuleDefinition[];
  /** Canonical module order used to expand `$all`. */
  defaultOrder: string[];
}

export function renderPrompt({
  config,
  scenario,
  modules,
  defaultOrder,
}: RenderPromptOptions): RenderedPrompt {
  const warnings: string[] = [];
  const palette = resolvePalette(config.palettes, config.palette);
  if (config.palette && !palette) {
    warnings.push(`Palette "${config.palette}" is not defined in [palettes].`);
  }

  const byName = new Map(modules.map((m) => [m.name, m]));
  const format = typeof config.format === "string" ? config.format : DEFAULT_FORMAT;

  let rootElements;
  try {
    rootElements = parseFormatString(format);
  } catch (err) {
    warnings.push(`Invalid root format: ${(err as Error).message}`);
    rootElements = parseFormatString(DEFAULT_FORMAT);
  }

  // Modules named explicitly anywhere in the root format are excluded from
  // `$all`, matching starship's `all_modules_uniq`.
  const explicit = new Set(collectRootModuleNames(format, warnings));

  const segmentCache = new Map<string, Segment[]>();
  const active = new Set<string>();
  const renderDefinition = (name: string): Segment[] => {
    const definition = byName.get(name);
    if (!definition || isModuleDisabled(config, definition)) return [];
    return renderModule(definition, config, scenario, palette, warnings);
  };
  const evaluateModule = (name: string): Segment[] => {
    const cached = segmentCache.get(name);
    if (cached) return cached;

    if (active.has(name)) return [];
    active.add(name);

    if (name === "vcs") {
      const definition = byName.get(name);
      if (!definition || isModuleDisabled(config, definition)) {
        active.delete(name);
        return [];
      }
      const options = { ...definition.defaults, ...moduleOptions(config, name) };
      const selected = selectedVcsFormat(options, scenario);
      if (!selected) {
        active.delete(name);
        segmentCache.set(name, []);
        return [];
      }
      try {
        const elements = parseFormatString(selected);
        const referenced = collectVariables(elements);
        if (referenced.includes("vcs")) {
          warnings.push("Module vcs cannot include $vcs in its module list.");
          active.delete(name);
          segmentCache.set(name, []);
          return [];
        }
        const variables: RenderContext["variables"] = new Map();
        for (const reference of referenced) {
          const segments = evaluateModule(reference);
          variables.set(reference, segments.length > 0 ? { type: "styled", segments } : undefined);
        }
        const rendered = renderFormat(elements, {
          variables,
          styleVariables: new Map(),
          palette,
        });
        segmentCache.set(name, rendered);
        active.delete(name);
        return rendered;
      } catch (err) {
        warnings.push(`Module vcs has an invalid module list: ${(err as Error).message}`);
        active.delete(name);
        segmentCache.set(name, []);
        return [];
      }
    }

    let rendered = renderDefinition(name);
    if (NAMED_MODULE_KINDS.some((kind) => kind === name)) {
      const prefix = `${name}.`;
      rendered = [
        ...rendered,
        ...modules
          .filter((definition) =>
            definition.name.startsWith(prefix) && !explicit.has(definition.name)
          )
          .flatMap((definition) => renderDefinition(definition.name)),
      ];
    }
    segmentCache.set(name, rendered);
    active.delete(name);
    return rendered;
  };

  const buildVariables = (): RenderContext["variables"] => {
    const variables: RenderContext["variables"] = new Map();

    for (const definition of modules) {
      const segments = evaluateModule(definition.name);
      variables.set(
        definition.name,
        segments.length > 0 ? { type: "styled", segments } : undefined,
      );
    }

    const allSegments: Segment[] = [];
    for (const name of defaultOrder) {
      if (explicit.has(name)) continue;
      allSegments.push(...evaluateModule(name));
    }
    const all: VariableValue | undefined =
      allSegments.length > 0 ? { type: "styled", segments: allSegments } : undefined;
    variables.set("all", all);

    return variables;
  };

  const ctx: RenderContext = {
    variables: buildVariables(),
    styleVariables: new Map(),
    palette,
  };

  const leftSegments = renderFormat(rootElements, ctx);
  const lines = assembleLines(leftSegments, scenario.terminalWidth);

  let right: Segment[] = [];
  if (typeof config.right_format === "string" && config.right_format.length > 0) {
    try {
      right = renderFormat(parseFormatString(config.right_format), ctx);
    } catch (err) {
      warnings.push(`Invalid right_format: ${(err as Error).message}`);
    }
  }

  return {
    lines,
    right,
    leadingNewline: config.add_newline !== false,
    warnings,
  };
}

/**
 * Module names referenced directly by the root format, so `$all` can skip
 * them. Style positions are ignored, as they never name modules.
 */
function collectRootModuleNames(format: string, warnings: string[]): string[] {
  try {
    const elements = parseFormatString(format);
    const names: string[] = [];
    const walk = (els: ReturnType<typeof parseFormatString>) => {
      for (const el of els) {
        if (el.type === "variable") names.push(el.name);
        else if (el.type === "textGroup") walk(el.format);
        else if (el.type === "conditional") walk(el.format);
      }
    };
    walk(elements);
    return names;
  } catch {
    warnings.push("Could not determine explicitly referenced modules.");
    return [];
  }
}

/** Parses a style string in the config's palette scope. */
export function styleFor(
  styleString: string,
  config: StarshipConfig,
): Style | undefined {
  return parseStyleString(styleString, resolvePalette(config.palettes, config.palette));
}
