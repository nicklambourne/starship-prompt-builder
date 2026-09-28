import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/scenarios";
import { comparisonHtml, promptPreview, selectedScenarios, selectedWidths } from "./agentWorkflow";

describe("agent visual review", () => {
  it("checks scenario and width selections", () => {
    expect(selectedScenarios("simple,failed-command")).toEqual(["simple", "failed-command"]);
    expect(selectedWidths("40,80")).toEqual([40, 80]);
    expect(() => selectedScenarios("not-a-scenario")).toThrow(/known IDs/);
    expect(() => selectedWidths("0,80")).toThrow(/20 to 500/);
  });

  it("renders the exact custom context and escapes candidate text in the browser report", () => {
    const scenario = { ...getScenario("simple"), id: "my-shell", label: "My <shell>", username: "ada", ssh: true };
    const config = { format: "<img src=x onerror=alert>$username$character" };
    const preview = promptPreview(config, scenario.id, "40", scenario);
    expect(preview.text).toContain("ada");
    const html = comparisonHtml([{ scenario: scenario.id, label: scenario.label, width: 40, before: null, after: preview }], ["format"]);
    expect(html).toContain("My &lt;shell&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert&gt;");
    expect(html).not.toContain("<img src=x onerror=alert>");
  });
});
