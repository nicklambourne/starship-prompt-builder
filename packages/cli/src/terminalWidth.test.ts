import { describe, expect, it } from "vitest";
import { rightPromptGap, terminalWidth } from "./terminalWidth";

describe("terminal cells", () => {
  it("counts combining characters, CJK, and emoji as terminal graphemes", () => {
    expect(terminalWidth("e\u0301漢👩‍💻")).toBe(5);
  });

  it("aligns right prompts and hides one that would overlap", () => {
    expect(rightPromptGap("a漢", "✓", 10)).toBe(6);
    expect(rightPromptGap("a漢", "✓", 4)).toBeNull();
  });
});
