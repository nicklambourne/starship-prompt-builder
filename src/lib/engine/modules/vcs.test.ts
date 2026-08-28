import { describe, expect, it } from "vitest";

import { ALL_MODULES } from ".";
import { renderPrompt } from "../prompt";
import { segmentsText } from "../types";
import { getScenario } from "@/lib/scenarios";

describe("vcs", () => {
  it("selects git and renders the configured git module composition", () => {
    const rendered = renderPrompt({
      config: {
        format: "$vcs",
        vcs: { git_modules: "$git_branch$git_status" },
      },
      scenario: getScenario("dirty-repo"),
      modules: ALL_MODULES,
      defaultOrder: [],
    });

    expect(rendered.warnings).toEqual([]);
    expect(rendered.lines.map(segmentsText).join("\n")).toContain("feat/live-preview");
    expect(rendered.lines.map(segmentsText).join("\n")).toContain("[");
  });

  it("uses the first detected VCS in the configured order", () => {
    const scenario = {
      ...getScenario("simple"),
      files: [".hg", ".pijul"],
      env: { PIJUL_CHANNEL: "main" },
    };
    const rendered = renderPrompt({
      config: {
        format: "$vcs",
        vcs: { order: ["pijul", "hg"], pijul_modules: "$pijul_channel" },
        pijul_channel: { disabled: false },
      },
      scenario,
      modules: ALL_MODULES,
      defaultOrder: [],
    });
    expect(rendered.lines.map(segmentsText).join("\n")).toContain("main");
  });

  it("rejects recursive $vcs compositions without crashing the prompt", () => {
    const rendered = renderPrompt({
      config: { format: "$vcs", vcs: { git_modules: "$vcs" } },
      scenario: getScenario("dirty-repo"),
      modules: ALL_MODULES,
      defaultOrder: [],
    });
    expect(rendered.lines.map(segmentsText).join("\n")).toBe("");
    expect(rendered.warnings).toContain("Module vcs cannot include $vcs in its module list.");
  });
});
