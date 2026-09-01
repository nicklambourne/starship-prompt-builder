#!/usr/bin/env node
/**
 * Bundles the vendored preset TOMLs into a single JSON artefact.
 *
 * Neither Next.js nor vitest can `import` a `.toml` file as text without a
 * loader that would have to be configured identically in both, so the raw
 * TOMLs in `data/presets/` are folded into `data/presets.generated.json`,
 * which both toolchains read through `resolveJsonModule`.
 *
 * Labels and descriptions come from starship's own presets index
 * (docs/presets/README.md), the community theme projects, and the source
 * prompts that inspired our Starship recreations. They are maintained here
 * because the TOMLs carry no metadata of their own.
 *
 * Three sources: starship's twelve official presets in `data/presets/`, the
 * themes their own projects publish in `data/presets-community/`, and
 * Starship recreations of other prompts in `data/presets-inspired/`. Each
 * carries where it came from, which the picker shows and THIRD_PARTY.md records.
 *
 * Run:  pnpm build:presets
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = join(repoRoot, "data", "presets");
const COMMUNITY_DIR = join(repoRoot, "data", "presets-community");
const INSPIRED_DIR = join(repoRoot, "data", "presets-inspired");
const TARGET = join(repoRoot, "data", "presets.generated.json");

const STARSHIP = {
  project: "starship",
  url: "https://starship.rs/presets/",
  licence: "ISC",
  copyright: "© the Starship contributors",
  licenceUrl: "https://github.com/starship/starship/blob/master/LICENSE",
};

/** Ordered as starship's presets index orders them. */
const METADATA = [
  {
    id: "nerd-font-symbols",
    label: "Nerd Font Symbols",
    description: "Changes the symbols for each module to use Nerd Font symbols.",
  },
  {
    id: "no-nerd-font",
    label: "No Nerd Fonts",
    description:
      "Changes the symbols for several modules so that no Nerd Font symbols are used anywhere in the prompt.",
  },
  {
    id: "bracketed-segments",
    label: "Bracketed Segments",
    description:
      "Shows each module's segment in brackets instead of starship's default wording (“via”, “on”, and so on).",
  },
  {
    id: "plain-text-symbols",
    label: "Plain Text Symbols",
    description:
      "Replaces every module symbol with plain text — useful without Unicode support.",
  },
  {
    id: "no-runtime-versions",
    label: "No Runtime Versions",
    description:
      "Hides language runtime versions, for containers and virtualised environments.",
  },
  {
    id: "no-empty-icons",
    label: "No Empty Icons",
    description: "Hides a module's icon when the toolset is not found.",
  },
  {
    id: "pure-preset",
    label: "Pure Prompt",
    description: "Emulates the look and behaviour of the Pure prompt.",
  },
  {
    id: "pastel-powerline",
    label: "Pastel Powerline",
    description:
      "Powerline styling inspired by M365Princess; also demonstrates path substitution.",
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    description: "Inspired by the tokyo-night VS Code theme.",
  },
  {
    id: "gruvbox-rainbow",
    label: "Gruvbox Rainbow",
    description: "A Gruvbox palette take on Pastel Powerline and Tokyo Night.",
  },
  {
    id: "jetpack",
    label: "Jetpack",
    description:
      "A pseudo-minimalist prompt inspired by the geometry and spaceship prompts.",
  },
  {
    id: "catppuccin-powerline",
    label: "Catppuccin Powerline",
    description: "Gruvbox Rainbow restyled with the Catppuccin palette.",
  },
];

/**
 * Themes published by the projects whose palettes they are, rather than by
 * starship. All MIT, all vendored verbatim; the descriptions are written here
 * from what each project's README says the theme is.
 */
const COMMUNITY = [
  {
    id: "catppuccin",
    label: "Catppuccin",
    description:
      "The Catppuccin project's own theme. Ships all four flavours as palettes — swap `palette` for Latte, Frappé, Macchiato or Mocha.",
    source: {
      project: "catppuccin/starship",
      url: "https://github.com/catppuccin/starship",
      licence: "MIT",
      copyright: "© 2021 Catppuccin",
      licenceUrl: "https://github.com/catppuccin/starship/blob/main/LICENSE",
    },
  },
  {
    id: "dracula",
    label: "Dracula",
    description:
      "The Dracula palette named by its own colours, with a lambda for the prompt character.",
    source: {
      project: "dracula/starship",
      url: "https://github.com/dracula/starship",
      licence: "MIT",
      copyright: "© 2022 Dracula Theme",
      licenceUrl: "https://github.com/dracula/starship/blob/master/LICENSE",
    },
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
    description:
      "Soho vibes: a two-line prompt that fills the width, with language versions on the right.",
    source: {
      project: "rose-pine/starship",
      url: "https://github.com/rose-pine/starship",
      licence: "MIT",
      copyright: "© Rosé Pine",
      licenceUrl: "https://github.com/rose-pine/starship/blob/main/LICENSE",
    },
  },
  {
    id: "rose-pine-moon",
    label: "Rosé Pine Moon",
    description: "Rosé Pine in its softer, darker variant.",
    source: {
      project: "rose-pine/starship",
      url: "https://github.com/rose-pine/starship",
      licence: "MIT",
      copyright: "© Rosé Pine",
      licenceUrl: "https://github.com/rose-pine/starship/blob/main/LICENSE",
    },
  },
  {
    id: "rose-pine-dawn",
    label: "Rosé Pine Dawn",
    description:
      "Rosé Pine for a light terminal — the only preset here written for one.",
    source: {
      project: "rose-pine/starship",
      url: "https://github.com/rose-pine/starship",
      licence: "MIT",
      copyright: "© Rosé Pine",
      licenceUrl: "https://github.com/rose-pine/starship/blob/main/LICENSE",
    },
  },
];
const POWERLEVEL10K = {
  project: "romkatv/powerlevel10k",
  url: "https://github.com/romkatv/powerlevel10k",
  licence: "MIT",
  copyright:
    "© 2009–2014 Robby Russell and contributors; © 2014–2017 Ben Hilburn; © 2019 Roman Perepelitsa and contributors",
  licenceUrl: "https://github.com/romkatv/powerlevel10k/blob/master/LICENSE",
};

