import { describe, expect, it } from "vitest";

import { MODULE_REFERENCES } from "./modules";
import { renderModuleReferencePreview } from "./modulePreviews";

describe("renderModuleReferencePreview", () => {
  it("renders a meaningful deterministic example for every module reference", () => {
    const missing: string[] = [];
    const unsupported: string[] = [];
    const warnings: Record<string, string[]> = {};
    for (const reference of MODULE_REFERENCES) {
      const rendered = renderModuleReferencePreview(reference);
      if (!rendered) {
        unsupported.push(reference.moduleName);
        continue;
      }
      const text = [...rendered.lines.flat(), ...rendered.right]
        .map((segment) => (segment.kind === "lineTerm" ? "" : segment.value))
        .join("");

      if (rendered.warnings.length > 0) {
        warnings[reference.moduleName] = rendered.warnings;
      }
      if (text.length === 0 && rendered.lines.length <= 1) {
        missing.push(reference.moduleName);
      }
    }
    expect(warnings).toEqual({});
    expect(missing).toEqual([]);
    expect(unsupported).toEqual([
      "claude_context",
      "claude_cost",
      "claude_model",
    ]);
  });
});
