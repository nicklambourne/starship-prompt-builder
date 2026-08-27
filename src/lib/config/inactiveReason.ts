/**
 * Why an enabled module still renders nothing.
 *
 * Several modules are on by default yet stay invisible until the environment
 * says otherwise — `username` only appears as root or over SSH, `hostname`
 * only over SSH, most language modules only when their tool and a matching
 * file are both present. That is faithful to starship, but a switch reading
 * "on" beside an empty prompt looks like a bug, so the interface says which
 * condition has not been met.
 *
 * The generic fallback is deliberately vague rather than wrong: it points at
 * the environment panel instead of guessing at a reason.
 */

import { VERSIONED_MODULE_NAMES } from "@/lib/engine/modules/language";
import type { Scenario } from "@/lib/scenarios/types";

const GENERIC =
  "Nothing to show in the simulated environment — adjust it below the preview.";

/**
 * The one thing a module is waiting for, where its implementation names
 * something specific. Every line here is what the module actually reads, so
 * these have to be revisited when a module changes what it looks at.
 */
export const WAITING_FOR: Record<string, string> = {
  azure: "No Azure subscription — set one under Cloud & orchestration.",
  conda: "No Conda environment — set one under Cloud & orchestration.",
  docker_context:
    "Set a Docker context under Cloud & orchestration. It also needs a Dockerfile or a compose file in the directory, unless only_with_files is off.",
  nats: "No NATS context — set one under Cloud & orchestration.",
  netns: "No network namespace — set one under System.",

  git_commit:
    "starship only shows the commit on a detached HEAD. Turn on “Detached HEAD” under Version control, or set only_detached to false below.",
  git_metrics:
    "Nothing has changed by line count — set “Lines added” or “Lines deleted” under Version control, or turn off only_nonzero_diffs below.",
  hg_branch:
    "Not a Mercurial check-out — turn on “Inside a Mercurial repository” under Version control.",
  hg_state:
    "No Mercurial operation in progress — turn on “Inside a Mercurial repository” under Version control and pick one.",

  // Modules starship reads out of one environment variable, which is what the
  // environment variables editor is for.
  fossil_branch: "Set FOSSIL_BRANCH under Environment variables.",
  fossil_metrics: "Set FOSSIL_ADDED or FOSSIL_DELETED under Environment variables.",
  guix_shell:
    "Set GUIX_ENVIRONMENT under Environment variables — that is what tells starship you are inside a guix shell.",
  openstack: "Set OS_CLOUD under Environment variables.",
  pijul_channel: "Set PIJUL_CHANNEL under Environment variables.",
  pulumi:
    "Put a Pulumi.yaml in the directory, and set PULUMI_STACK under Environment variables.",
  singularity: "Set SINGULARITY_NAME under Environment variables.",
  spack: "Set SPACK_ENV under Environment variables.",
  vcsh: "Set VCSH_REPO_NAME under Environment variables.",
  meson:
    "Set MESON_DEVENV to 1 and MESON_PROJECT_NAME to the project's name under Environment variables.",

  custom: "A custom module shows what its own command prints — give it one below.",
  env_var: "Name a variable below, then set it under Environment variables.",
};

/** Something from the module's detection rules to put in the directory. */
function exampleFile(options: Record<string, unknown>): string | undefined {
  const first = (key: string): string | undefined =>
    (options[key] as string[] | undefined)?.find((entry) => !entry.startsWith("!"));
  const file = first("detect_files") ?? first("detect_folders");
  if (file) return file;
  const extension = first("detect_extensions");
  return extension ? `.${extension} file` : undefined;
}

export function inactiveReason(
  moduleName: string,
  scenario: Scenario,
  options: Record<string, unknown>,
): string {
  switch (moduleName) {
    case "username":
      // starship: shown when root, over SSH, or with show_always.
      if (!scenario.isRoot && !scenario.ssh) {
        return "starship only shows your username when you are root or connected over SSH. Turn on “Connected over SSH” or “Running as root” in the simulated environment, or set show_always below.";
      }
      break;

    case "hostname":
      if (!scenario.ssh && options.ssh_only !== false) {
        return "starship only shows the hostname over SSH. Turn on “Connected over SSH” in the simulated environment, or set ssh_only to false below.";
      }
      break;

    case "battery":
      if (!scenario.battery) {
        return "No battery in the simulated environment — turn one on under System.";
      }
      return "The charge is above every display threshold, so starship hides it.";

    case "git_branch":
    case "git_commit":
    case "git_state":
    case "git_status":
    case "git_metrics":
      if (!scenario.git) {
        return "Not inside a git repository — turn one on under Version control.";
      }
      break;

    case "cmd_duration":
      return "The last command was faster than min_time, so starship hides it.";

    case "jobs":
      return "No background jobs in the simulated environment.";

    case "status":
      if (scenario.status === 0) {
        return "The last command succeeded; status only shows a failure.";
      }
      break;
  }

  const template = moduleName.startsWith("env_var.")
    ? "env_var"
    : moduleName.startsWith("custom.")
      ? "custom"
      : moduleName;
  const waiting = WAITING_FOR[template];
  if (waiting) return waiting;

  // Language and toolchain modules need two things, and which one is missing
  // is the difference between "install it" and "you are in the wrong folder".
  if (VERSIONED_MODULE_NAMES.has(moduleName)) {
    const example = exampleFile(options);
    if (scenario.toolVersions[moduleName] === undefined) {
      return `starship reads the version by running the tool, so “${moduleName}” needs one under Installed tools${
        example ? `, alongside a ${example} in the directory` : ""
      }.`;
    }
    if (example) {
      return `Nothing in the directory looks like a ${moduleName} project — add a ${example} under Directory.`;
    }
  }

  return GENERIC;
}
