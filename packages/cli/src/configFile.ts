import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

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

export function hashContent(content: string | Uint8Array): string {
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Canonicalize an existing parent so aliases coordinate on one lock.
      try { return join(await realpath(dirname(path)), basename(path)); }
      catch (parentError) {
        if ((parentError as NodeJS.ErrnoException).code === "ENOENT") return path;
        throw parentError;
      }
    }
    throw error;
  }
  // A broken symlink is not an empty destination: refusing it avoids replacing
  // the link itself with a regular file during Save As or first-run editing.
  if (!details.isFile() && !details.isSymbolicLink()) throw new Error(`${path} is not a regular config file.`);
  const resolved = await realpath(path);
  if (details.isSymbolicLink() && !(await lstat(resolved)).isFile()) throw new Error(`${path} does not resolve to a regular config file.`);
  return resolved;
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

async function snapshot(path: string) {
  let handle;
  try { handle = await open(path, "r"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    const identity = await handle.stat();
    if (!identity.isFile()) throw new Error(`${path} is not a regular config file.`);
    const bytes = await handle.readFile();
    return { bytes, hash: hashContent(bytes), identity };
  } finally { await handle.close(); }
}

/**
 * Locks coordinate our writers, not arbitrary editors. The final identity/hash
 * check detects changes before publication; existing-file rename is not a CAS.
 * Backups are unique, private, and never overwrite an existing path.
 */
export async function saveConfig(options: {
  path: string;
  content: string;
  expectedHash: string | null;
  expectedWritePath?: string;
}): Promise<{ hash: string; backupPath: string | null; warnings: string[] }> {
  const requested = expandPath(options.path);
  const initialPath = await targetPath(requested);
  if (options.expectedWritePath && initialPath !== options.expectedWritePath) throw new ConfigConflictError(requested);
  await mkdir(dirname(initialPath), { recursive: true });
  const path = await targetPath(requested);
  if (await targetPath(initialPath) !== path) throw new ConfigConflictError(requested);
  const lockPath = `${path}.lock`;
  let lock;
  try {
    // Fail fast instead of stealing a lock from a possibly active writer.
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`${path} is locked by another save. Retry after it finishes; inspect ${lockPath} before removing a stale lock.`);
    }
    throw error;
  }
  const lockIdentity = await lock.stat();
  const warnings: string[] = [];
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  let ownsTemporary = false;
  try {
    if (await targetPath(requested) !== path) throw new ConfigConflictError(requested);
    const current = await snapshot(path);
    if ((current?.hash ?? null) !== options.expectedHash) throw new ConfigConflictError(path);
    if (current?.bytes.equals(Buffer.from(options.content))) {
      return { hash: current.hash, backupPath: null, warnings };
    }
    const backupPath = current ? `${path}.${randomUUID()}.bak` : null;
    if (backupPath && current) await writeFile(backupPath, current.bytes, { flag: "wx", mode: 0o600 });
    ownsTemporary = true;
    try {
      await writeFile(temporary, options.content, { encoding: "utf8", flag: "wx", mode: current ? current.identity.mode & 0o777 : 0o600 });
      // Creation mode is filtered by umask; restore the original POSIX bits
      // explicitly without broadening a new file or its private backup.
      if (current && process.platform !== "win32") await chmod(temporary, current.identity.mode & 0o777);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") ownsTemporary = false;
      throw error;
    }
    const latest = await snapshot(path);
    if (await targetPath(requested) !== path || (latest?.hash ?? null) !== options.expectedHash ||
      latest?.identity.dev !== current?.identity.dev || latest?.identity.ino !== current?.identity.ino) {
      throw new ConfigConflictError(path);
    }
    if (current) {
      await rename(temporary, path);
      ownsTemporary = false;
    } else {
      // Hard-link publication is atomic and refuses an existing destination.
      // Unsupported filesystems fail safely; never fall back to clobbering.
      try { await link(temporary, path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ConfigConflictError(path);
        throw error;
      }
    }
    return { hash: hashContent(options.content), backupPath, warnings };
  } finally {
    // Cleanup must not misreport a successfully published candidate as unsaved.
    if (ownsTemporary) {
      try { await unlink(temporary); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") warnings.push(`Could not remove temporary file ${temporary}.`);
      }
    }
    await lock.close().catch(() => { warnings.push(`Could not close save lock ${lockPath}.`); });
    try {
      const currentLock = await lstat(lockPath);
      if (currentLock.dev === lockIdentity.dev && currentLock.ino === lockIdentity.ino) await unlink(lockPath);
      else warnings.push(`Save lock changed; left ${lockPath} untouched.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") warnings.push(`Could not remove save lock ${lockPath}.`);
    }
  }
}
