/**
 * What each option in a module's settings does.
 *
 * Starship publishes a JSON Schema, and the builder's option rows are built
 * from it — but it describes none of them: every option arrives typed as a
 * string with no `description`, so the rows have always been a list of bare
 * keys. The prose exists only in the documentation's per-module Options
 * table, which `scripts/build-module-docs.mjs` parses alongside the Variables
 * table it already read.
 *
 * Keyed by documentation anchor, for the same reason as the variables: the
 * parser knows headings, `meta.ts` knows which module each heading belongs to.
 */

import generated from "../../../data/options.generated.json";
import { docsAnchor } from "./meta";
import type { Documentation } from "./documentation";

const BY_ANCHOR = generated as Record<string, Record<string, Documentation>>;

/**
 * Options upstream documents on dozens of modules but omits from one.
 *
 * The wording is theirs, taken verbatim from the majority of the tables that
 * do carry the row — `detect_folders` is worded identically in 51 of the 57
 * modules that document it, and `version_format` in 50 of 52 — so this fills
 * a hole in the source rather than paraphrasing around it. Anything whose
 * meaning genuinely differs per module is left blank instead.
 */
const BORROWED: Record<string, Record<string, string>> = {
  gleam: { detect_folders: "Which folders should trigger this module." },
  haskell: {
    version_format: "The version format. Available vars are raw, major, minor, & patch",
  },
  python: {
    detect_env_vars: "Which environment variable(s) should trigger this module.",
  },
};

/** Modules present in the schema before their reference tables reached the docs. */
const UNDOCUMENTED_UPSTREAM: Record<string, Record<string, Documentation>> = {
  claude_context: {
    format: { description: "The format for displaying Claude Code context usage." },
    symbol: { description: "The symbol shown before the context gauge." },
    gauge_width: { description: "The number of cells in the context usage gauge." },
    gauge_full_symbol: { description: "The symbol used for a full gauge cell." },
    gauge_partial_symbol: { description: "The symbol used for a partially full gauge cell." },
    gauge_empty_symbol: { description: "The symbol used for an empty gauge cell." },
    display: { description: "Context usage thresholds that select a style or hide the module." },
    disabled: { description: "Disables the Claude context module." },
  },
  claude_cost: {
    format: { description: "The format for displaying Claude Code session cost." },
    symbol: { description: "The symbol shown before the session cost." },
    display: { description: "Cost thresholds that select a style or hide the module." },
    disabled: { description: "Disables the Claude cost module." },
  },
  claude_model: {
    format: { description: "The format for displaying the active Claude model." },
    symbol: { description: "The symbol shown before the model name." },
    style: { description: "The style used to render the Claude model." },
    model_aliases: {
      description: "Aliases keyed by Claude model ID or display name.",
    },
    disabled: { description: "Disables the Claude model module." },
  },
};

const CUSTOM_OS_DOCUMENTATION: Documentation = {
  description:
    "Only show this custom module on the selected operating system. Supported Rust OS values.",
  links: [
    {
      label: "Supported Rust OS values",
      url: "https://doc.rust-lang.org/std/env/consts/constant.OS.html",
    },
  ],
};

export function optionDoc(
  moduleName: string,
  option: string,
): Documentation | undefined {
  if ((moduleName === "custom" || moduleName.startsWith("custom.")) && option === "os") {
    return CUSTOM_OS_DOCUMENTATION;
  }
  const anchor = docsAnchor(moduleName);
  const documented = anchor ? BY_ANCHOR[anchor]?.[option] : undefined;
  if (documented) return documented;
  const supplemental = UNDOCUMENTED_UPSTREAM[moduleName]?.[option];
  if (supplemental) return supplemental;
  const borrowed = BORROWED[moduleName]?.[option];
  return borrowed ? { description: borrowed } : undefined;
}

export function describeOption(
  moduleName: string,
  option: string,
): string | undefined {
  return optionDoc(moduleName, option)?.description;
}
