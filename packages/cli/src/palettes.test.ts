import { describe, expect, it } from "vitest";
import { createPalette, deletePalette, deletePaletteColor, renamePalette, setPaletteColor } from "./palettes";

describe("terminal palette edits", () => {
  it("creates, renames, and edits colors without losing other palettes", () => {
    const before = { palettes: { ocean: { blue: "#123456" }, forest: { green: "#00ff00" } }, palette: "ocean" };
    const copied = createPalette(before, "ocean_copy", "ocean");
    const renamed = renamePalette(copied, "ocean_copy", "deep");
    const colored = setPaletteColor(renamed, "deep", "red", "#ff0000");
    expect(deletePaletteColor(colored, "deep", "blue").palettes).toEqual({
      ocean: { blue: "#123456" }, forest: { green: "#00ff00" }, deep: { red: "#ff0000" },
    });
    expect(deletePalette(colored, "deep")).toBe(colored);
    expect(deletePalette(renamed, "forest").palettes).not.toHaveProperty("forest");
  });
});
