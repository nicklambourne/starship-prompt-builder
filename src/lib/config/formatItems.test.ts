import { describe, expect, it } from "vitest";

import type { FormatItem } from "@/lib/config/formatItems";
import {
  fromItems,
  applyDrop,
  gatherCategory,
  groupItem,
  groupName,
  groupRange,
  groupableCategories,
  itemLabel,
  moveItem,
  reorderItem,
  toItems,
  ungroup,
} from "./formatItems";
import { parseFormatString, printFormat } from "@/lib/engine/formatString";

describe("toItems", () => {
  it("flattens bare variables and text", () => {
    expect(toItems("$a b$c")).toEqual([
      { kind: "module", name: "a" },
      { kind: "text", value: " b" },
      { kind: "module", name: "c" },
    ]);
  });

  it("recognises a styled module", () => {
    expect(toItems("[$directory](bold cyan)")).toEqual([
      { kind: "module", name: "directory", style: "bold cyan" },
    ]);
  });

  it("recognises styled literal text", () => {
    expect(toItems("[ on ](dimmed)")).toEqual([
      { kind: "text", value: " on ", style: "dimmed" },
    ]);
  });

  it("makes a conditional an editable optional group", () => {
    const items = toItems("($a via $b)");
    expect(items).toHaveLength(1);
    expect(items?.[0]).toMatchObject({ kind: "group", conditional: true });
  });

  it("turns a group mixing text and variables into an editable group", () => {
    const items = toItems("[on $branch](purple)");
    expect(items).toEqual([
      {
        kind: "group",
        style: "purple",
        items: [
          { kind: "text", value: "on " },
          { kind: "module", name: "branch" },
        ],
      },
    ]);
  });

  it("keeps a partial conditional editable inside its style group", () => {
    expect(toItems("[a($b)](red)")?.[0]).toMatchObject({ kind: "group", items: [
      { kind: "text", value: "a" }, { kind: "group", conditional: true },
    ] });
  });

  it("returns null for an unparseable format", () => {
    expect(toItems("[oops")).toBeNull();
  });
});

describe("fromItems", () => {
  it("round-trips a plain format", () => {
    const format = "$directory$git_branch ";
    expect(fromItems(toItems(format)!)).toBe(format);
  });

  it("round-trips styles", () => {
    const format = "[$directory](bold cyan)[ on ](dimmed)";
    expect(fromItems(toItems(format)!)).toBe(format);
  });

  it("preserves conditionals while editing around them", () => {
    // The conditional must survive editing around it untouched.
    const format = "$directory(via $nodejs)$character";
    const items = toItems(format)!;
    expect(fromItems(items)).toBe(format);
  });

  it("escapes text that would otherwise be syntax", () => {
    const round = fromItems([{ kind: "text", value: "a[b]$c" }]);
    expect(toItems(round)).toEqual([{ kind: "text", value: "a[b]$c" }]);
  });

  it("braces a variable name that needs it", () => {
    expect(fromItems([{ kind: "module", name: "env_var.HOME" }])).toBe(
      "${env_var.HOME}",
    );
  });

  it("survives a reorder without corrupting neighbours", () => {
    const items = toItems("$a[ x ](red)$b")!;
    expect(fromItems(moveItem(items, 0, 1))).toBe("[ x ](red)$a$b");
  });
});

describe("moveItem", () => {
  it("is a no-op at the boundaries", () => {
    const items = toItems("$a$b")!;
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 1, 1)).toBe(items);
  });
});

describe("itemLabel", () => {
  it("names a text piece as text and describes whitespace by length", () => {
    expect(itemLabel({ kind: "text", value: "  " })).toBe("Text (space × 2)");
    expect(itemLabel({ kind: "text", value: "on " })).toBe('Text "on "');
  });

  it("calls out $all", () => {
    expect(itemLabel({ kind: "module", name: "all" })).toContain("every other module");
  });
});

describe("printFormat", () => {
  it("round-trips every construct in the grammar", () => {
    const format = "[a $b](red)(c$d)\\$e${f.g}";
    expect(printFormat(parseFormatString(format))).toBe(format);
  });
});

