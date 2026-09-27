import { describe, expect, it } from "vitest";
import { replaceStyleToken, setStyleColor } from "./styleEditor";

describe("style token controls", () => {
  it("changes a color without discarding modifiers and inherited variables", () => {
    expect(setStyleColor("bold red bg:blue $style", "fg", "#123456"))
      .toBe("bold bg:blue $style fg:#123456");
    expect(setStyleColor("bold fg:red bg:blue", "bg", "ocean"))
      .toBe("bold fg:red bg:ocean");
  });

  it("removes one token without changing the others", () => {
    expect(replaceStyleToken("bold fg:red underline", 1, "")).toBe("bold underline");
  });
});