/**
 * The deterministic shell state used by Powerlevel10k's configuration wizard
 * examples: ~/src on a clean master branch after a five-second command, with
 * the clock fixed at 16:23:42. Keeping it with the preset metadata means the
 * Starship translation demonstrates the same conditional modules as its
 * source instead of inheriting whichever environment happened to be open.
 */
const POWERLEVEL10K_ENVIRONMENT = {
  id: "powerlevel10k-wizard",
  label: "Powerlevel10k wizard example",
  description: "The clean ~/src repository used by Powerlevel10k's style previews.",
  path: "/Users/you/src",
  home: "/Users/you",
  readOnly: false,
  files: [],
  git: {
    branch: "master",
    commit: "a1b2c3d",
    detached: false,
    ahead: 0,
    behind: 0,
    staged: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    untracked: 0,
    conflicted: 0,
    stashed: 0,
    root: "/Users/you/src",
    hasRemote: true,
    remoteBranch: "master",
    remoteName: "origin",
  },
  status: 0,
  cmdDurationMs: 5_000,
  jobs: 0,
  username: "you",
  hostname: "laptop",
  ssh: false,
  isRoot: false,
  shell: "zsh",
  keymap: "insert",
  time: "2026-08-18T16:23:42",
  terminalWidth: 88,
  toolVersions: {},
  env: {},
  os: { name: "Macos", type: "Macos" },
};

/**
 * Starship-native translations of the actual configure-wizard samples in
 * `internal/wizard.zsh`, backed by the corresponding p10k-{style}.zsh module
 * lists. Powerlevel10k and Starship have different formatters, so these map
 * segment behavior rather than copying shell-specific implementation details.
 */
const INSPIRED = [
  {
    id: "powerlevel10k-lean-1-line",
    label: "Powerlevel10k Lean · 1 line",
    description:
      "Powerlevel10k's minimal transparent style on one line, with command duration on the right.",
    source: POWERLEVEL10K,
  },
  {
    id: "powerlevel10k-lean-2-lines",
    label: "Powerlevel10k Lean · 2 lines",
    description:
      "Powerlevel10k's minimal transparent style across two lines, adding OS, icons, time and an isolated input line.",
    source: POWERLEVEL10K,
  },
  {
    id: "powerlevel10k-classic-1-line",
    label: "Powerlevel10k Classic · 1 line",
    description:
      "Powerlevel10k's restrained single-background Powerline style on one line.",
    source: POWERLEVEL10K,
  },
  {
    id: "powerlevel10k-classic-2-lines",
    label: "Powerlevel10k Classic · 2 lines",
    description:
      "Powerlevel10k's framed Powerline style across two lines, with dotted fill and right-side timing.",
    source: POWERLEVEL10K,
  },
  {
    id: "powerlevel10k-rainbow-1-line",
    label: "Powerlevel10k Rainbow · 1 line",
    description:
      "Powerlevel10k's blue, green and yellow Powerline segments in a compact one-line prompt.",
    source: POWERLEVEL10K,
  },
  {
    id: "powerlevel10k-rainbow-2-lines",
    label: "Powerlevel10k Rainbow · 2 lines",
    description:
      "Powerlevel10k's full-colour Powerline style across two lines, with a ruled fill and isolated input line.",
    source: POWERLEVEL10K,
  },
].map((preset) => ({ ...preset, environment: POWERLEVEL10K_ENVIRONMENT }));

function collect(dir, metadata, defaultSource) {
  const onDisk = new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".toml"))
      .map((f) => f.replace(/\.toml$/, "")),
  );

  const described = new Set(metadata.map((p) => p.id));
  const undescribed = [...onDisk].filter((id) => !described.has(id));
  if (undescribed.length > 0) {
    throw new Error(`Preset TOMLs with no metadata entry: ${undescribed.join(", ")}`);
  }

  return metadata.map(({ id, label, description, source, ...extra }) => {
    if (!onDisk.has(id)) throw new Error(`Missing ${dir}/${id}.toml`);
    return {
      id,
      label,
      description,
      source: source ?? defaultSource,
      ...extra,
      toml: readFileSync(join(dir, `${id}.toml`), "utf8"),
    };
  });
}

const presets = [
  ...collect(SOURCE_DIR, METADATA, STARSHIP),
  ...collect(COMMUNITY_DIR, COMMUNITY),
  ...collect(INSPIRED_DIR, INSPIRED),
];

writeFileSync(TARGET, `${JSON.stringify({ presets }, null, 2)}\n`);
process.stdout.write(
  `${TARGET}: ${presets.length} presets ` +
    `(${METADATA.length} from starship, ${COMMUNITY.length} community themes, ` +
    `${INSPIRED.length} inspired recreations)\n`,
);