describe("grouping", () => {
  it("wraps a contiguous run and round-trips through the format string", () => {
    const items = toItems("$git_branch$git_status$directory")!;
    const grouped = groupRange(items, 0, 1, "bold purple");
    expect(grouped).toHaveLength(2);
    expect(fromItems(grouped)).toBe("[$git_branch$git_status](bold purple)$directory");
    expect(toItems(fromItems(grouped))).toEqual(grouped);
  });

  it("ungroups back to the original sequence", () => {
    const items = toItems("$a$b$c")!;
    expect(ungroup(groupRange(items, 0, 1), 0)).toEqual(items);
  });

  it("refuses an out-of-range range rather than corrupting the format", () => {
    const items = toItems("$a$b")!;
    expect(groupRange(items, 1, 5)).toBe(items);
    expect(groupRange(items, 1, 0)).toBe(items);
  });

  it("gathers a category's modules into one group at the first occurrence", () => {
    // Build tools are interleaved among the languages in starship's real
    // order, which is exactly why contiguous-only grouping is not enough.
    const items = toItems("$nodejs$cmake$python$gradle$directory")!;
    const categories: Record<string, string> = {
      nodejs: "Languages",
      python: "Languages",
      cmake: "Build Tools",
      gradle: "Build Tools",
      directory: "Core",
    };
    const grouped = gatherCategory(items, (n) => categories[n], "Build Tools");
    expect(fromItems(grouped)).toBe("$nodejs[$cmake$gradle]()$python$directory");
  });

  it("leaves a category with a single module alone", () => {
    const items = toItems("$nodejs$directory")!;
    const grouped = gatherCategory(
      items,
      (n) => (n === "nodejs" ? "Languages" : "Core"),
      "Languages",
    );
    expect(grouped).toBe(items);
  });

  it("only offers categories with something to group", () => {
    const items = toItems("$nodejs$python$directory")!;
    const categories: Record<string, string> = {
      nodejs: "Languages",
      python: "Languages",
      directory: "Core",
    };
    expect(groupableCategories(items, (n) => categories[n])).toEqual(["Languages"]);
  });
});

describe("reorderItem", () => {
  it("moves an item to an arbitrary index, as a drag does", () => {
    const items = toItems("$a$b$c")!;
    expect(fromItems(reorderItem(items, 0, 2))).toBe("$b$c$a");
    expect(fromItems(reorderItem(items, 2, 0))).toBe("$c$a$b");
  });

  it("is a no-op when dropped on itself", () => {
    const items = toItems("$a$b")!;
    expect(reorderItem(items, 1, 1)).toBe(items);
  });
});

describe("groupItem", () => {
  it("wraps only the item it was given, not its neighbour", () => {
    const items = toItems("$a$b$c")!;
    expect(fromItems(groupItem(items, 1))).toBe("$a[$b]()$c");
  });

  it("leaves an existing group alone", () => {
    const items = toItems("[$a$b]()")!;
    expect(groupItem(items, 0)).toBe(items);
  });
});

describe("groupName", () => {
  const categoryOf = (n: string) =>
    ({ git_branch: "Git", git_status: "Git", nodejs: "Languages" })[n];

  it("names a group after the one category inside it", () => {
    const group = toItems("[$git_branch$git_status]()")![0];
    if (group.kind !== "group") throw new Error("expected a group");
    expect(groupName(group, categoryOf)).toBe("Git");
  });

  it("calls a group of several categories mixed", () => {
    const group = toItems("[$git_branch$nodejs]()")![0];
    if (group.kind !== "group") throw new Error("expected a group");
    expect(groupName(group, categoryOf)).toBe("Mixed group");
  });
});

describe("applyDrop", () => {
  it("inserts before the target", () => {
    const items = toItems("$a$b$c")!;
    expect(fromItems(applyDrop(items, 2, 0, "before"))).toBe("$c$a$b");
  });

  it("inserts after the target", () => {
    const items = toItems("$a$b$c")!;
    expect(fromItems(applyDrop(items, 0, 2, "after"))).toBe("$b$c$a");
  });

  it("accounts for the gap left by the dragged item when moving forwards", () => {
    // Dropping "after $b" must land between b and c, not past c.
    const items = toItems("$a$b$c")!;
    expect(fromItems(applyDrop(items, 0, 1, "after"))).toBe("$b$a$c");
  });

  it("pairs two loose items into a new group when dropped onto each other", () => {
    const items = toItems("$a$b$c")!;
    expect(fromItems(applyDrop(items, 2, 0, "into"))).toBe("[$a$c]()$b");
  });

  it("appends into an existing group rather than nesting a new one", () => {
    const items = toItems("[$a$b]()$c")!;
    const dropped = applyDrop(items, 1, 0, "into");
    expect(fromItems(dropped)).toBe("[$a$b$c]()");
    expect(dropped).toHaveLength(1);
  });

  it("is a no-op when dropped on itself", () => {
    const items = toItems("$a$b")!;
    expect(applyDrop(items, 1, 1, "into")).toBe(items);
  });
});

