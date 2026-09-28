import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { safeTerminalText, safeSegments, Text } from "./safeText";
import { segmentsToAnsi } from "@/lib/engine/ansi";
import { textSegment } from "@/lib/engine/types";
import { parseStyleString } from "@/lib/engine/styleString";

const attack = "\x1b]52;c;YXR0YWNr\x07\x1b[2J\x9b31mtext\rspoof";
describe("terminal text boundary", () => {
  it("removes controls but keeps Unicode and intentional line breaks", () => {
    expect(safeTerminalText(attack)).not.toMatch(/[\x00-\x1f\x7f-\x9f]/);
    expect(safeTerminalText("漢👩‍💻\nnext", true)).toBe("漢👩‍💻\nnext");
  });
  it("keeps trusted renderer styling separate from literal escapes", () => {
    const output = segmentsToAnsi(safeSegments([textSegment(attack, parseStyleString("red"))]));
    expect(output).toContain("\x1b[31m");
    expect(output).not.toContain("\x1b]");
    expect(output).not.toContain("\x1b[2J");
  });
  it("sanitizes nested Ink text leaves", () => {
    const app = render(<Text>{attack}<Text>{attack}</Text></Text>);
    expect(app.lastFrame()).not.toContain("\x1b]");
    expect(app.lastFrame()).toContain("YXR0YWNr?");
    app.unmount();
  });
});
