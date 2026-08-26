import { describe, expect, it } from "vitest";
import { MODULES_BY_NAME } from "../engine/modules";
import { MODULE_META } from "./meta";
import { styleOptionFallback, styleRulesFor } from "./styleOptions";

describe("style option inheritance", () => {
  it("uses each named option's own default, not an invented module style", () => {
    for (const name of ["username", "git_metrics", "fossil_metrics", "directory", "golang", "nodejs", "status"]) {
      const defaults = MODULES_BY_NAME.get(name)!.defaults;
      for (const key of MODULE_META[name].styleOptions.filter((key) => key !== "style")) {
        const fallback = styleOptionFallback(defaults, { style: "blue" }, key);
        expect(fallback.value, `${name}.${key}`).toBe(
          typeof defaults[key] === "string" ? defaults[key] : "blue",
        );
      }
    }
  });

  it("keeps an explicitly empty module fallback empty", () => {
    expect(styleOptionFallback({ style: "red" }, { style: "" }, "success_style").value).toBe("");
  });

  it("uses battery's display default and Kubernetes' live module style", () => {
    const battery = MODULES_BY_NAME.get("battery")!.defaults;
    const kubernetes = MODULES_BY_NAME.get("kubernetes")!.defaults;
    expect(styleRulesFor("battery", "display", battery, {})?.fallback.value).toBe("red bold");
    expect(styleRulesFor("kubernetes", "contexts", kubernetes, { style: "peach" })?.fallback)
      .toEqual({ value: "peach", source: "Module style" });
    expect(styleRulesFor("kubernetes", "detect_files", kubernetes, {})).toBeUndefined();
  });
});
