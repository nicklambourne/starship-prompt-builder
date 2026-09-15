import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { editConfigExternally, splitEditorCommand } from "./externalEditor";

const originalEditor = process.env.EDITOR;
const originalVisual = process.env.VISUAL;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  if (originalEditor === undefined) delete process.env.EDITOR;
  else process.env.EDITOR = originalEditor;
  if (originalVisual === undefined) delete process.env.VISUAL;
  else process.env.VISUAL = originalVisual;
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("editor command parsing", () => {
  it("supports flags and quoted paths without a shell", () => {
    expect(splitEditorCommand('"/Applications/Visual Studio Code.app/Contents/code" --wait')).toEqual([
      "/Applications/Visual Studio Code.app/Contents/code",
      "--wait",
    ]);
  });

  it("preserves Windows path separators in quoted commands", () => {
    expect(splitEditorCommand('"C:\\Program Files\\node.exe" --wait')).toEqual([
      "C:\\Program Files\\node.exe",
      "--wait",
    ]);
  });

  it("rejects unterminated quotes", () => {
    expect(() => splitEditorCommand("'broken")).toThrow("unterminated quote");
  });

  it("round-trips a config through a real external editor process", async () => {
    const directory = await mkdtemp(join(tmpdir(), "starship-builder-editor-test-"));
    temporaryDirectories.push(directory);
    const editor = join(directory, "editor.mjs");
    await writeFile(editor, [
      'import { writeFileSync } from "node:fs";',
      "const path = process.argv.at(-1);",
      'writeFileSync(path, "add_newline = false\\n[character]\\nsuccess_symbol = \\\"[ok](green)\\\"\\n");',
    ].join("\n"));

    delete process.env.VISUAL;
    process.env.EDITOR = `${JSON.stringify(process.execPath)} ${JSON.stringify(editor)}`;

    const result = await editConfigExternally({ add_newline: true });

    expect(result).toEqual({
      ok: true,
      config: {
        add_newline: false,
        character: { success_symbol: "[ok](green)" },
      },
    });
  });
});
