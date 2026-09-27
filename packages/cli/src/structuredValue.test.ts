import { describe, expect, it } from "vitest";
import { addValue, initialArrayEntry, parseScalarLike, removeValue, renameValue, updateValue, valueAt } from "./structuredValue";

describe("guided structured option edits", () => {
  it("edits one battery field without dropping unknown fields", () => {
    const before = [{ threshold: 15, style: "green", future: "preserve" }];
    const after = updateValue(before, [0, "threshold"], 20);
    expect(after).toEqual([{ threshold: 20, style: "green", future: "preserve" }]);
    expect(before[0].threshold).toBe(15);
  });

  it("adds, renames, and removes map values without touching neighbors", () => {
    const before = { Documents: "📁", Downloads: "↓" };
    const added = addValue(before, [], "Pictures", "▣");
    const renamed = renameValue(added, ["Pictures"], "Photos");
    expect(removeValue(renamed, ["Downloads"])).toEqual({ Documents: "📁", Photos: "▣" });
    expect(valueAt(before, ["Documents"])).toBe("📁");
  });

  it("creates purpose-specific rule defaults and parses scalar fields", () => {
    expect(initialArrayEntry("battery-display")).toEqual({ threshold: 10, style: "red bold" });
    expect(initialArrayEntry("command-list")).toEqual([""]);
    expect(parseScalarLike(10, "42")).toBe(42);
    expect(() => parseScalarLike(true, "perhaps")).toThrow();
  });
});
