import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import type { StarshipConfig } from "@/lib/engine/prompt";

/** Splits the conventional EDITOR="command --flag" form without invoking a shell. */
export function splitEditorCommand(value: string): string[] {
  const parts: string[] = [];
  const input = value.trim();
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      const next = input[index + 1];
      const escapesNext = next !== undefined && (
        next === "\\"
        || next === quote
        || (!quote && (/\s/.test(next) || next === "'" || next === '"'))
      );
      if (escapesNext) escaped = true;
      else current += character;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (escaped) current += "\\";
  if (quote) throw new Error("EDITOR contains an unterminated quote.");
  if (current) parts.push(current);
  if (parts.length === 0) throw new Error("EDITOR is empty.");
  return parts;
}

export async function editConfigExternally(
  config: StarshipConfig,
): Promise<{ ok: true; config: StarshipConfig } | { ok: false; error: string }> {
  const fallback = process.platform === "win32" ? "notepad" : "vi";
  const editor = process.env.VISUAL || process.env.EDITOR || fallback;
  let command: string;
  let args: string[];
  try {
    [command, ...args] = splitEditorCommand(editor);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }

  const directory = await mkdtemp(join(tmpdir(), "starship-builder-editor-"));
  const path = join(directory, "starship.toml");
  try {
    await writeFile(path, serialiseConfig(config), "utf8");
    const result = spawnSync(command, [...args, path], { stdio: "inherit" });
    if (result.error) return { ok: false, error: result.error.message };
    if (result.status !== 0) {
      return { ok: false, error: `${command} exited with status ${result.status ?? "unknown"}.` };
    }
    const edited = await readFile(path, "utf8");
    const parsed = parseConfig(edited);
    if (!parsed.ok) {
      const line = parsed.line ? `Line ${parsed.line}: ` : "";
      return { ok: false, error: `${line}${parsed.error}` };
    }
    return { ok: true, config: parsed.config };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
