/**
 * Hand-curated overlay for things starship's JSON Schema cannot express.
 *
 * The schema types every string option as `string`, but the UI needs three
 * different editors:
 *
 *  - **format options** are parsed by starship's format parser, so they carry
 *    `$variables`, `[text](style)` groups, `(optional)` groups, and require
 *    backslash escaping of `[`, `]`, `(` and `)`;
 *  - **style options** are parsed by `parseStyleString` — colours, palette
 *    names and modifiers;
 *  - everything else is a literal string.
 *
 * The lists below were derived from starship 1.26.0 by following which config
 * fields reach the format parser. A field is a format option when its value is
 * bound through `StringFormatter::map_meta` (which re-parses the value as a
 * format string) rather than `map` (which inserts it literally). That
 * distinction is not uniform across modules and cannot be guessed from the
 * option's name: `jobs.symbol` and `kubernetes.symbol` are format strings
 * while `mise.symbol`, `dotnet.symbol`, `fill.symbol`, `direnv.symbol` and
 * every `truncation_symbol` are literal.
 *
 * Deliberately **not** format options, despite the name:
 *  - `version_format` — a `${raw}`/`${major}` version template;
 *  - `time_format` — a chrono strftime string.
 *
 * Re-derive after a schema sync; `meta.test.ts` guards the invariants that
 * every schema module is covered and every listed option exists.
 */

import { getOptionSchema } from "./schema";
import type { OptionType } from "./schema";

function templateModuleName(name: string): string {
  return name.startsWith("env_var.") ? "env_var" : name.startsWith("custom.") ? "custom" : name;
}

export type ModuleGroup = "Core" | "Git" | "Languages" | "Build Tools"
  | "Cloud & Tools" | "System";

export interface ModuleMeta {
  group: ModuleGroup;
  /** Deep link into starship's configuration reference. */
  docs: string;
  /** Options parsed as starship format strings. */
  formatOptions: string[];
  /** Options parsed as starship style strings. */
  styleOptions: string[];
}

/** Display order for `ModuleGroup`, coarse-to-specific. */
export const MODULE_GROUPS: readonly ModuleGroup[] = [
  "Core",
  "Git",
  "Languages",
  "Build Tools",
  "Cloud & Tools",
  "System",
];

/**
 * The fragment of a module's documentation URL, which is also the key the
 * docs-derived option and variable tables are stored under — parsing them
 * cannot know module names, only headings, and this map already pairs the two.
 */
export function docsAnchor(moduleName: string): string | undefined {
  return MODULE_META[templateModuleName(moduleName)]?.docs.split("#")[1];
}

