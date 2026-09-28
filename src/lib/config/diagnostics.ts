/** Diagnostics shared by the browser and the terminal editor. */
import { collectVariables, tryParseFormatString } from "@/lib/engine/formatString";
import type { StarshipConfig } from "@/lib/engine/prompt";
import { isFormatOption } from "./meta";
import { optionEnum } from "./optionEnums";
import validateSchema from "./validation.generated.mjs";
import { checkRuleCount, compileRegex } from "@/lib/engine/safeRegex";
import {
  getModuleSchema,
  getRootOption,
  type OptionSchema,
} from "./schema";

export interface ConfigDiagnostic {
  code: "type" | "enum" | "format" | "palette-reference" | "module-reference" | "unknown-option" | "unknown-module" | "preview-limit";
  severity: "error" | "warning";
  path: string;
  message: string;
  /** Character offset inside a format option, when the parser provides one. */
  index?: number;
}

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Unknown keys are warnings: a newer Starship may already support them. */
export function validateConfig(config: StarshipConfig): ConfigDiagnostic[] {
  const diagnostics: ConfigDiagnostic[] = [];
  if (!validateSchema(config)) {
    for (const error of validateSchema.errors ?? []) {
      if (error.keyword === "additionalProperties" || error.keyword === "anyOf" || error.keyword === "oneOf") continue;
      const path = error.instancePath.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~")).join(".");
      diagnostics.push({ code: error.keyword === "enum" ? "enum" : "type", severity: "error", path, message: error.message ?? "Invalid configuration value." });
    }
  }
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
    const key = schema.key;
    if (moduleName === "directory" && key === "substitutions" || moduleName === "kubernetes" && ["contexts", "context_aliases", "user_aliases"].includes(key)) {
      const rules = Array.isArray(value) ? value : isTable(value) ? Object.keys(value) : [];
      try {
        checkRuleCount(rules.length);
        for (const rule of rules) {
          const patterns = typeof rule === "string" ? (moduleName === "kubernetes" ? [rule] : []) :
            isTable(rule) ? moduleName === "directory" ? (rule.regex === true ? [rule.from] : []) : [rule.context_pattern, rule.user_pattern] : [];
          for (const pattern of patterns) if (typeof pattern === "string") compileRegex(pattern);
        }
      } catch (error) {
        add({ code: "preview-limit", severity: "warning", path, message: `Preview regex unsupported or over budget: ${(error as Error).message}` });
      }
    }
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
      } else if (!moduleName && (key === "format" || key === "right_format")) {
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
          if (key === "env_var" && !isTable(options)) {
            validateOption(`env_var.${instance}`, options, getModuleSchema("env_var")?.options.find((option) => option.key === instance), "env_var");
          } else validateModule(key, options, `${key}.${instance}`);
        }
      }
      continue;
    }
    validateModule(key, value);
  }
  return diagnostics;
}
