import { describe, expect, it } from "vitest";
import { fromItems, toItems } from "@/lib/config/formatItems";
import {
  dissolveGroup,
  duplicateItem,
  flattenFormat,
  formatItems,
  indentItem,
  moveSibling,
  outdentItem,
  setFormatItems,
  wrapInGroup,
} from "./formatEditor";

describe("terminal format tree", () => {
  it("browses nested groups without rewriting the source", () => {
    const config = { format: "[hello $directory](red)$character" };
    const rows = flattenFormat(formatItems(config, "left"));
    expect(rows.map((row) => row.path)).toEqual([[0], [0, 0], [0, 1], [1]]);
    expect(config.format).toBe("[hello $directory](red)$character");
    expect(flattenFormat(formatItems(config, "left"), new Set(["0"]))).toHaveLength(2);
  });

  it("groups, moves, and ungroups nested pieces without losing style", () => {
    const original = toItems("[hello $directory](red)$character")!;
    const moved = moveSibling(original, [0, 0], 1);
    expect(fromItems(moved)).toBe("[$directoryhello ](red)$character");
    const out = outdentItem(original, [0, 1]);
    expect(fromItems(out)).toBe("[hello ](red)$directory$character");
    const nested = indentItem(out, [1]);
    expect(fromItems(nested)).toBe("[hello $directory](red)$character");
    const wrapped = wrapInGroup(original, [1]);
    expect(dissolveGroup(wrapped, [1])).toEqual(original);
    expect(duplicateItem(original, [1])).toHaveLength(3);
  });

  it("keeps the right prompt separate from the left prompt", () => {
    const config = { format: "$directory", right_format: "$time" };
    const next = setFormatItems(config, "right", toItems("$status")!);
    expect(next.format).toBe("$directory");
    expect(next.right_format).toBe("$status");
    const grouped = setFormatItems(config, "right", wrapInGroup(formatItems(config, "right"), [0]));
    expect(grouped.right_format).toBe("[$time]()");
    expect(flattenFormat(formatItems(grouped, "right")).map((row) => row.item.kind)).toEqual(["group", "module"]);
  });
});
