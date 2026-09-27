import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { DEFAULT_PRESET_ID, getPreset } from "@/lib/config/presets";
import { parseConfig } from "@/lib/config/toml";
import type { StarshipConfig } from "@/lib/engine/prompt";

export interface LoadedConfig {
  config: StarshipConfig;
  originalContent?: string | null;
  displayPath: string;
  writePath: string;
  expectedHash: string | null;
  source: "file" | "preset";
  sourceLabel: string;
}

export class ConfigConflictError extends Error {
  constructor(path: string) {
    super(`${path} changed after it was loaded. Reload it or save to another path.`);
    this.name = "ConfigConflictError";
  }
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function expandPath(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return join(homedir(), input.slice(2));
  return isAbsolute(input) ? input : resolve(input);
}

function defaultConfigPath(environment = process.env): string {
  const configured = environment.STARSHIP_CONFIG;
  return configured
    ? expandPath(configured)
    : join(homedir(), ".config", "starship.toml");
}

async function readIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function targetPath(path: string): Promise<string> {
  let details;
  try {
    details = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return path;
    throw error;
  }
  // A broken symlink is not an empty destination: refusing it avoids replacing
  // the link itself with a regular file during Save As or first-run editing.
  return details.isSymbolicLink() ? await realpath(path) : path;
}

export async function loadConfig(options: {
  path?: string;
  preset?: string;
  requireFile?: boolean;
} = {}): Promise<LoadedConfig> {
  const displayPath = options.path ? expandPath(options.path) : defaultConfigPath();
  const writePath = await targetPath(displayPath);
  const existing = await readIfPresent(writePath);

  if (options.requireFile && !options.preset && existing === null) {
    throw new Error(`${displayPath} does not exist.`);
  }

  if (!options.preset && existing !== null) {
    const parsed = parseConfig(existing);
    if (!parsed.ok) {
      const location = parsed.line ? ` at line ${parsed.line}` : "";
      throw new Error(`Cannot load ${displayPath}${location}: ${parsed.error}`);
    }
    return {
      config: parsed.config,
      originalContent: existing,
      displayPath,
      writePath,
      expectedHash: hashContent(existing),
      source: "file",
      sourceLabel: displayPath,
    };
  }

  const presetId = options.preset ?? DEFAULT_PRESET_ID;
  const preset = getPreset(presetId);
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);
  const parsed = parseConfig(preset.toml);
  if (!parsed.ok) throw new Error(`Bundled preset ${presetId} is invalid: ${parsed.error}`);

  return {
    config: parsed.config,
    originalContent: null,
    displayPath,
    writePath,
    expectedHash: existing === null ? null : hashContent(existing),
    source: "preset",
    sourceLabel: preset.label,
  };
}

export async function saveConfig(options: {
  path: string;
  content: string;
  expectedHash: string | null;
}): Promise<{ hash: string; backupPath: string | null }> {
  const path = await targetPath(options.path);
  const current = await readIfPresent(path);
  const currentHash = current === null ? null : hashContent(current);
  if (currentHash !== options.expectedHash) throw new ConfigConflictError(path);

  if (current !== null && current === options.content) {
    return { hash: currentHash as string, backupPath: null };
  }

  await mkdir(dirname(path), { recursive: true });
  const backupPath = current === null ? null : `${path}.bak`;
  if (backupPath) await copyFile(path, backupPath);

  const mode = current === null ? 0o600 : (await stat(path)).mode & 0o777;
  const temporary = join(
    dirname(path),
    `.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );

  try {
    await writeFile(temporary, options.content, { encoding: "utf8", flag: "wx", mode });
    await rename(temporary, path);
  } catch (error) {
    try {
      await unlink(temporary);
    } catch (cleanupError) {
      if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }

  return { hash: hashContent(options.content), backupPath };
}
