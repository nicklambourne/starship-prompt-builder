import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { parseConfig, serialiseConfig } from "@/lib/config/toml";
import type { StarshipConfig } from "@/lib/engine/prompt";
import type { Scenario } from "@/lib/scenarios/types";
import { parseScenarioFile } from "./scenarioFile";

const MAX_BYTES = 2 * 1024 * 1024;

export interface Draft {
  targetPath: string;
  baselineHash: string | null;
  config: StarshipConfig;
  scenario: Scenario;
}

function stateDirectory(): string {
  const candidate = process.platform === "win32" ? process.env.LOCALAPPDATA : process.env.XDG_STATE_HOME;
  const root = candidate && isAbsolute(candidate) ? candidate : join(homedir(), ".local", "state");
  return join(root, "starship-prompt-builder", "drafts");
}

function draftPath(targetPath: string, directory = stateDirectory()): string {
  return join(directory, `${createHash("sha256").update(targetPath).digest("hex")}.json`);
}

export async function loadDraft(targetPath: string, directory?: string): Promise<Draft | null> {
  let data: Buffer;
  try { data = await readFile(draftPath(targetPath, directory)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (data.byteLength > MAX_BYTES) throw new Error("Recovery draft exceeds 2 MiB.");
  const document: unknown = JSON.parse(data.toString("utf8"));
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("Invalid recovery draft.");
  const fields = document as Record<string, unknown>;
  if (fields.version !== 1 || fields.targetPath !== targetPath ||
    !(fields.baselineHash === null || typeof fields.baselineHash === "string") ||
    typeof fields.configToml !== "string") throw new Error("Unsupported or mismatched recovery draft.");
  const parsed = parseConfig(fields.configToml);
  if (!parsed.ok) throw new Error(`Recovery draft has invalid TOML: ${parsed.error}`);
  const scenario = parseScenarioFile(JSON.stringify({ version: 1, scenario: fields.scenario }));
  return { targetPath, baselineHash: fields.baselineHash, config: parsed.config, scenario };
}

export async function saveDraft(draft: Draft, directory?: string): Promise<void> {
  const path = draftPath(draft.targetPath, directory);
  const content = `${JSON.stringify({ version: 1, targetPath: draft.targetPath,
    baselineHash: draft.baselineHash,
    configToml: serialiseConfig(draft.config, { header: false }), scenario: draft.scenario }, null, 2)}\n`;
  if (Buffer.byteLength(content, "utf8") > MAX_BYTES) throw new Error("Recovery draft exceeds 2 MiB.");
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

export async function removeDraft(targetPath: string, directory?: string): Promise<void> {
  try { await unlink(draftPath(targetPath, directory)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
