/**
 * What each `$variable` in a module's format string stands for.
 *
 * Parsed from starship's own documentation by `scripts/build-module-docs.mjs`
 * rather than written here, so the wording is upstream's and a release that
 * renames or adds a variable is one `pnpm build:data` away.
 *
 * The generated file is keyed by the documentation anchor rather than the
 * module name, because that is a mapping the project already keeps: every
 * module's deep link into the configuration reference lives in `meta.ts`.
 */

import generated from "../../../data/variables.generated.json";
import { DEFAULT_SYMBOLS } from "@/lib/engine/modules/os";
import { docsAnchor } from "./meta";
import type { DocumentationLink } from "./documentation";

export interface VariableDoc {
  description: string;
  example?: string;
  links?: DocumentationLink[];
}

const BY_ANCHOR = generated as Record<string, Record<string, VariableDoc>>;

/**
 * The variables starship's documentation never lists in a Variables table.
 *
 * Some modules' pages carry an Options table and examples and nothing else
 * (azure, battery, fill, line_break, pijul_channel); `shell` exposes one
 * variable per shell that only its Options table describes, and `directory`
 * documents `read_only` as an option. The wording here follows those tables
 * where there is one to follow. Kept apart from the generated file so a docs
 * release cannot quietly overwrite them, and so the hand-written ones are
 * visible as such.
 */
const MIRRORS_SYMBOL = { description: "Mirrors the value of option symbol" };

/** starship's own wording for each shell, from the module's Options table. */
const SHELL_INDICATORS: Record<string, VariableDoc> = Object.fromEntries(
  ["bash", "fish", "zsh", "powershell", "ion", "elvish", "tcsh", "xonsh", "cmd"].map(
    (shell) => [
      `${shell}_indicator`,
      { description: `A format string used to represent ${shell}.` },
    ],
  ),
);

const UNDOCUMENTED_UPSTREAM: Record<string, Record<string, VariableDoc>> = {
  azure: {
    subscription: { description: "The name of the default Azure subscription" },
    username: { description: "The username on the default subscription" },
    symbol: MIRRORS_SYMBOL,
  },
  battery: {
    percentage: { description: "The current charge", example: "10%" },
    symbol: { description: "The symbol for the current charging state" },
  },
  directory: {
    read_only: { description: "The symbol indicating the current directory is read only." },
  },
  fill: {
    fill: { description: "The character repeated to pad the line out to the terminal width" },
  },
  line_break: {
    line_break: { description: "The newline this module inserts, splitting the prompt across two lines" },
  },
  pijul_channel: {
    channel: { description: "The active channel of the check-out" },
    symbol: MIRRORS_SYMBOL,
  },
  shell: {
    ...SHELL_INDICATORS,
    pwsh_indicator: {
      description:
        "A format string used to represent pwsh. Mirrors powershell_indicator unless it is set.",
    },
    unknown_indicator: {
      description: "The default value to be displayed when the shell is unknown.",
    },
  },
};

/**
 * Examples worth replacing, where upstream's is accurate but unhelpful.
 *
 * The documentation writes `os.symbol` as 🎗️, which is Arch's entry in the
 * symbols table — in a row that reads "the current operating system symbol"
 * it looks like no operating system at all. This one is the app's own symbol
 * for macOS, which is the system the simulated environment starts on, so the
 * example matches what the preview is rendering a few centimetres away.
 */
const BETTER_EXAMPLES: Record<string, Record<string, string>> = {
  os: { symbol: DEFAULT_SYMBOLS.Macos.trim() },
};

export function variableDoc(
  moduleName: string,
  variable: string,
): VariableDoc | undefined {
  const anchor = docsAnchor(moduleName);
  const documented = anchor ? BY_ANCHOR[anchor]?.[variable] : undefined;
  if (documented) {
    const better = BETTER_EXAMPLES[moduleName]?.[variable];
    return better ? { ...documented, example: better } : documented;
  }

  return UNDOCUMENTED_UPSTREAM[moduleName]?.[variable];
}

/**
 * One line for a row, with the documented example appended: knowing that
 * `$duration` reads `2h27m20s` settles more questions than the sentence does.
 */
export function describeVariable(
  moduleName: string,
  variable: string,
): string | undefined {
  const doc = variableDoc(moduleName, variable);
  if (!doc) return undefined;
  // A few descriptions already carry an example of their own, and two of them
  // in one line reads as a mistake.
  if (!doc.example || doc.description.includes("e.g.")) return doc.description;
  return `${doc.description} (e.g. ${doc.example})`;
}
