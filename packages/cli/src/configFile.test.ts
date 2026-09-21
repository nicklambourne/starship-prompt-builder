import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  ConfigConflictError,
  hashContent,
  loadConfig,
  saveConfig,
} from "./configFile";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "starship-builder-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("config files", () => {
  it("loads a file and follows a symlink for safe writes", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "real.toml");
    const link = join(directory, "starship.toml");
    const content = "add_newline = false\n";
    await writeFile(target, content);
    await symlink(target, link);

    const loaded = await loadConfig({ path: link });

    expect(loaded.config.add_newline).toBe(false);
    expect(loaded.displayPath).toBe(link);
    expect(loaded.writePath).toBe(await realpath(target));
    expect(loaded.expectedHash).toBe(hashContent(content));
  });

  it("writes atomically and keeps the previous content as a backup", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "starship.toml");
    const before = "add_newline = false\n";
    const after = "add_newline = true\n";
    await writeFile(path, before);

    const saved = await saveConfig({
      path,
      content: after,
      expectedHash: hashContent(before),
    });

    expect(await readFile(path, "utf8")).toBe(after);
    expect(await readFile(`${path}.bak`, "utf8")).toBe(before);
    expect(saved.hash).toBe(hashContent(after));
  });

  it("refuses to overwrite a file that changed after loading", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "starship.toml");
    const before = "add_newline = false\n";
    await writeFile(path, before);
    await writeFile(path, "add_newline = true\n");

    await expect(saveConfig({
      path,
      content: "add_newline = false\n",
      expectedHash: hashContent(before),
    })).rejects.toBeInstanceOf(ConfigConflictError);
  });
});
