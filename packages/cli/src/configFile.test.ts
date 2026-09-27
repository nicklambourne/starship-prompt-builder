import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
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
    await saveConfig({ path: link, content: "add_newline = true\n", expectedHash: loaded.expectedHash });
    expect(await realpath(link)).toBe(await realpath(target));
    expect(await readFile(target, "utf8")).toBe("add_newline = true\n");
  });

  it("rejects a broken symlink without replacing it", async () => {
    const directory = await temporaryDirectory();
    const link = join(directory, "starship.toml");
    await symlink(join(directory, "missing.toml"), link);
    await expect(loadConfig({ path: link })).rejects.toMatchObject({ code: "ENOENT" });
    await expect(saveConfig({ path: link, content: "", expectedHash: null })).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("keeps the original file if backup creation fails", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "starship.toml");
    await writeFile(path, "add_newline = false\n");
    await mkdir(`${path}.bak`);
    await expect(saveConfig({ path, content: "add_newline = true\n", expectedHash: hashContent("add_newline = false\n") })).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("add_newline = false\n");
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

  it("does not replace a missing explicitly requested input with a preset", async () => {
    const directory = await temporaryDirectory();
    await expect(loadConfig({ path: join(directory, "missing.toml"), requireFile: true }))
      .rejects.toThrow(/does not exist/);
  });

  it("leaves an unchanged file and its comments untouched", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "starship.toml");
    const content = "# personal choice\r\nadd_newline = false\r\n";
    await writeFile(path, content);

    const saved = await saveConfig({ path, content, expectedHash: hashContent(content) });

    expect(saved.backupPath).toBeNull();
    expect(await readFile(path, "utf8")).toBe(content);
    await expect(readFile(`${path}.bak`, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
