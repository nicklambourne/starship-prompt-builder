import { describe, expect, it } from "vitest";
import { ALL_MODULES, getModule } from "@/lib/engine/modules";
import { parseFormatString } from "@/lib/engine/formatString";
import { getScenario } from "@/lib/scenarios";
import { renderFormatString } from "@/lib/engine/render";
import { fromItems, isRedundantStyleWrapper, toItems, type FormatItem } from "./formatItems";
import { conditionalIsVisible, groupVisibility, moduleFormatVariables } from "./formatVisibility";
import { formatItemStyle } from "./formatStyles";
import { collectModuleNames, moveTo, nudge, updateAt } from "./formatTree";
import { loadPreset, PRESETS } from "./presets";

const gitFormat = "[[($all_status$ahead_behind )](fg:crust bg:yellow)]($style)";

describe("editable conditional groups", () => {
  it("exposes git status variables instead of an opaque string", () => {
    const items = toItems(gitFormat)!;
    expect(collectModuleNames(items)).toEqual(["all_status", "ahead_behind"]);
    expect(items[0]).toMatchObject({ kind: "group", style: "$style", items: [
      { kind: "group", conditional: true, style: "fg:crust bg:yellow" },
    ] });
  });

  it.each([
    gitFormat,
    "[[ $symbol( $version) ](fg:crust bg:green)]($style)",
    "[$path]($style)( [read-only $read_only]($read_only_style))",
    "[before ($a( / $b)) after]($style)",
    "([x$a](red))",
    "[($a)]()",
    "[($a)](red)[x]()",
    "[[x$a]()]($style)",
    "()[]()",
    getModule("git_status")!.defaults.format,
  ])("preserves every wrapper and its ordering in %s", (format) => {
    expect(fromItems(toItems(format)!)).toBe(format);
  });

  it("allows reordering and editing within a conditional", () => {
    const items = toItems(gitFormat)!;
    expect(fromItems(nudge(items, [0, 0, 0], 1)))
      .toBe("[[($ahead_behind$all_status )](fg:crust bg:yellow)]($style)");
    expect(fromItems(updateAt(items, [0, 0, 2], () => ({ kind: "text", value: "!" }))))
      .toBe("[[($all_status$ahead_behind!)](fg:crust bg:yellow)]($style)");
  });

  it("moves a variable into an optional section without dropping its condition", () => {
    expect(fromItems(moveTo(toItems("$a( / $b)")!, [0], [1], "into")))
      .toBe("( / $b$a)");
  });

  it("moves the only variable out of a conditional without losing or misplacing it", () => {
    const items = toItems("($a)[$b$c](red)")!;
    expect(fromItems(moveTo(items, [0, 0], [1], "into"))).toBe("[$b$c$a](red)");
    expect(fromItems(moveTo(items, [0, 0], [1], "before"))).toBe("$a[$b$c](red)");
    expect(fromItems(moveTo(items, [0, 0], [0], "into"))).toBe("($a)[$b$c](red)");
  });

  it("does not lose a sole nested group when nudged past its last sibling", () => {
    const items = toItems(gitFormat)!;
    expect(nudge(items, [0, 0], 1)).toBe(items);
  });

  it("inherits through a conditional without inserting a style reset", () => {
    const items = toItems("[x($a$b)]($style)")!;
    expect(formatItemStyle(items, [0, 1, 0], { style: "bold yellow" })).toBe("bold yellow");
  });

  it("can switch visibility off without changing inherited styling", () => {
    const items = toItems("[x( / $a)](red)")!;
    const next = updateAt(items, [0, 1], (item) => ({ ...item, conditional: false } as FormatItem));
    expect(fromItems(next)).toBe("[x / $a](red)");
    const ctx = { variables: new Map(), styleVariables: new Map() };
    expect(renderFormatString(fromItems(items), ctx).map(s => "value" in s ? s.value : "").join("")).toBe("x");
    expect(renderFormatString(fromItems(next), ctx).map(s => "value" in s ? s.value : "").join("")).toBe("x / ");
  });

  it("only folds outer styles whose entire contents already have a style", () => {
    expect(isRedundantStyleWrapper(toItems(gitFormat)![0])).toBe(true);
    expect(isRedundantStyleWrapper(toItems("[($a$b)](red)")![0])).toBe(false);
    expect(isRedundantStyleWrapper(toItems("[x[$a$b](blue)](red)")![0])).toBe(false);
    expect(isRedundantStyleWrapper(toItems("([$a$b](blue))")![0])).toBe(false);
  });
});

describe("existing formats remain lossless", () => {
  const formats: [string, string][] = ALL_MODULES.map(module => [module.name, module.defaults.format]);
  for (const preset of PRESETS) {
    const config = loadPreset(preset.id)!;
    for (const [key, value] of Object.entries(config)) {
      if (key === "format" && typeof value === "string") formats.push([preset.id, value]);
      if (value && typeof value === "object" && "format" in value && typeof value.format === "string") {
        formats.push([`${preset.id}/${key}`, value.format]);
      }
    }
  }
  it.each(formats)("retains the parsed structure of %s", (_name, format) => {
    expect(parseFormatString(fromItems(toItems(format)!))).toEqual(parseFormatString(format));
  });
});

describe("conditional preview visibility", () => {
  it("ignores text and style variables; any non-empty content variable is enough", () => {
    const items = toItems("literal [$a$b]($style)")!;
    expect(conditionalIsVisible(items, new Map([["style", { type: "plain", value: "red" }]]))).toBe(false);
    expect(conditionalIsVisible(items, new Map([["a", { type: "plain", value: "" }]]))).toBe(false);
    expect(conditionalIsVisible(items, new Map([["b", { type: "plain", value: "x" }]]))).toBe(true);
  });

  it("handles styled aggregate and nested variables using the renderer", () => {
    const items = toItems("($a($b))")!;
    expect(conditionalIsVisible(items, new Map([["b", { type: "styled", segments: [{ kind: "text", value: "" }] }]]))).toBe(false);
    expect(conditionalIsVisible(items, new Map([["b", { type: "styled", segments: [{ kind: "text", value: "!" }] }]]))).toBe(true);
  });

  it("follows git status from dirty to clean in the current scenario", () => {
    const items = toItems(gitFormat)!;
    const definition = getModule("git_status")!;
    expect(groupVisibility(items, [0, 0], moduleFormatVariables(definition, {}, getScenario("dirty-repo")))).toBe(true);
    expect(groupVisibility(items, [0, 0], moduleFormatVariables(definition, {}, getScenario("polyglot")))).toBe(false);
    expect(groupVisibility(items, [0, 0], undefined)).toBeUndefined();
  });

  it("distinguishes a partial optional suffix from the rest of a module", () => {
    const items = toItems("[$path]($style)( [read-only $read_only]($read_only_style))")!;
    const definition = getModule("directory")!;
    const scenario = getScenario("simple");
    expect(groupVisibility(items, [1], moduleFormatVariables(definition, {}, scenario))).toBe(false);
    expect(groupVisibility(items, [1], moduleFormatVariables(definition, {}, { ...scenario, readOnly: true }))).toBe(true);
    expect(groupVisibility(items, [0], moduleFormatVariables(definition, {}, scenario))).toBe(true);
  });

  it("honours hidden ancestors even for non-conditional nested groups", () => {
    const items = toItems("([empty]()$missing)")!;
    expect(groupVisibility(items, [0, 0], new Map())).toBe(false);
  });
});
