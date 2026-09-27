/** Diagnostics shared by the browser and the terminal editor. */
import { collectVariables, tryParseFormatString } from "@/lib/engine/formatString";
import type { StarshipConfig } from "@/lib/engine/prompt";
import { isFormatOption } from "./meta";
import { optionEnum } from "./optionEnums";
import {
  getModuleSchema,
  getRootOption,
  type OptionSchema,
} from "./schema";

export interface ConfigDiagnostic {
  code: "type" | "enum" | "format" | "palette-reference" | "module-reference" | "unknown-option" | "unknown-module";
  severity: "error" | "warning";
  path: string;
  message: string;
  /** Character offset inside a format option, when the parser provides one. */
  index?: number;
}

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeMatches(type: OptionSchema["type"], value: unknown): boolean {
  switch (type) {
    case "string": return typeof value === "string";
    case "boolean": return typeof value === "boolean";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "array": return Array.isArray(value);
    case "object": return isTable(value);
    case "unknown": return true;
  }
}

/** Unknown keys are warnings: a newer Starship may already support them. */
export function validateConfig(config: StarshipConfig): ConfigDiagnostic[] {
  const diagnostics: ConfigDiagnostic[] = [];
  const add = (item: ConfigDiagnostic) => { diagnostics.push(item); };
  const palettes = isTable(config.palettes) ? config.palettes : {};

  const validateOption = (
    path: string,
    value: unknown,
    schema: OptionSchema | undefined,
    moduleName?: string,
  ) => {
    if (!schema) {
      add({ code: "unknown-option", severity: "warning", path, message: "Unknown option; kept for newer Starship versions." });
      return;
    }
    if (!typeMatches(schema.type, value)) {
      add({ code: "type", severity: "error", path, message: `Expected ${schema.type}.` });
      return;
    }
    const key = schema.key;
    const choices = moduleName ? optionEnum(moduleName, key)?.choices.map((choice) => choice.value) : schema.enum;
    if (choices?.length && typeof value === "string" && !choices.includes(value)) {
      add({ code: "enum", severity: "error", path, message: `Expected one of: ${choices.join(", ")}.` });
    }
    const isFormat = moduleName ? isFormatOption(moduleName, key) :
      key === "format" || key === "right_format" || key === "continuation_prompt";
    if (isFormat && typeof value === "string") {
      const parsed = tryParseFormatString(value);
      if (!parsed.ok) {
        add({ code: "format", severity: "error", path, message: parsed.error, index: parsed.index });
      } else if (key === "format" || key === "right_format") {
        for (const variable of collectVariables(parsed.elements)) {
          if (variable === "all" || variable === "line_break" || variable === "fill") continue;
          const [family, instance] = variable.split(".");
          const defined = instance && (family === "custom" || family === "env_var")
            ? isTable(config[family]) && isTable((config[family] as Record<string, unknown>)[instance])
            : Boolean(getModuleSchema(variable));
          if (!defined) {
            add({ code: "module-reference", severity: "warning", path, message: `Unknown module reference: ${variable}.` });
          }
        }
      }
    }
  };

  const validateModule = (name: string, value: unknown, prefix = name) => {
    const schema = getModuleSchema(name);
    if (!schema) {
      add({ code: "unknown-module", severity: "warning", path: prefix, message: "Unknown module; kept for newer Starship versions." });
      return;
    }
    if (!isTable(value)) {
      add({ code: "type", severity: "error", path: prefix, message: "Expected a module table." });
      return;
    }
    for (const [key, option] of Object.entries(value)) {
      validateOption(`${prefix}.${key}`, option, schema.options.find((candidate) => candidate.key === key), name);
    }
  };

  for (const [key, value] of Object.entries(config)) {
    if (key === "$schema") continue;
    const root = getRootOption(key);
    if (root) {
      validateOption(key, value, root);
      if (key === "palette" && typeof value === "string" && !Object.hasOwn(palettes, value)) {
        add({ code: "palette-reference", severity: "warning", path: key, message: `Palette ${value} is not defined.` });
      }
      continue;
    }
    if (key === "custom" || key === "env_var") {
      if (!isTable(value)) {
        add({ code: "type", severity: "error", path: key, message: "Expected named module tables." });
      } else {
        for (const [instance, options] of Object.entries(value)) {
          validateModule(key, options, `${key}.${instance}`);
        }
      }
      continue;
    }
    validateModule(key, value);
  }
  return diagnostics;
}
