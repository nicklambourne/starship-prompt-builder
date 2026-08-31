/**
 * A parity case per module, for the modules that can have one.
 *
 * The hand-written fixtures cover the formatter's hard parts — conditionals,
 * escapes, nested groups, palettes — but only a handful of modules ever met
 * the real binary. A module's defaults are copied from starship's Rust source
 * by hand, and nothing was checking that the copy still rendered the same way.
 *
 * What a module needs to appear on both sides is what decides whether it can
 * be swept:
 *
 *   - **Environment or files, and nothing else.** These are here. The case
 *     supplies the same environment to the real binary and to the scenario,
 *     and the two must agree byte for byte.
 *   - **A version from an installed tool.** Excluded: the version starship
 *     prints comes from whatever happens to be on the machine, so the case
 *     would pass on a laptop with Rust and fail on a runner without it. The
 *     language modules' formats are exercised through `LANGUAGE_SHAPES`
 *     below, which pins the version out of the comparison.
 *   - **Hardware, the clock, or the network.** Excluded outright; see
 *     `UNSWEEPABLE` for the list and the reason for each.
 *
 * The exclusions are listed rather than quietly dropped: a sweep that covers
 * two thirds of the modules while looking like it covers all of them is worse
 * than one that says so.
 */

import { hostname, userInfo } from "node:os";

import type { ParityCase } from "./fixtures";
import type { Scenario } from "@/lib/scenarios/types";

/*
 * `username` and `hostname` print what the machine says, so the scenario is
 * given the machine's own values. Inventing a name would only prove that two
 * different strings differ.
 */
const USER = userInfo().username;
const HOST = hostname();

const BASE: Omit<Scenario, "id" | "label" | "description"> = {
  path: "",
  home: "",
  readOnly: false,
  files: [],
  status: 0,
  cmdDurationMs: 0,
  jobs: 0,
  username: "tester",
  hostname: "fixture",
  ssh: false,
  isRoot: false,
  shell: "zsh",
  keymap: "insert",
  time: "2026-08-18T09:41:00",
  terminalWidth: 80,
  toolVersions: {},
  env: {},
};

interface SweepCase {
  /** The module under test; also the fixture id. */
  module: string;
  /** Extra TOML beneath `format`, when the module needs coaxing. */
  config?: string;
  setup?: string[];
  env?: Record<string, string>;
  scenario?: Partial<Scenario>;
}

/**
 * Modules whose default output depends only on things a fixture can set.
 *
 * `env` is given to both sides: the real binary through its process
 * environment, the engine through `scenario.env` and the fields derived from
 * it. Where a module reads something the Scenario models directly — the
 * username, the shell — the scenario override says so explicitly rather than
 * relying on the engine to read the env var.
 */
const SWEEPABLE: SweepCase[] = [
  // `force_display` because the module otherwise waits for credentials it
  // can only find in a real ~/.aws.
  { module: "aws", config: "force_display = true",
    env: { AWS_PROFILE: "work", AWS_REGION: "ap-southeast-2" },
    // Modelled as a field, like conda: the binary reads the variables, the
    // engine reads the scenario, so the case sets both.
    scenario: {
      aws: { profile: "work", region: "ap-southeast-2" },
      env: { AWS_PROFILE: "work", AWS_REGION: "ap-southeast-2" },
    } },
  { module: "character" },
  { module: "cmd_duration", config: "min_time = 0", scenario: { cmdDurationMs: 2500 } },
  { module: "conda", env: { CONDA_DEFAULT_ENV: "research" },
    // The engine models conda as a field rather than reading the variable, so
    // a case that sets one has to set the other.
    scenario: { conda: { environment: "research" } } },
  { module: "directory" },
  // Shows only next to something dockerish, by default.
  { module: "docker_context", env: { DOCKER_HOST: "tcp://10.0.0.2:2375" },
    setup: ["touch Dockerfile"],
    scenario: { env: { DOCKER_HOST: "tcp://10.0.0.2:2375" }, files: ["Dockerfile"] } },
  { module: "env_var", config: 'variable = "PARITY_MARKER"',
    env: { PARITY_MARKER: "set" }, scenario: { env: { PARITY_MARKER: "set" } } },
  { module: "guix_shell", env: { GUIX_ENVIRONMENT: "/gnu/store/env" },
    scenario: { env: { GUIX_ENVIRONMENT: "/gnu/store/env" } } },
  { module: "hostname", config: "ssh_only = false", scenario: { hostname: HOST } },
  { module: "jobs", config: "number_threshold = 1", scenario: { jobs: 3 } },
  { module: "line_break" },
  { module: "openstack", config: "", env: { OS_CLOUD: "devstack" },
    scenario: { env: { OS_CLOUD: "devstack" } } },
  { module: "shlvl", config: "threshold = 0", env: { SHLVL: "3" },
    // Modelled as a number on the scenario, read from the variable by the
    // binary — so, again, both.
    scenario: { shlvl: 3, env: { SHLVL: "3" } } },
  { module: "singularity", env: { SINGULARITY_NAME: "image.sif" },
    scenario: { env: { SINGULARITY_NAME: "image.sif" } } },
  { module: "spack", env: { SPACK_ENV: "/spack/env/tools" },
    scenario: { env: { SPACK_ENV: "/spack/env/tools" } } },
  { module: "status", scenario: { status: 130 } },
  { module: "terraform", env: { TF_WORKSPACE: "staging" },
    setup: ["mkdir -p .terraform"],
    scenario: { env: { TF_WORKSPACE: "staging" }, files: [".terraform"] } },
  { module: "username", config: "show_always = true", scenario: { username: USER } },
  { module: "vcsh", env: { VCSH_REPO_NAME: "dotfiles" },
    scenario: { env: { VCSH_REPO_NAME: "dotfiles" } } },
];

