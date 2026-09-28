import { chmod, mkdtemp, readFile, readdir, rm, symlink, writeFile, link, unlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { hashContent, loadConfig, saveConfig } from "./configFile";

const fault = vi.hoisted(() => ({ onStage: undefined as undefined | (() => Promise<void>), onPublish: undefined as undefined | (() => Promise<void>), backupFailure: false }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return { ...fs, writeFile: async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).endsWith(".bak") && fault.backupFailure) throw new Error("Synthetic backup failure");
    const result = await fs.writeFile(...args);
    if (String(args[0]).endsWith(".tmp") && fault.onStage) {
      const action = fault.onStage;
      fault.onStage = undefined;
      await action();
    }
    return result;
  }, link: async (...args: Parameters<typeof fs.link>) => {
    if (fault.onPublish) { const action = fault.onPublish; fault.onPublish = undefined; await action(); }
    return fs.link(...args);
  } };
});
const roots: string[] = [];
afterEach(async () => {
  fault.onStage = undefined;
  fault.onPublish = undefined;
  fault.backupFailure = false;
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "spb-save-safety-"));
  roots.push(root);
  return { root, path: join(root, "starship.toml"), before: 'format = "before"\n' };
}

it("rejects an external change after staging without overwriting it", async () => {
  const { path, before } = await fixture();
  await writeFile(path, before);
  fault.onStage = () => writeFile(path, 'format = "external"\n');
  await expect(saveConfig({ path, content: 'format = "candidate"\n', expectedHash: hashContent(before) })).rejects.toThrow(/changed/);
  expect(await readFile(path, "utf8")).toContain("external");
});

it.each(["symlink", "hardlink"] as const)("never follows a pre-existing backup %s", async (kind) => {
  const { path, root, before } = await fixture();
  const unrelated = join(root, "unrelated.txt");
  await writeFile(path, before);
  await writeFile(unrelated, "keep me");
  if (kind === "symlink") await symlink(unrelated, path + ".bak");
  else await link(unrelated, path + ".bak");
  const result = await saveConfig({ path, content: 'format = "after"\n', expectedHash: hashContent(before) });
  expect(await readFile(unrelated, "utf8")).toBe("keep me");
  expect(result.backupPath).not.toBe(path + ".bak");
  expect(await readFile(result.backupPath!, "utf8")).toBe(before);
});

it("allows at most one cooperating writer to apply an approved baseline", async () => {
  const { path, before, root } = await fixture();
  await writeFile(path, before);
  const results = await Promise.allSettled(["first", "second"].map((name) =>
    saveConfig({ path, content: `format = "${name}"\n`, expectedHash: hashContent(before) })));
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect((await readdir(root)).filter((name) => name.endsWith(".lock") || name.endsWith(".tmp"))).toEqual([]);
});

it("does not clobber a file created while a new config is staged", async () => {
  const { path } = await fixture();
  fault.onStage = () => writeFile(path, 'format = "external"\n');
  await expect(saveConfig({ path, content: 'format = "candidate"\n', expectedHash: null })).rejects.toThrow(/changed/);
  expect(await readFile(path, "utf8")).toContain("external");
});

it("does not clobber a file created after the final check", async () => {
  const { path } = await fixture();
  fault.onPublish = () => writeFile(path, 'format = "late creator"\n');
  await expect(saveConfig({ path, content: 'format = "candidate"\n', expectedHash: null })).rejects.toThrow(/changed/);
  expect(await readFile(path, "utf8")).toContain("late creator");
});

it("rejects a symlink retargeted since review even when bytes match", async () => {
  const { path, root, before } = await fixture();
  const first = join(root, "first.toml"), second = join(root, "second.toml");
  await writeFile(first, before); await writeFile(second, before);
  await symlink(first, path);
  const loaded = await loadConfig({ path });
  await unlink(path); await symlink(second, path);
  await expect(saveConfig({ path, expectedWritePath: loaded.writePath, expectedHash: loaded.expectedHash, content: "changed" })).rejects.toThrow(/changed/);
  expect(await readFile(second, "utf8")).toBe(before);
});

it("fails before publication when the backup cannot be created", async () => {
  const { path, root, before } = await fixture();
  await writeFile(path, before);
  fault.backupFailure = true;
  await expect(saveConfig({ path, expectedHash: hashContent(before), content: "changed" })).rejects.toThrow(/backup failure/);
  expect(await readFile(path, "utf8")).toBe(before);
  expect(await readdir(root)).toEqual(["starship.toml"]);
});

it("never steals an existing lock", async () => {
  const { path } = await fixture();
  await writeFile(path + ".lock", "existing-owner");
  await expect(saveConfig({ path, expectedHash: null, content: "changed" })).rejects.toThrow(/locked/);
  expect(await readFile(path + ".lock", "utf8")).toBe("existing-owner");
});

it.skipIf(process.platform === "win32")("keeps backups private and preserves target permissions", async () => {
  const { path, before } = await fixture();
  await writeFile(path, before);
  await chmod(path, 0o764);
  const saved = await saveConfig({ path, expectedHash: hashContent(before), content: "changed" });
  expect((await stat(saved.backupPath!)).mode & 0o777).toBe(0o600);
  expect((await stat(path)).mode & 0o777).toBe(0o764);
});
