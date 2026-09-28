import { describe, expect, it } from "vitest";
import { fillCells, terminalWidth, rightPromptGap } from "./terminalWidth";
describe("shared terminal layout", () => {
  it("cycles whole graphemes and never slices wide or joined glyphs", () => {
    expect(fillCells("漢", 5)).toBe("漢漢");
    expect(fillCells("e\u0301", 3)).toBe("e\u0301e\u0301e\u0301");
    expect(fillCells("👩‍💻", 4)).toBe("👩‍💻👩‍💻");
    expect(terminalWidth(fillCells("漢-", 80))).toBe(80);
    expect(rightPromptGap("漢", "👩‍💻", 4)).toBeNull();
  });
  it("bounds zero-width fills and unreasonable widths", () => {
    expect(fillCells("\u0301", 80)).toBe("");
    expect(fillCells(".", Infinity)).toBe("");
    expect(fillCells(".", 1e9)).toBe("");
  });
});
