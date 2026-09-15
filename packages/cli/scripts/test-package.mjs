import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const pnpmScript = process.env.npm_execpath;
if (!pnpmScript) throw new Error("test-package.mjs must run from a pnpm script");

function runPnpm(args, cwd) {
  const result = spawnSync(process.execPath, [pnpmScript, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
  });
  if (result.status !== 0) {
    throw new Error([
      `pnpm ${args.join(" ")} failed with status ${result.status ?? "unknown"}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

const root = await mkdtemp(join(tmpdir(), "starship-builder-package-"));
try {
  runPnpm(["pack", "--pack-destination", root], packageRoot);
  const tarballName = (await readdir(root)).find((name) => name.endsWith(".tgz"));
  if (!tarballName) throw new Error("pnpm pack did not produce a tarball");

  const consumer = join(root, "consumer");
  await mkdir(consumer);
  await writeFile(join(consumer, "package.json"), JSON.stringify({
    name: "starship-builder-package-smoke",
    private: true,
  }));

  runPnpm([
    "add",
    "--ignore-scripts",
    "--prefer-offline",
    join(root, tarballName),
  ], consumer);

  const installedManifest = JSON.parse(await readFile(join(
    consumer,
    "node_modules",
    "starship-prompt-builder-cli",
    "package.json",
  ), "utf8"));
  if (installedManifest.bin?.["starship-builder"] !== "dist/index.js") {
    throw new Error("The installed package does not expose the starship-builder binary");
  }

  const version = runPnpm(["exec", "starship-builder", "--version"], consumer).trim();
  if (version !== installedManifest.version) {
    throw new Error(`Installed binary reported ${version}; expected ${installedManifest.version}`);
  }

  const validation = runPnpm([
    "exec",
    "starship-builder",
    "validate",
    "--preset",
    "plain-text-symbols",
  ], consumer);
  if (!validation.includes("Valid Starship configuration")) {
    throw new Error("Installed binary did not validate a bundled preset");
  }

  const preview = runPnpm([
    "exec",
    "starship-builder",
    "preview",
    "--preset",
    "plain-text-symbols",
    "--scenario",
    "simple",
    "--no-color",
  ], consumer);
  if (!preview.includes(">")) {
    throw new Error("Installed binary did not render a prompt preview");
  }

  process.stdout.write(`Verified packed CLI ${installedManifest.version} from a fresh install.\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}
