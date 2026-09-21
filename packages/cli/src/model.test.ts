import { describe, expect, it } from "vitest";

import type { StarshipConfig } from "@/lib/engine/prompt";

import {
  changeConfig,
  createTimeline,
  isDirty,
  markSaved,
  editableFormatItems,
  parseEditedValue,
  redoConfig,
  undoConfig,
} from "./model";

describe("configuration timeline", () => {
  it("tracks changes, undo, redo, and the saved baseline", () => {
    const initial: StarshipConfig = { add_newline: true };
    const changed = changeConfig(createTimeline(initial), { add_newline: false });

    expect(isDirty(changed)).toBe(true);
    expect(undoConfig(changed).config).toEqual(initial);
    expect(redoConfig(undoConfig(changed)).config).toEqual({ add_newline: false });
    expect(isDirty(markSaved(changed))).toBe(false);
  });
});

describe("option editing", () => {
  it("parses scalar and structured values without guessing strings", () => {
    expect(parseEditedValue("string", "007")).toBe("007");
    expect(parseEditedValue("number", "7")).toBe(7);
    expect(parseEditedValue("array", '["Cargo.toml"]')).toEqual(["Cargo.toml"]);
    expect(() => parseEditedValue("raw", "not-json")).toThrow("valid JSON");
  });

  it("preserves an unparseable root format as raw source", () => {
    expect(editableFormatItems({ format: "[broken" })).toEqual([
      { kind: "raw", source: "[broken" },
    ]);
  });
});
