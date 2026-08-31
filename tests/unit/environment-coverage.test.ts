/**
 * Every module has to be reachable from the environment panel.
 *
 * A module the panel cannot make visible is a switch that does nothing: it can
 * be enabled, it renders nothing, and no amount of fiddling with the simulated
 * environment changes that. Adding a module without also adding whatever makes
 * it appear is an easy mistake, so this fails the build instead.
 *
 * `modulePreviewScenario` mirrors what `EnvironmentPanel` can produce and is
 * also what the module reference renders. It follows the panel rather than
 * reading it, so deleting a control will not fail this test; the end-to-end
 * suite covers that the controls are actually on screen.
 */

import { describe, expect, it } from "vitest";
import { ALL_MODULES } from "@/lib/engine/modules";
import { renderPrompt } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { segmentsText } from "@/lib/engine/types";
import { modulePreviewScenario } from "@/lib/scenarios/modulePreview";

/**
 * Modules no environment can reveal, because what they show is configuration
 * rather than environment. Anything else belongs in the panel.
 */
const CONFIGURATION_ONLY: Record<string, string> = {
  custom: "runs a command the config supplies; without one there is nothing to run",
  env_var: "shows the variable the config names, so the config is what reveals it",
  line_break: "renders a newline and nothing else, so there is no visible text",
};

function rendersSomething(name: string): boolean {
  const { lines, right } = renderPrompt({
    config: { format: `$${name}`, add_newline: false, [name]: { disabled: false } },
    scenario: modulePreviewScenario(name, ALL_MODULES),
    modules: ALL_MODULES,
    defaultOrder: PROMPT_ORDER,
  });
  const text = lines.map((line) => segmentsText(line)).join("") + segmentsText(right);
  return text.replace(/\s/g, "") !== "";
}

describe("environment coverage", () => {
  for (const module of ALL_MODULES) {
    const reason = CONFIGURATION_ONLY[module.name];
    if (reason) {
      it(`${module.name} is configuration-only: ${reason}`, () => {
        expect(rendersSomething(module.name)).toBe(false);
      });
      continue;
    }

    it(`${module.name} can be made visible from the environment panel`, () => {
      expect(rendersSomething(module.name)).toBe(true);
    });
  }
});