/**
 * Language modules, with the version taken out of the comparison.
 *
 * The default format is `via [$symbol($version )]($style)`, and `$version`
 * is whatever toolchain the machine happens to have — present on a laptop,
 * absent on a runner. Dropping it leaves the parts that are ours to get
 * wrong: the symbol, the style, the literal around them, and the detection
 * that decides whether the module appears at all.
 */
const LANGUAGE_SHAPES: { module: string; setup: string[]; files: string[] }[] = [
  { module: "rust", setup: ["touch Cargo.toml"], files: ["Cargo.toml"] },
  { module: "golang", setup: ["touch go.mod"], files: ["go.mod"] },
  { module: "nodejs", setup: ["touch package.json"], files: ["package.json"] },
  { module: "python", setup: ["touch requirements.txt"], files: ["requirements.txt"] },
  { module: "java", setup: ["touch pom.xml"], files: ["pom.xml"] },
  { module: "ruby", setup: ["touch Gemfile"], files: ["Gemfile"] },
  { module: "php", setup: ["touch composer.json"], files: ["composer.json"] },
  { module: "haskell", setup: ["touch stack.yaml"], files: ["stack.yaml"] },
  { module: "elixir", setup: ["touch mix.exs"], files: ["mix.exs"] },
  { module: "zig", setup: ["touch build.zig"], files: ["build.zig"] },
  { module: "lua", setup: ["touch .lua-version"], files: [".lua-version"] },
  { module: "crystal", setup: ["touch shard.yml"], files: ["shard.yml"] },
  { module: "dart", setup: ["touch pubspec.yaml"], files: ["pubspec.yaml"] },
  { module: "swift", setup: ["touch Package.swift"], files: ["Package.swift"] },
  { module: "scala", setup: ["touch build.sbt"], files: ["build.sbt"] },
  { module: "perl", setup: ["touch Makefile.PL"], files: ["Makefile.PL"] },
  { module: "cmake", setup: ["touch CMakeLists.txt"], files: ["CMakeLists.txt"] },
  { module: "gradle", setup: ["touch build.gradle"], files: ["build.gradle"] },
  { module: "julia", setup: ["touch Project.toml"], files: ["Project.toml"] },
  { module: "ocaml", setup: ["touch dune-project"], files: ["dune-project"] },
  { module: "purescript", setup: ["touch spago.dhall"], files: ["spago.dhall"] },
  { module: "elm", setup: ["touch elm.json"], files: ["elm.json"] },
];

/**
 * Modules with no deterministic fixture, and why. Reported by the suite so the
 * gap stays visible.
 */
export const UNSWEEPABLE: Record<string, string> = {
  claude_context: "needs Claude Code status-line JSON on stdin",
  claude_cost: "needs Claude Code status-line JSON on stdin",
  claude_model: "needs Claude Code status-line JSON on stdin",
  battery: "reads real hardware",
  memory_usage: "reads real memory, which moves between the two runs",
  localip: "reads a real network interface",
  time: "prints the wall clock, which differs between the two runs",
  container: "needs /run/.containerenv or /.dockerenv on the host",
  sudo: "runs `sudo -n true`, which depends on the host's sudoers",
  custom: "runs a shell command the engine deliberately cannot",
  os: "prints the host's own OS, so a fixture cannot choose it",
  shell: "starship reports the shell that launched it, not the fixture's",
  nix_shell: "needs the process to actually be inside a nix shell",
  package: "reads a version out of a manifest the tool must also understand",
  kubernetes: "needs a kubeconfig the binary will parse and the engine models differently",
  git_metrics: "counts diff lines, which the engine carries as aggregates",
  fill: "depends on terminal width the two sides measure differently",
};

/** The engine renders from this; the harness overwrites path and home. */
function sweepScenario(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return { ...BASE, id, label: id, description: id, ...overrides };
}

/** One case per module: only that module on, rendering its own default. */
export const SWEEP_CASES: ParityCase[] = [
  ...SWEEPABLE.map(({ module, config, setup, env, scenario }) => ({
    id: `module-${module}`,
    config: `add_newline = false\nformat = "$${module}"\n\n[${module}]\ndisabled = false\n${config ?? ""}\n`,
    scenario: sweepScenario(`module-${module}`, scenario),
    setup: setup ?? [],
    env,
  })),
  ...LANGUAGE_SHAPES.map(({ module, setup, files }) => ({
    id: `language-${module}`,
    config:
      `add_newline = false\nformat = "$${module}"\n\n[${module}]\n` +
      `disabled = false\nformat = "via [$symbol]($style)"\n`,
    scenario: sweepScenario(`language-${module}`, {
      files,
      // The engine hides a language module when its tool is absent; the tool
      // is what the fixture cannot supply, so it is declared present with a
      // version the format no longer prints.
      toolVersions: { [module]: "0.0.0" },
    }),
    setup,
  })),
];