describe("single-item groups", () => {
  it("survives a round trip through the format string", () => {
    // The group button makes a group of one, so this is the state every
    // group passes through. Collapsing it back to a module made the button
    // look dead.
    const grouped = groupItem(toItems("$a$b")!, 0);
    expect(fromItems(grouped)).toBe("[$a]()$b");
    const back = toItems("[$a]()$b")!;
    expect(back[0].kind).toBe("group");
    expect(back[0]).toEqual({ kind: "group", style: "", items: [{ kind: "module", name: "a" }] });
  });

  it("still reads a styled single variable as a styled module", () => {
    // `[$a](bold)` is how a module carries its own style; that has to keep
    // working, or every styled module would become a group.
    expect(toItems("[$a](bold)")![0]).toEqual({ kind: "module", name: "a", style: "bold" });
  });
});

describe("a group left with one member", () => {
  it("hands its style to that member rather than losing it", () => {
    const group: FormatItem = {
      kind: "group",
      style: "bold",
      items: [{ kind: "module", name: "a" }],
    };
    expect(fromItems([group])).toBe("[$a](bold)");
  });

  it("leaves a member that already has its own style alone", () => {
    // The member's style overrides the group's, so the group's never showed.
    const group: FormatItem = {
      kind: "group",
      style: "bold",
      items: [{ kind: "module", name: "a", style: "red" }],
    };
    expect(fromItems([group])).toBe("[[$a](red)](bold)");
  });
});

describe("whitespace in a row's label", () => {
  it("names the space rather than counting it", () => {
    expect(itemLabel({ kind: "text", value: "\u2009" })).toBe("Text (thin space × 1)");
    expect(itemLabel({ kind: "text", value: "  " })).toBe("Text (space × 2)");
    expect(itemLabel({ kind: "text", value: "\u00a0\u00a0" })).toBe(
      "Text (no-break space × 2)",
    );
  });

  it("falls back when the run is mixed", () => {
    expect(itemLabel({ kind: "text", value: " \u2009" })).toBe("Text (whitespace × 2)");
  });

  it("still shows visible text as itself", () => {
    expect(itemLabel({ kind: "text", value: "on " })).toBe('Text "on "');
    expect(itemLabel({ kind: "text", value: "" })).toBe('Text ""');
  });
});

describe("a switched-off text piece", () => {
  it("is written as a conditional holding no variables", () => {
    expect(fromItems([{ kind: "text", value: "on the way", disabled: true }])).toBe(
      "(on the way)",
    );
    // starship renders that as nothing, which is the whole trick: the text
    // stays in the config instead of in this app's memory.
    expect(toItems("A(off)B")).toEqual([
      { kind: "text", value: "A" },
      { kind: "text", value: "off", disabled: true },
      { kind: "text", value: "B" },
    ]);
  });

  it("keeps its style", () => {
    expect(fromItems([{ kind: "text", value: "XX", style: "red", disabled: true }])).toBe(
      "([XX](red))",
    );
    expect(toItems("([XX](red))")).toEqual([
      { kind: "text", value: "XX", style: "red", disabled: true },
    ]);
  });

  it("survives parentheses of its own", () => {
    const items = toItems("(with \\(parens\\))");
    expect(items).toEqual([{ kind: "text", value: "with (parens)", disabled: true }]);
    expect(fromItems(items!)).toBe("(with \\(parens\\))");
  });

  it("leaves a real conditional alone", () => {
    // One with a variable in it is a conditional its author meant, not a
    // piece of text somebody switched off.
    expect(toItems("($a b)")).toEqual([{ kind: "group", conditional: true, items: [
      { kind: "module", name: "a" }, { kind: "text", value: " b" },
    ] }]);
  });
});
