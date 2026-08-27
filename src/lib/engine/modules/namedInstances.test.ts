import { describe, expect, it } from "vitest";

import { renderPrompt } from "../prompt";
import {
  moduleDefinitionsForConfig,
  moduleOptionsForConfig,
} from "./index";
import { getScenario } from "@/lib/scenarios";

function text(config: Record<string, unknown>): string {
  const rendered = renderPrompt({
    config,
    scenario: getScenario("simple"),
    modules: moduleDefinitionsForConfig(config),
    defaultOrder: ["env_var", "custom"],
  });
  return rendered.lines
    .flat()
    .filter((segment) => segment.kind === "text")
    .map((segment) => segment.value)
    .join("");
}

describe("named module instances", () => {
  it("builds one definition per nested custom and env_var table", () => {
    const config = {
      env_var: { SHELL: { default: "zsh" }, EDITOR: { default: "nvim" } },
      custom: { project: { when: true } },
    };

    expect(moduleDefinitionsForConfig(config).map((module) => module.name)).toEqual(
      expect.arrayContaining(["env_var.SHELL", "env_var.EDITOR", "custom.project"]),
    );
    expect(moduleOptionsForConfig(config, "env_var.SHELL")).toEqual({ default: "zsh" });
    expect(moduleOptionsForConfig(config, "custom.project")).toEqual({ when: true });
  });

  it("renders a named instance referenced directly", () => {
    expect(text({
      format: "${env_var.SHELL}${custom.project}",
      env_var: {
        SHELL: { default: "zsh", format: "[$env_value]($style)" },
      },
      custom: {
        project: { when: true, symbol: "P", format: "[$symbol]($style)" },
      },
    })).toBe("zshP");
  });

  it("aggregates named instances through the family variable", () => {
    expect(text({
      format: "$env_var$custom",
      env_var: {
        SHELL: { default: "zsh", format: "[$env_value]($style)" },
        EDITOR: { default: "nvim", format: "[$env_value]($style)" },
      },
      custom: {
        project: { when: true, symbol: "P", format: "[$symbol]($style)" },
      },
    })).toBe("zshnvimP");
  });

  it("does not repeat an explicitly placed instance through $all", () => {
    expect(text({
      format: "${env_var.EDITOR}$all",
      env_var: {
        SHELL: { default: "zsh", format: "[$env_value]($style)" },
        EDITOR: { default: "nvim", format: "[$env_value]($style)" },
      },
    })).toBe("nvimzsh");
  });
});
