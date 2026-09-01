import { describe, expect, it } from "vitest";

import { PRESETS, getPreset } from "./presets";
import {
  PRESET_PREVIEW_WIDTH,
  renderPresetPreview,
} from "./presetPreview";

const visibleText = (preview: NonNullable<ReturnType<typeof renderPresetPreview>>) =>
  preview.lines
    .flat()
    .map((segment) => (segment.kind === "lineTerm" ? "" : segment.value))
    .join("");

describe("renderPresetPreview", () => {
  it("renders every offered preset through the prompt engine", () => {
    for (const preset of PRESETS) {
      const preview = renderPresetPreview(preset);
      expect(preview, preset.id).not.toBeNull();
      expect(visibleText(preview!), preset.id).not.toBe("");
    }
  });

  it("uses the preset demonstration environment at thumbnail width", () => {
    const preset = getPreset("powerlevel10k-rainbow-2-lines");
    expect(preset).toBeDefined();

    const preview = renderPresetPreview(preset!);
    expect(preview).not.toBeNull();
    expect(preview?.lines).toHaveLength(2);
    expect(visibleText(preview!)).toContain("~/src");
    expect(visibleText(preview!)).toContain("master");
    expect(
      preview?.right
        .map((segment) => (segment.kind === "lineTerm" ? "" : segment.value))
        .join(""),
    ).toBe("─╯");

    const widestLine = Math.max(
      ...preview!.lines.map((line) =>
        line.reduce(
          (width, segment) => width + (segment.kind === "lineTerm" ? 0 : [...segment.value].length),
          0,
        ),
      ),
    );
    expect(widestLine).toBeLessThanOrEqual(PRESET_PREVIEW_WIDTH);
  });
});
