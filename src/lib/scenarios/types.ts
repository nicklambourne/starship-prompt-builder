/**
 * A Scenario is a mocked shell context: everything starship would normally
 * read from the environment, supplied as plain data so the engine stays pure
 * and the preview is deterministic.
 */

export interface GitState {
  /** Current branch name, or undefined when detached. */
  branch?: string;
  /** Short commit hash, used by `git_commit` and by detached HEAD display. */
  commit: string;
  /** Tag pointing at HEAD, if any. */
  tag?: string;
  detached: boolean;
  /** In-progress operation: REBASING, MERGING, CHERRY-PICKING, BISECTING, REVERTING. */
  state?: "REBASING" | "MERGING" | "CHERRY_PICKING" | "BISECTING" | "REVERTING";
  /** Progress through a multi-step operation, e.g. rebase 2/5. */
  stateProgress?: { current: number; total: number };
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  deleted: number;
  renamed: number;
  untracked: number;
  conflicted: number;
  stashed: number;
  /**
   * Line counts from `git diff --shortstat`, which `git_metrics` reports.
   * Optional because every other consumer works from the file-level counts
   * above; absent reads as zero, which is what an unmodified tree gives.
   */
  addedLines?: number;
  deletedLines?: number;
  /** Absolute path of the repository root, for `truncate_to_repo`. */
  root: string;
  /** Whether the remote tracking branch exists. */
  hasRemote: boolean;
  remoteBranch?: string;
  remoteName?: string;
}

export interface BatteryState {
  percentage: number;
  status: "charging" | "discharging" | "full" | "unknown";
}

export interface Scenario {
  id: string;
  label: string;
  description: string;

  /** Absolute working directory, using `~` semantics via `home`. */
  path: string;
  home: string;
  /** Whether the cwd is read-only, for `directory.read_only`. */
  readOnly: boolean;

  /**
   * Files and directories visible in the cwd, as a flat listing of names.
   * Used by every module's detect_files / detect_folders / detect_extensions.
   */
  files: string[];

  git?: GitState;

  /** Exit code of the previous command. */
  status: number;
  /** Signal name when the previous command was killed, e.g. SIGINT. */
  signal?: string;
  /** Duration of the previous command in milliseconds. */
  cmdDurationMs: number;
  /** Number of background jobs. */
  jobs: number;

  username: string;
  hostname: string;
  /** Whether this is an SSH session — makes username/hostname show by default. */
  ssh: boolean;
  /** Whether the user is root — username shows and uses root_style. */
  isRoot: boolean;

  shell: "bash" | "zsh" | "fish" | "powershell" | "pwsh" | "ion" | "elvish" | "tcsh" | "nu" | "xonsh" | "cmd";
  /** Vim keymap for `character`: insert / normal / visual / replace. */
  keymap: "insert" | "normal" | "visual" | "replace" | "replace_one";

  /** Fixed clock, so renders are deterministic. ISO 8601 local time. */
  time: string;

  battery?: BatteryState;

  /** Terminal width in columns, used by `fill` and right prompts. */
  terminalWidth: number;

  /**
   * Versions reported by tool binaries present on PATH, keyed by module name
   * (e.g. `nodejs` → "22.19.0"). A module whose key is absent behaves as if
   * the tool is not installed.
   */
  toolVersions: Record<string, string>;

  /** Environment variables, for `env_var` and context modules. */
  env: Record<string, string>;

  /** Explicit browser-only results for custom commands the preview cannot run. */
  custom?: Record<string, { output: string; when: boolean }>;

  /** Cloud and orchestration context. */
  aws?: { profile?: string; region?: string; duration?: string };
  gcloud?: { account?: string; project?: string; region?: string };
  azure?: { subscription?: string; username?: string };
  kubernetes?: { context: string; namespace?: string; user?: string; cluster?: string };
  terraform?: { workspace: string };
  nix?: { name?: string; impure: boolean };
  conda?: { environment: string };
  python?: { virtualenv?: string };
  container?: { name: string };
  docker?: { context: string };
  os?: { name: string; codename?: string; type: OsType };

  /** Shell nesting depth, for the `shlvl` module. */
  shlvl?: number;
  /** NATS context name, for the `nats` module. */
  nats?: { name: string };
  /** Linux network namespace, for the `netns` module. */
  netns?: { name: string };
  /** direnv status, for the `direnv` module. */
  direnv?: { loaded: boolean; allowed: "allowed" | "not-allowed" | "denied" };
  /** In-progress Mercurial operation, for the `hg_state` module. */
  hgState?:
    | "merge"
    | "rebase"
    | "update"
    | "bisect"
    | "shelve"
    | "graft"
    | "transplant"
    | "histedit";
}

export type OsType =
  | "Macos"
  | "Linux"
  | "Windows"
  | "Ubuntu"
  | "Debian"
  | "Fedora"
  | "Arch"
  | "Alpine"
  | "NixOS"
  | "Raspbian"
  | "Redhat"
  | "Unknown";
