import { describe, expect, it } from "vitest";

import { ALL_MODULES } from ".";
import { renderPrompt } from "../prompt";
import { segmentsText } from "../types";
import { getScenario } from "@/lib/scenarios";
import type { GitOperation } from "@/lib/scenarios/types";

function renderGitState(state: GitOperation): string {
  const base = getScenario("rebase");
  const rendered = renderPrompt({
    config: { format: "$git_state", add_newline: false },
    scenario: {
      ...base,
      git: {
        ...base.git!,
        state,
        stateProgress: { current: 2, total: 5 },
      },
    },
    modules: ALL_MODULES,
    defaultOrder: [],
  });

  expect(rendered.warnings).toEqual([]);
  return rendered.lines.map(segmentsText).join("\n");
}

describe("git_state", () => {
  it.each([
    ["REBASING", "(REBASING 2/5) "],
    ["APPLY_MAILBOX", "(AM 2/5) "],
    ["APPLY_MAILBOX_REBASE", "(AM/REBASE 2/5) "],
  ] as const)("renders progress for %s", (state, expected) => {
    expect(renderGitState(state)).toBe(expected);
  });

  it("omits progress for operations that do not expose it upstream", () => {
    const base = getScenario("rebase");
    const rendered = renderPrompt({
      config: { format: "$git_state", add_newline: false },
      scenario: {
        ...base,
        git: { ...base.git!, state: "MERGING", stateProgress: { current: 2, total: 5 } },
      },
      modules: ALL_MODULES,
      defaultOrder: [],
    });

    expect(rendered.lines.map(segmentsText).join("\n")).toBe("(MERGING) ");
  });
});
