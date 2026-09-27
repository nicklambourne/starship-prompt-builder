import { describe, expect, it } from "vitest";

import {
  addNamedModule,
  duplicateNamedModule,
  namedModuleReferenceCount,
  removeNamedModule,
  renameNamedModule,
} from "./namedModules";

describe("named module config edits", () => {
  it("creates and places a new instance in one config change", () => {
    expect(addNamedModule({ format: "$directory" }, "env_var", "SHELL", "$directory"))
      .toEqual({
        format: "$directory${env_var.SHELL}",
        env_var: { SHELL: {} },
      });
  });

  it("rejects invalid or duplicate instance names without changing the config", () => {
    const config = { env_var: { SHELL: {} }, format: "$directory" };
    expect(addNamedModule(config, "env_var", "SHELL", "$directory")).toBe(config);
    expect(addNamedModule(config, "env_var", "bad name", "$directory")).toBe(config);
    expect(renameNamedModule(config, "env_var.SHELL", "bad.name")).toBe(config);
  });

  it("duplicates a named module with its options and a new prompt reference", () => {
    const config = { format: "${custom.project}", custom: { project: { command: "echo hello", symbol: "★ " } } };
    expect(duplicateNamedModule(config, "custom.project", "project_copy", config.format)).toEqual({
      format: "${custom.project}${custom.project_copy}",
      custom: { project: { command: "echo hello", symbol: "★ " }, project_copy: { command: "echo hello", symbol: "★ " } },
    });
  });

  it("renames the table and every prompt-level module reference", () => {
    const config = {
      format: "${custom.project}$directory",
      right_format: "${custom.project}",
      custom: {
        first: { command: "echo first" },
        project: { command: "echo ${custom.project}" },
        last: { command: "echo last" },
      },
      vcs: { git_modules: "$git_branch${custom.project}" },
    };

    expect(renameNamedModule(config, "custom.project", "workspace")).toEqual({
      format: "${custom.workspace}$directory",
      right_format: "${custom.workspace}",
      custom: {
        first: { command: "echo first" },
        workspace: { command: "echo ${custom.project}" },
        last: { command: "echo last" },
      },
      vcs: { git_modules: "$git_branch${custom.workspace}" },
    });
  });

  it("removes the instance and its prompt-level references", () => {
    const config = {
      format: "[$directory${env_var.SHELL}](blue)",
      right_format: "${env_var.SHELL}",
      env_var: { SHELL: { default: "zsh" } },
      vcs: { git_modules: "$git_branch${env_var.SHELL}" },
    };

    expect(removeNamedModule(config, "env_var.SHELL")).toEqual({
      format: "[$directory](blue)",
      right_format: "",
      vcs: { git_modules: "$git_branch" },
    });
  });

  it("counts direct and aggregate references across prompt formats", () => {
    const config = {
      format: "${env_var.SHELL}$env_var",
      right_format: "[${env_var.SHELL}](blue)",
      env_var: { SHELL: { default: "zsh" } },
      vcs: { git_modules: "$git_branch${env_var.SHELL}" },
    };

    expect(namedModuleReferenceCount(config, "env_var.SHELL")).toBe(4);
    expect(namedModuleReferenceCount(config, "directory")).toBe(0);
  });
});
