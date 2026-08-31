import { describe, expect, it } from "vitest";

import { ALL_MODULES } from ".";
import { modulePreviewScenario } from "@/lib/scenarios/modulePreview";
import { claude_context, claude_cost, claude_model } from "./claude";

const scenario = modulePreviewScenario("claude_context", ALL_MODULES);
const context = { scenario, rootConfig: {} };

describe("Claude Code modules", () => {
  it("renders context usage with the matching threshold and partial gauge", () => {
    const result = claude_context.evaluate(claude_context.defaults, context);

    expect(result?.variables).toMatchObject({
      gauge: "███▒░",
      percentage: "65%",
      input_tokens: "124k",
      output_tokens: "6.5k",
      total_tokens: "200k",
    });
    expect(result?.styleVariables).toEqual({ style: "bold yellow" });
  });

  it("honours the default hidden context threshold", () => {
    const lowUsage = {
      ...scenario,
      claude: {
        ...scenario.claude!,
        contextWindow: {
          ...scenario.claude!.contextWindow,
          usedPercentage: 25,
        },
      },
    };

    expect(
      claude_context.evaluate(claude_context.defaults, {
        scenario: lowUsage,
        rootConfig: {},
      }),
    ).toBeNull();
  });

  it("formats cost metrics and selects the matching threshold", () => {
    const result = claude_cost.evaluate(claude_cost.defaults, context);

    expect(result?.variables).toMatchObject({
      cost: "2.46",
      duration: "2m3s",
      api_duration: "1m18s",
      lines_added: "1.2k",
      lines_removed: "340",
    });
    expect(result?.styleVariables).toEqual({ style: "bold yellow" });
  });

  it("uses aliases by model id and exposes the effort level", () => {
    const result = claude_model.evaluate(
      { ...claude_model.defaults, model_aliases: { "claude-sonnet-4-5": "Sonnet" } },
      context,
    );

    expect(result?.variables).toMatchObject({
      model: "Sonnet",
      model_id: "claude-sonnet-4-5",
      effort: "high",
    });
  });
});
