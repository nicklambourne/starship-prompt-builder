/** Shared, bounded runtime contract for imported and persisted preview data. */
import type { Scenario } from "./types";

type Check = (value: unknown) => boolean;
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) &&
  Object.keys(v).length <= 4096 && Object.keys(v).every((k) => !forbidden.has(k));
const string: Check = (v) => typeof v === "string" && v.length <= 65536;
const boolean: Check = (v) => typeof v === "boolean";
const number: Check = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const integer: Check = (v) => number(v) && Number.isSafeInteger(v);
const oneOf = (...values: string[]): Check => (v) => typeof v === "string" && values.includes(v);
const optional = (check: Check): Check => (v) => v === undefined || check(v);
const fields = (shape: Record<string, Check>): Check => (v) => record(v) &&
  Object.entries(shape).every(([key, check]) => check(v[key]));
const map = (check: Check): Check => (v) => record(v) && Object.values(v).every(check);
const textFields = (required: string[], optionalKeys: string[] = []): Check => fields({
  ...Object.fromEntries(required.map((key) => [key, string])),
  ...Object.fromEntries(optionalKeys.map((key) => [key, optional(string)])),
});

const basics = fields({
  ...Object.fromEntries(["id", "label", "description", "path", "home", "username", "hostname"].map((k) => [k, string])),
  readOnly: boolean, ssh: boolean, isRoot: boolean,
  files: (v) => Array.isArray(v) && v.length <= 4096 && v.every(string),
  status: integer, cmdDurationMs: number, jobs: integer,
  shell: oneOf("bash", "zsh", "fish", "powershell", "pwsh", "ion", "elvish", "tcsh", "nu", "xonsh", "cmd"),
  keymap: oneOf("insert", "normal", "visual", "replace", "replace_one"),
  time: (v) => string(v) && Number.isFinite(Date.parse(v as string)),
  terminalWidth: (v) => integer(v) && (v as number) >= 20 && (v as number) <= 500,
  env: map(string), toolVersions: map(string),
});
const git = fields({
  commit: string, root: string, detached: boolean, hasRemote: boolean,
  ...Object.fromEntries(["branch", "tag", "remoteBranch", "remoteName"].map((k) => [k, optional(string)])),
  ...Object.fromEntries(["ahead", "behind", "staged", "modified", "deleted", "renamed", "untracked", "conflicted", "stashed"].map((k) => [k, integer])),
  addedLines: optional(integer), deletedLines: optional(integer),
  state: optional(oneOf("REBASING", "MERGING", "CHERRY_PICKING", "BISECTING", "REVERTING", "APPLY_MAILBOX", "APPLY_MAILBOX_REBASE")),
  stateProgress: optional((v) => fields({ current: integer, total: integer })(v) &&
    (v as { current: number }).current <= (v as { total: number }).total),
});
const contexts: Record<string, Check> = {
  signal: string, shlvl: integer,
  battery: fields({ percentage: (v) => number(v) && (v as number) <= 100, status: oneOf("charging", "discharging", "full", "unknown") }),
  aws: textFields([], ["profile", "region", "duration"]),
  gcloud: textFields([], ["account", "project", "region"]),
  azure: textFields([], ["subscription", "username"]),
  kubernetes: textFields(["context"], ["namespace", "user", "cluster"]),
  terraform: textFields(["workspace"]), nix: fields({ name: optional(string), impure: boolean }),
  conda: textFields(["environment"]), python: textFields([], ["virtualenv"]),
  container: textFields(["name"]), docker: textFields(["context"]),
  nats: textFields(["name"]), netns: textFields(["name"]),
  os: fields({ name: string, codename: optional(string), type: oneOf("Macos", "Linux", "Windows", "Ubuntu", "Debian", "Fedora", "Arch", "Alpine", "NixOS", "Raspbian", "Redhat", "Unknown") }),
  direnv: fields({ loaded: boolean, allowed: oneOf("allowed", "not-allowed", "denied") }),
  hgState: oneOf("merge", "rebase", "update", "bisect", "shelve", "graft", "transplant", "histedit"),
};

export function scenarioError(value: unknown): string | null {
  if (!record(value) || !basics(value)) return "Scenario is missing required preview fields or has invalid values.";
  if (!optional(git)(value.git)) return "Scenario git state is incomplete or invalid.";
  if (!optional(map(fields({ output: string, when: boolean })))(value.custom)) {
    return "Scenario custom results must contain simulated output and when values.";
  }
  for (const [key, check] of Object.entries(contexts)) {
    if (!optional(check)(value[key])) return `Scenario has an invalid optional preview context: ${key}.`;
  }
  return null;
}

export function isScenario(value: unknown): value is Scenario {
  return scenarioError(value) === null;
}
