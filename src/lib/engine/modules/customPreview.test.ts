import { describe, expect, it } from "vitest";

import { createCustomModule } from "./custom";
import { renderPrompt } from "../prompt";
import { segmentsText } from "../types";
import { getScenario } from "@/lib/scenarios";

describe("custom command preview simulation", () => {
  it("uses explicit preview output and a simulated string-condition result", () => {
    const module = createCustomModule("project");
    const scenario = {
      ...getScenario("simple"),
      custom: { project: { output: "workspace", when: true } },
    };
    const visible = renderPrompt({
      config: {
        format: "${custom.project}",
        custom: { project: { command: "echo workspace", when: "test -d .git" } },
      },
      scenario,
      modules: [module],
      defaultOrder: [],
    });
    expect(visible.lines.map(segmentsText).join("\n")).toBe("workspace ");

    const hidden = renderPrompt({
      config: {
        format: "${custom.project}",
        custom: { project: { command: "echo workspace", when: "test -d .git" } },
      },
      scenario: { ...scenario, custom: { project: { output: "workspace", when: false } } },
      modules: [module],
      defaultOrder: [],
    });
    expect(hidden.lines.map(segmentsText).join("\n")).toBe("");
  });
});
