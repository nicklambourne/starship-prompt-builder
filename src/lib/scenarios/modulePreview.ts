/**
 * A comprehensive, deterministic context for isolated module previews.
 *
 * The reference pages and environment-coverage test share this factory so a
 * module cannot look active in documentation while remaining unreachable in
 * the builder's simulated environment.
 */

import type { ModuleDefinition } from "@/lib/engine/modules/types";
import { getScenario } from ".";
import type { Scenario } from "./types";

const CODE_ENV_VARS = [
  "FOSSIL_ADDED",
  "FOSSIL_BRANCH",
  "FOSSIL_DELETED",
  "GUIX_ENVIRONMENT",
  "MESON_PROJECT_NAME",
  "OPAMSWITCH",
  "OS_CLOUD",
  "PIJUL_CHANNEL",
  "PULUMI_STACK",
  "SINGULARITY_NAME",
  "SPACK_ENV",
  "SSH_CONNECTION",
  "VCSH_REPO_NAME",
];

function environmentVariables(
  modules: readonly ModuleDefinition[],
): Record<string, string> {
  const env: Record<string, string> = {
    MESON_DEVENV: "1",
    SHELL: "/bin/zsh",
  };
  for (const module of modules) {
    for (const option of ["detect_env_vars", "detect_variables"] as const) {
      for (const name of (module.defaults[option] as string[]) ?? []) {
        if (!name.startsWith("!")) env[name] = "1";
      }
    }
  }
  for (const name of CODE_ENV_VARS) env[name] = "1";
  return env;
}

function filesFor(
  name: string,
  modules: readonly ModuleDefinition[],
): string[] {
  const module = modules.find((candidate) => candidate.name === name);
  const files = [".git", ".hg", ".fslckout", ".pijul"];
  if (!module) return files;

  for (const option of ["detect_files", "detect_folders"] as const) {
    for (const file of (module.defaults[option] as string[]) ?? []) {
      if (!file.startsWith("!")) files.push(file);
    }
  }
  for (const extension of (module.defaults.detect_extensions as string[]) ?? []) {
    if (!extension.startsWith("!")) files.push(`file.${extension}`);
  }
  if (name === "package") files.push("package.json");
  if (name === "pulumi") files.push("Pulumi.yaml");
  return files;
}

export function modulePreviewScenario(
  moduleName: string,
  modules: readonly ModuleDefinition[],
): Scenario {
  const base = getScenario("dirty-repo");
  return {
    ...base,
    id: `module-preview-${moduleName}`,
    label: `${moduleName} preview`,
    description: `Deterministic reference preview for ${moduleName}.`,
    path: "/Users/you/code/app",
    readOnly: true,
    files: filesFor(moduleName, modules),
    git: {
      ...base.git!,
      state: "REBASING",
      stateProgress: { current: 2, total: 5 },
      detached: true,
      addedLines: 12,
      deletedLines: 3,
    },
    hgState: "merge",
    ssh: true,
    isRoot: true,
    keymap: "normal",
    shlvl: 3,
    status: 130,
    cmdDurationMs: 9_000,
    jobs: 3,
    battery: { percentage: 8, status: "discharging" },
    terminalWidth: 72,
    netns: { name: "vpn" },
    toolVersions: Object.fromEntries(
      modules.map((module) => [module.name, "1.2.3"]),
    ),
    env: environmentVariables(modules),
    custom: {
      project: { output: "starship-prompt-builder", when: true },
      example: { output: "hello", when: true },
    },
    aws: { profile: "prod", region: "ap-southeast-2", duration: "1h12m" },
    gcloud: {
      account: "you@example.com",
      project: "my-project",
      region: "australia-southeast1",
    },
    azure: { subscription: "Prod", username: "you@example.com" },
    kubernetes: {
      context: "prod",
      namespace: "web",
      user: "you",
      cluster: "prod",
    },
    terraform: { workspace: "default" },
    docker: { context: "desktop" },
    conda: { environment: "science" },
    nats: { name: "local" },
    nix: { name: "shell", impure: true },
    container: { name: "podman" },
  };
}