export const MODULE_META: Record<string, ModuleMeta> = {
  aws: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#aws",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  azure: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#azure",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  battery: {
    group: "System",
    docs: "https://starship.rs/config/#battery",
    formatOptions: [
      "format", "full_symbol", "charging_symbol", "discharging_symbol", "unknown_symbol",
      "empty_symbol",
    ],
    styleOptions: [],
  },
  buf: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#buf",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  bun: {
    group: "Languages",
    docs: "https://starship.rs/config/#bun",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  c: {
    group: "Languages",
    docs: "https://starship.rs/config/#c",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  character: {
    group: "Core",
    docs: "https://starship.rs/config/#character",
    formatOptions: [
      "format", "success_symbol", "error_symbol", "vimcmd_symbol",
      "vimcmd_visual_symbol", "vimcmd_replace_symbol", "vimcmd_replace_one_symbol",
    ],
    styleOptions: [],
  },
  claude_context: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/",
    formatOptions: ["format", "symbol"],
    styleOptions: [],
  },
  claude_cost: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/",
    formatOptions: ["format", "symbol"],
    styleOptions: [],
  },
  claude_model: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  cmake: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#cmake",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  cmd_duration: {
    group: "Core",
    docs: "https://starship.rs/config/#command-duration",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  cobol: {
    group: "Languages",
    docs: "https://starship.rs/config/#cobol-gnucobol",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  conda: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#conda",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  container: {
    group: "System",
    docs: "https://starship.rs/config/#container",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  cpp: {
    group: "Languages",
    docs: "https://starship.rs/config/#cpp",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  crystal: {
    group: "Languages",
    docs: "https://starship.rs/config/#crystal",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  custom: {
    group: "Core",
    docs: "https://starship.rs/config/#custom-commands",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  daml: {
    group: "Languages",
    docs: "https://starship.rs/config/#daml",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  dart: {
    group: "Languages",
    docs: "https://starship.rs/config/#dart",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  deno: {
    group: "Languages",
    docs: "https://starship.rs/config/#deno",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  directory: {
    group: "Core",
    docs: "https://starship.rs/config/#directory",
    formatOptions: ["format", "repo_root_format"],
    styleOptions: [
      "style", "repo_root_style", "before_repo_root_style", "read_only_style",
    ],
  },
  direnv: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#direnv",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  docker_context: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#docker-context",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  dotnet: {
    group: "Languages",
    docs: "https://starship.rs/config/#dotnet",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  elixir: {
    group: "Languages",
    docs: "https://starship.rs/config/#elixir",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  elm: {
    group: "Languages",
    docs: "https://starship.rs/config/#elm",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  env_var: {
    group: "Core",
    docs: "https://starship.rs/config/#environment-variable",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  erlang: {
    group: "Languages",
    docs: "https://starship.rs/config/#erlang",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  fennel: {
    group: "Languages",
    docs: "https://starship.rs/config/#fennel",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  fill: {
    group: "Core",
    docs: "https://starship.rs/config/#fill",
    formatOptions: [],
    styleOptions: ["style"],
  },
  fortran: {
    group: "Languages",
    docs: "https://starship.rs/config/#fortran",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  fossil_branch: {
    group: "Git",
    docs: "https://starship.rs/config/#fossil-branch",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  fossil_metrics: {
    group: "Git",
    docs: "https://starship.rs/config/#fossil-metrics",
    formatOptions: ["format"],
    styleOptions: ["added_style", "deleted_style"],
  },
  gcloud: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#google-cloud-gcloud",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  git_branch: {
    group: "Git",
    docs: "https://starship.rs/config/#git-branch",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  git_commit: {
    group: "Git",
    docs: "https://starship.rs/config/#git-commit",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  git_metrics: {
    group: "Git",
    docs: "https://starship.rs/config/#git-metrics",
    formatOptions: ["format"],
    styleOptions: ["added_style", "deleted_style"],
  },
  git_state: {
    group: "Git",
    docs: "https://starship.rs/config/#git-state",
    formatOptions: [
      "format", "rebase", "merge", "revert", "cherry_pick", "bisect", "am", "am_or_rebase",
    ],
    styleOptions: ["style"],
  },
  git_status: {
    group: "Git",
    docs: "https://starship.rs/config/#git-status",
    formatOptions: [
      "format", "stashed", "ahead", "behind", "up_to_date", "diverged", "conflicted",
      "deleted", "renamed", "modified", "staged", "untracked", "typechanged",
      "worktree_added", "worktree_deleted", "worktree_modified", "worktree_typechanged",
      "index_added", "index_deleted", "index_modified", "index_typechanged",
    ],
    styleOptions: ["style"],
  },
  gleam: {
    group: "Languages",
    docs: "https://starship.rs/config/#gleam",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  golang: {
    group: "Languages",
    docs: "https://starship.rs/config/#go",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style", "not_capable_style"],
  },
  gradle: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#gradle",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  guix_shell: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#guix-shell",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  haskell: {
    group: "Languages",
    docs: "https://starship.rs/config/#haskell",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  haxe: {
    group: "Languages",
    docs: "https://starship.rs/config/#haxe",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  helm: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#helm",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  hg_branch: {
    group: "Git",
    docs: "https://starship.rs/config/#mercurial-branch",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  hg_state: {
    group: "Git",
    docs: "https://starship.rs/config/#mercurial-state",
    formatOptions: [
      "format", "merge", "rebase", "update", "bisect", "shelve", "graft", "transplant",
      "histedit",
    ],
    styleOptions: ["style"],
  },
  hostname: {
    group: "System",
    docs: "https://starship.rs/config/#hostname",
    formatOptions: ["format", "ssh_symbol"],
    styleOptions: ["style"],
  },
  java: {
    group: "Languages",
    docs: "https://starship.rs/config/#java",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  jobs: {
    group: "Core",
    docs: "https://starship.rs/config/#jobs",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  julia: {
    group: "Languages",
    docs: "https://starship.rs/config/#julia",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  kotlin: {
    group: "Languages",
    docs: "https://starship.rs/config/#kotlin",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  kubernetes: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#kubernetes",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  line_break: {
    group: "Core",
    docs: "https://starship.rs/config/#line-break",
    formatOptions: [],
    styleOptions: [],
  },
  localip: {
    group: "System",
    docs: "https://starship.rs/config/#local-ip",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  lua: {
    group: "Languages",
    docs: "https://starship.rs/config/#lua",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  maven: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#maven",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  memory_usage: {
    group: "System",
    docs: "https://starship.rs/config/#memory-usage",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  meson: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#meson",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  mise: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#mise",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  mojo: {
    group: "Languages",
    docs: "https://starship.rs/config/#mojo",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  nats: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#nats",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  netns: {
    group: "System",
    docs: "https://starship.rs/config/#network-namespace",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  nim: {
    group: "Languages",
    docs: "https://starship.rs/config/#nim",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  nix_shell: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#nix-shell",
    formatOptions: ["format", "symbol", "impure_msg", "pure_msg", "unknown_msg"],
    styleOptions: ["style"],
  },
  nodejs: {
    group: "Languages",
    docs: "https://starship.rs/config/#node-js",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style", "not_capable_style"],
  },
  ocaml: {
    group: "Languages",
    docs: "https://starship.rs/config/#ocaml",
    formatOptions: [
      "format", "global_switch_indicator", "local_switch_indicator", "symbol",
    ],
    styleOptions: ["style"],
  },
  odin: {
    group: "Languages",
    docs: "https://starship.rs/config/#odin",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  opa: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#open-policy-agent",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  openstack: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#openstack",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  os: {
    group: "System",
    docs: "https://starship.rs/config/#os",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  package: {
    group: "Core",
    docs: "https://starship.rs/config/#package-version",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  perl: {
    group: "Languages",
    docs: "https://starship.rs/config/#perl",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  php: {
    group: "Languages",
    docs: "https://starship.rs/config/#php",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  pijul_channel: {
    group: "Git",
    docs: "https://starship.rs/config/#pijul-channel",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  pixi: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#pixi",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  pulumi: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#pulumi",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  purescript: {
    group: "Languages",
    docs: "https://starship.rs/config/#purescript",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  python: {
    group: "Languages",
    docs: "https://starship.rs/config/#python",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  quarto: {
    group: "Languages",
    docs: "https://starship.rs/config/#quarto",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  raku: {
    group: "Languages",
    docs: "https://starship.rs/config/#raku",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  red: {
    group: "Languages",
    docs: "https://starship.rs/config/#red",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  rlang: {
    group: "Languages",
    docs: "https://starship.rs/config/#r",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  ruby: {
    group: "Languages",
    docs: "https://starship.rs/config/#ruby",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  rust: {
    group: "Languages",
    docs: "https://starship.rs/config/#rust",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  scala: {
    group: "Languages",
    docs: "https://starship.rs/config/#scala",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  shell: {
    group: "Core",
    docs: "https://starship.rs/config/#shell",
    formatOptions: [
      "format", "bash_indicator", "fish_indicator", "zsh_indicator",
      "powershell_indicator", "pwsh_indicator", "ion_indicator", "elvish_indicator",
      "tcsh_indicator", "nu_indicator", "xonsh_indicator", "cmd_indicator",
      "unknown_indicator",
    ],
    styleOptions: ["style"],
  },
  shlvl: {
    group: "System",
    docs: "https://starship.rs/config/#shlvl",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  singularity: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#singularity",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  solidity: {
    group: "Languages",
    docs: "https://starship.rs/config/#solidity",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  spack: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#spack",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  status: {
    group: "Core",
    docs: "https://starship.rs/config/#status",
    formatOptions: [
      "format", "symbol", "success_symbol", "not_executable_symbol", "not_found_symbol",
      "sigint_symbol", "signal_symbol", "pipestatus_format",
      "pipestatus_segment_format",
    ],
    styleOptions: ["style", "success_style", "failure_style"],
  },
  sudo: {
    group: "System",
    docs: "https://starship.rs/config/#sudo",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  swift: {
    group: "Languages",
    docs: "https://starship.rs/config/#swift",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  terraform: {
    group: "Cloud & Tools",
    docs: "https://starship.rs/config/#terraform",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  time: {
    group: "Core",
    docs: "https://starship.rs/config/#time",
    formatOptions: ["format"],
    styleOptions: ["style"],
  },
  typst: {
    group: "Languages",
    docs: "https://starship.rs/config/#typst",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  username: {
    group: "System",
    docs: "https://starship.rs/config/#username",
    formatOptions: ["format"],
    styleOptions: ["style_root", "style_user"],
  },
  vagrant: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#vagrant",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  vcs: {
    group: "Git",
    docs: "https://starship.rs/config/#vcs",
    formatOptions: ["fossil_modules", "git_modules", "hg_modules", "pijul_modules"],
    styleOptions: [],
  },
  vcsh: {
    group: "Git",
    docs: "https://starship.rs/config/#vcsh",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  vlang: {
    group: "Languages",
    docs: "https://starship.rs/config/#v",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  xmake: {
    group: "Build Tools",
    docs: "https://starship.rs/config/#xmake",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
  zig: {
    group: "Languages",
    docs: "https://starship.rs/config/#zig",
    formatOptions: ["format", "symbol"],
    styleOptions: ["style"],
  },
};

const EMPTY: ModuleMeta = {
  group: "Core",
  docs: "https://starship.rs/config/",
  formatOptions: [],
  styleOptions: [],
};

/** Metadata for a module, falling back to a neutral entry for unknown names. */
export function moduleMeta(name: string): ModuleMeta {
  return MODULE_META[templateModuleName(name)] ?? EMPTY;
}

export function isFormatOption(moduleName: string, optionKey: string): boolean {
  return moduleMeta(moduleName).formatOptions.includes(optionKey);
}

export function isStyleOption(moduleName: string, optionKey: string): boolean {
  return moduleMeta(moduleName).styleOptions.includes(optionKey);
}

/** Module names in a group, in the order `MODULE_META` declares them. */
export function modulesInGroup(group: ModuleGroup): string[] {
  return Object.entries(MODULE_META)
    .filter(([, meta]) => meta.group === group)
    .map(([name]) => name);
}

/** Which editor an option gets. */
export type OptionKind =
  | "format"
  | "style"
  | "boolean"
  | "number"
  | "string"
  | "enum"
  | "array"
  | "raw";

const KIND_BY_SCHEMA_TYPE: Record<OptionType, OptionKind> = {
  string: "string",
  boolean: "boolean",
  number: "number",
  array: "array",
  object: "raw",
  unknown: "raw",
};

/**
 * Picks the editor for one module option.
 *
 * This overlay wins over the schema, because format and style strings are
 * plain `string` there. Options the schema does not describe — a module
 * registry may carry more than the published schema does — fall back to the
 * shape of their default value.
 *
 * `meta` is optional; pass the caller's already-looked-up entry to avoid a
 * second lookup in a render loop.
 */
export function optionKind(
  moduleName: string,
  optionKey: string,
  defaultValue?: unknown,
  meta: ModuleMeta = moduleMeta(moduleName),
): OptionKind {
  if (meta.formatOptions.includes(optionKey)) return "format";
  if (meta.styleOptions.includes(optionKey)) return "style";

  const option = getOptionSchema(templateModuleName(moduleName), optionKey);
  if (option) {
    if (option.enum && option.enum.length > 0) return "enum";
    return KIND_BY_SCHEMA_TYPE[option.type];
  }

  if (Array.isArray(defaultValue)) return "array";
  switch (typeof defaultValue) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    default:
      return "raw";
  }
}
