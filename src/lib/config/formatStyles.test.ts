import { describe, expect, it } from "vitest";
import { getModule } from "@/lib/engine/modules";
import { renderFormatString } from "@/lib/engine/render";
import { parseStyleString } from "@/lib/engine/styleString";
import { getScenario } from "@/lib/scenarios";
import { toItems } from "./formatItems";
import { formatItemStyle, moduleFormatStyles, resolveFormatStyle } from "./formatStyles";

describe("inherited format swatches", () => {
  it("resolves a bare child through its enclosing group without changing the tree", () => {
    const items = toItems("[hello $user]($style)")!;
    const before = structuredClone(items);
    expect(formatItemStyle(items, [0, 0], { style: "bold peach bg:blue" })).toBe("bold peach bg:blue");
    expect(formatItemStyle(items, [0, 1], { style: "bold peach bg:blue" })).toBe("bold peach bg:blue");
    expect(items).toEqual(before);
  });

  it("uses the nearest style and does not inherit across explicit resets", () => {
    const items = toItems("[[hello $user](blue) [$path](none) [$host foo]()]($style)")!;
    expect(formatItemStyle(items, [0, 0, 1], { style: "red" })).toBe("blue");
    expect(formatItemStyle(items, [0, 2], { style: "red" })).toBe("none");
    expect(formatItemStyle(items, [0, 4, 0], { style: "red" })).toBe("");
    expect(formatItemStyle(toItems("$user")!, [0], { style: "red" })).toBeUndefined();
  });

  it("resolves braced, named and mixed references exactly as the formatter does", () => {
    const variables = { style: "bold red", added_style: "green", deleted_style: "blue" };
    for (const source of ["${style}", "$added_style", "$deleted_style italic", "$missing underline", "bg:#123456 $style"]) {
      const rendered = renderFormatString(`[x](${source})`, {
        variables: new Map(), styleVariables: new Map(Object.entries(variables)),
      });
      expect(parseStyleString(resolveFormatStyle(source, variables))).toEqual(rendered[0].kind === "text" ? rendered[0].style : undefined);
    }
  });

  it("uses username's active user/root option, not a nonexistent style option", () => {
    const username = getModule("username")!;
    const config = { username: { show_always: true, style_user: "green", style_root: "red" } };
    expect(moduleFormatStyles(username, config, getScenario("simple")).style).toBe("green");
    expect(moduleFormatStyles(username, config, { ...getScenario("simple"), isRoot: true }).style).toBe("red");
  });

  it("uses status's active style and directory's optional-style fallback", () => {
    const status = getModule("status")!;
    const config = { status: { success_symbol: "OK", style: "blue", success_style: "green", failure_style: "red" } };
    expect(moduleFormatStyles(status, config, getScenario("simple")).style).toBe("green");
    expect(moduleFormatStyles(status, config, getScenario("failed-command")).style).toBe("red");
    expect(moduleFormatStyles(getModule("directory")!, { directory: { style: "peach" } }, getScenario("simple")).repo_root_style).toBe("peach");
  });

  it("resolves metrics' named styles and keeps available defaults for inactive modules", () => {
    expect(moduleFormatStyles(getModule("git_metrics")!, { git_metrics: { added_style: "peach" } }, getScenario("dirty-repo")))
      .toMatchObject({ added_style: "peach", deleted_style: "bold red" });
    expect(moduleFormatStyles(getModule("nodejs")!, { nodejs: { style: "" } }, getScenario("simple")).style).toBe("");
  });
});
