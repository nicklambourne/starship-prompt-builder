import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const pnpmScript = process.env.npm_execpath;
if (!pnpmScript) throw new Error("test-package.mjs must run from a pnpm script");

function runPnpm(args, cwd) {
  const result = runPnpmResult(args, cwd);
  if (result.status !== 0) {
    throw new Error([
      `pnpm ${args.join(" ")} failed with status ${result.status ?? "unknown"}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n"));
  }
  return result.stdout;
}

function runPnpmResult(args, cwd, input) {
  return spawnSync(process.execPath, [pnpmScript, ...args], {
    cwd,
    encoding: "utf8",
    input,
    env: { ...process.env, CI: "true" },
  });
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
  const installedRoot = join(consumer, "node_modules", "starship-prompt-builder-cli");
  await stat(join(installedRoot, "dist", "index.js"));
  await stat(join(installedRoot, "LICENSE"));
  await stat(join(installedRoot, "README.md"));
  try {
    await stat(join(installedRoot, "src"));
    throw new Error("The packed CLI unexpectedly contains source files");
  } catch (error) {
    if (error.message === "The packed CLI unexpectedly contains source files") throw error;
    if (error.code !== "ENOENT") throw error;
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

  const missing = runPnpmResult([
    "exec", "starship-builder", "validate", join(consumer, "missing.toml"),
  ], consumer);
  if (missing.status !== 1 || !missing.stderr.includes("does not exist")) {
    throw new Error("Validation silently substituted a preset for a missing file");
  }

  const invalidPath = join(consumer, "invalid.toml");
  await writeFile(invalidPath, 'add_newline = "false"\n');
  const invalid = runPnpmResult([
    "exec", "starship-builder", "validate", invalidPath, "--json",
  ], consumer);
  const report = JSON.parse(invalid.stdout.trim());
  if (invalid.status !== 2 || report.valid || report.diagnostics[0]?.path !== "add_newline") {
    throw new Error("Validation accepted a parseable config with an invalid option type");
  }

  const piped = runPnpmResult(["exec", "starship-builder", "validate", "-", "--json"], consumer, "add_newline = false\n");
  if (piped.status !== 0 || JSON.parse(piped.stdout).valid !== true) {
    throw new Error("Installed binary could not validate piped TOML");
  }

  const share = runPnpm(["exec", "starship-builder", "share", "--preset", "plain-text-symbols"], consumer).trim();
  if (!share.startsWith("https://starship.ndl.au/#")) throw new Error("Installed binary did not create a browser link");
  const fromShare = runPnpm(["exec", "starship-builder", "validate", "--from-share", share, "--json"], consumer);
  if (JSON.parse(fromShare).valid !== true) throw new Error("Installed binary could not import its share link");

  const completions = runPnpm(["exec", "starship-builder", "completions", "bash"], consumer);
  if (!completions.includes("complete -F _spb_complete")) throw new Error("Installed binary is missing bash completions");

  process.stdout.write(`Verified packed CLI ${installedManifest.version} from a fresh install.\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}
