/**
 * Parity fixtures.
 *
 * Each case pairs a Scenario (what the engine renders from) with instructions
 * for materialising the equivalent real directory (what starship renders from),
 * so the two can be compared byte for byte.
 *
 * Every case pins an explicit config that enables ONLY the modules under test.
 * That is deliberate: without it, whatever happens to be installed on the
 * machine running the tests (a node version, an AWS profile, a git config)
 * leaks into starship's output but not the engine's, and the comparison
 * measures the runner rather than the implementation.
 */

import type { Scenario } from "@/lib/scenarios/types";

export interface ParityCase {
  id: string;
  /** Modules deliberately asserted by this fixture; empty for formatter-only cases. */
  modules: string[];
  side?: "left" | "right";
  /** TOML config passed to starship via STARSHIP_CONFIG. */
  config: string;
  scenario: Scenario;
  /** Shell commands run inside the fixture directory to build its state. */
  setup: string[];
  /**
   * Extra environment for the real binary. Several modules read the
   * environment rather than the filesystem, and the engine reads the same
   * values from `scenario.env`, so a case that sets one must set both.
   */
  env?: Record<string, string>;
  /**
   * False for a case whose whole point is that nothing is printed. Everything
   * else must print something, or it agrees vacuously.
   */
  expectsOutput?: boolean;
}

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

function scenario(id: string, overrides: Partial<Scenario>): Scenario {
  return { ...BASE, id, label: id, description: id, ...overrides };
}

/** Git setup shared by every repo fixture; keeps commits reproducible. */
const GIT_INIT = [
  "git init -q -b main",
  "git config user.email tester@example.com",
  "git config user.name Tester",
  "git config commit.gpgsign false",
  "touch tracked.txt",
  "git add tracked.txt",
  "git -c commit.gpgsign=false commit -q -m initial",
];

