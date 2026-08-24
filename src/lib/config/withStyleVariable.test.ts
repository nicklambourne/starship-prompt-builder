import { describe, expect, it } from "vitest";

import { withStyleVariable } from "@/lib/config/formatItems";

describe("withStyleVariable", () => {
  it("puts the reference back over a literal on a single piece", () => {
    expect(withStyleVariable("[$symbol](red)")).toBe("[$symbol]($style)");
    expect(withStyleVariable("[hello](bold blue)")).toBe("[hello]($style)");
  });

  it("wraps a format that has nowhere obvious to put it", () => {
    expect(withStyleVariable("$symbol")).toBe("[$symbol]($style)");
    expect(withStyleVariable("[$a](red)[$b](blue)")).toBe("[[$a](red)[$b](blue)]($style)");
  });

  it("leaves a format it cannot read alone", () => {
    expect(withStyleVariable("[$symbol")).toBe("[$symbol");
  });

  it("is idempotent where the reference is already spent", () => {
    expect(withStyleVariable("[$symbol]($style)")).toBe("[$symbol]($style)");
  });
});