export const PARITY_CASES: ParityCase[] = [
  ...["漢", "e\u0301", "👩‍💻"].map((glyph, index) => ({
    id: `unicode-fill-${index}`,
    modules: ["fill"],
    config: `add_newline = false\nformat = "${glyph}$fill"\n[fill]\nsymbol = "${glyph}"\nstyle = "none"\n`,
    scenario: scenario(`unicode-fill-${index}`, { terminalWidth: 20 }), setup: [],
  })),
  {
    id: "right-prompt-only", side: "right",
    modules: ["character"],
    config: 'add_newline = false\nformat = "left"\nright_format = "[右](green)$character"\n',
    scenario: scenario("right-prompt-only", {}), setup: [],
  },
  {
    id: "named-env-and-custom",
    modules: ["env_var","custom"],
    config: 'add_newline = false\nformat = "${env_var.TEST}${custom.demo}"\n[env_var.TEST]\nvariable = "PARITY_MARKER"\n[custom.demo]\nshell = ["sh"]\ncommand = "printf parity-custom"\nwhen = true\n',
    scenario: scenario("named-env-and-custom", { env: { PARITY_MARKER: "named" }, custom: { demo: { output: "parity-custom", when: true } } }),
    env: { PARITY_MARKER: "named" }, setup: [],
  },
  {
    id: "directory-regex-named-capture",
    modules: ["directory"],
    config: 'add_newline = false\nformat = "$directory"\n[directory]\nsubstitutions = [{from = "(?P<home>~)", to = "${home}/ok", regex = true}]\n',
    scenario: scenario("directory-regex-named-capture", {}), setup: [],
  },
  {
    id: "kubernetes-regex-alias",
    modules: ["kubernetes"],
    config: 'add_newline = false\nformat = "$kubernetes"\n[kubernetes]\ndisabled = false\ncontexts = [{context_pattern = "(?P<team>prod)-(.*)", context_alias = "${team}:$2"}]\n',
    scenario: scenario("kubernetes-regex-alias", { kubernetes: { context: "prod-west", namespace: "demo" } }),
    env: { KUBECONFIG: "kubeconfig" },
    setup: ["printf '%s' '{\"apiVersion\":\"v1\",\"kind\":\"Config\",\"current-context\":\"prod-west\",\"contexts\":[{\"name\":\"prod-west\",\"context\":{\"namespace\":\"demo\"}}]}' > kubeconfig"],
  },
  {
    id: "character-success",
    modules: ["character"],
    config: `
format = "$character"
add_newline = false
`,
    scenario: scenario("character-success", { status: 0 }),
    setup: [],
  },
  {
    id: "character-error",
    modules: ["character"],
    config: `
format = "$character"
add_newline = false
`,
    scenario: scenario("character-error", { status: 1 }),
    setup: [],
  },
  {
    id: "character-custom-symbols",
    modules: ["character"],
    config: `
format = "$character"
add_newline = false

[character]
success_symbol = "[➜](bold green)"
error_symbol = "[✗](bold red)"
`,
    scenario: scenario("character-custom-symbols", { status: 1 }),
    setup: [],
  },
  {
    id: "directory-plain",
    modules: ["directory"],
    config: `
format = "$directory"
add_newline = false
`,
    scenario: scenario("directory-plain", {}),
    setup: ["mkdir -p alpha/beta/gamma"],
  },
  {
    id: "directory-truncated",
    modules: ["directory"],
    config: `
format = "$directory"
add_newline = false

[directory]
truncation_length = 2
truncation_symbol = "…/"
`,
    scenario: scenario("directory-truncated", {}),
    setup: ["mkdir -p alpha/beta/gamma"],
  },
  {
    id: "directory-styled",
    modules: ["directory"],
    config: `
format = "$directory"
add_newline = false

[directory]
style = "bold fg:#af8700 bg:blue"
`,
    scenario: scenario("directory-styled", {}),
    setup: ["mkdir -p alpha/beta/gamma"],
  },
  {
    id: "git-branch-clean",
    modules: ["git_branch"],
    config: `
format = "$git_branch"
add_newline = false
`,
    scenario: scenario("git-branch-clean", {
      git: {
        branch: "main",
        commit: "0000000",
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
        root: "",
        hasRemote: false,
      },
    }),
    setup: GIT_INIT,
  },
  {
    id: "vcs-git-dispatch",
    modules: ["vcs"],
    config: `
format = "$vcs"
add_newline = false

[vcs]
git_modules = "$git_branch"
`,
    scenario: scenario("vcs-git-dispatch", {
      git: {
        branch: "main",
        commit: "0000000",
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
        root: "",
        hasRemote: false,
      },
    }),
    setup: GIT_INIT,
  },
  {
    id: "git-status-dirty",
    modules: ["git_status"],
    config: `
format = "$git_status"
add_newline = false
`,
    scenario: scenario("git-status-dirty", {
      git: {
        branch: "main",
        commit: "0000000",
        detached: false,
        ahead: 0,
        behind: 0,
        staged: 1,
        modified: 1,
        deleted: 0,
        renamed: 0,
        untracked: 1,
        conflicted: 0,
        stashed: 0,
        root: "",
        hasRemote: false,
      },
    }),
    setup: [
      ...GIT_INIT,
      "echo change >> tracked.txt",
      "touch staged.txt",
      "git add staged.txt",
      "touch untracked.txt",
    ],
  },
  {
    id: "git-state-am-progress",
    modules: ["git_state"],
    config: `
format = "$git_state"
add_newline = false
`,
    scenario: scenario("git-state-am-progress", {
      git: {
        branch: "main",
        commit: "0000000",
        detached: false,
        state: "APPLY_MAILBOX",
        stateProgress: { current: 1, total: 1 },
        ahead: 0,
        behind: 0,
        staged: 0,
        modified: 0,
        deleted: 0,
        renamed: 0,
        untracked: 1,
        conflicted: 1,
        stashed: 0,
        root: "",
        hasRemote: false,
      },
    }),
    setup: [
      ...GIT_INIT,
      "git switch -q -c patch",
      "printf 'from patch\\n' > tracked.txt",
      "git add tracked.txt",
      "git -c commit.gpgsign=false commit -q -m patch",
      "git format-patch -1 --stdout > change.patch",
      "git switch -q main",
      "printf 'from main\\n' > tracked.txt",
      "git add tracked.txt",
      "git -c commit.gpgsign=false commit -q -m main",
      "git am change.patch || test -d .git/rebase-apply",
    ],
  },
  {
    id: "cmd-duration",
    modules: ["cmd_duration"],
    config: `
format = "$cmd_duration"
add_newline = false
`,
    scenario: scenario("cmd-duration", { cmdDurationMs: 3210 }),
    setup: [],
  },
  {
    id: "status-failure",
    modules: ["status"],
    config: `
format = "$status"
add_newline = false

[status]
disabled = false
`,
    scenario: scenario("status-failure", { status: 127 }),
    setup: [],
  },
  {
    id: "jobs",
    modules: ["jobs"],
    config: `
format = "$jobs"
add_newline = false

[jobs]
number_threshold = 1
`,
    scenario: scenario("jobs", { jobs: 3 }),
    setup: [],
  },
  {
    id: "format-conditionals",
    modules: [],
    config: `
format = "[a](red)(b$missing)([c]($style))[d](bold blue) "
add_newline = false
`,
    scenario: scenario("format-conditionals", {}),
    setup: [],
  },
  {
    id: "format-escapes",
    modules: [],
    config: `
format = "\\\\[literal\\\\] \\\\(parens\\\\) \\\\$dollar "
add_newline = false
`,
    scenario: scenario("format-escapes", {}),
    setup: [],
  },
  {
    id: "palette",
    modules: [],
    config: `
format = "[text](mauve) "
add_newline = false
palette = "catppuccin"

[palettes.catppuccin]
mauve = "#cba6f7"
`,
    scenario: scenario("palette", {}),
    setup: [],
  },
  {
    id: "nested-groups",
    modules: [],
    config: `
format = "[outer [inner](red) tail](bold blue) "
add_newline = false
`,
    scenario: scenario("nested-groups", {}),
    setup: [],
  },
  {
    /*
     * A conditional holding no variables renders nothing, which is what the
     * editor writes when a piece of text is switched off. The whole feature
     * rests on starship agreeing, so it is checked against the binary rather
     * than against this port's reading of the grammar.
     */
    id: "switched-off-text",
    modules: [],
    config: `
format = "A(off)B([styled](red))C(  )D"
add_newline = false
`,
    scenario: scenario("switched-off-text", {}),
    setup: [],
  },
];
