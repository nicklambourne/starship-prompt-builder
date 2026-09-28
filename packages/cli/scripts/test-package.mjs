import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

  const capabilities = JSON.parse(runPnpm(["exec", "starship-builder", "capabilities"], consumer));
  if (capabilities.schemaVersion !== 1 || !capabilities.commands.includes("compare")
    || !capabilities.scenarios.some(({ id }) => id === "failed-command")
    || !capabilities.configSchema.modules.some(({ name }) => name === "git_branch")) {
    throw new Error("Installed CLI did not expose agent capabilities and config schema");
  }
  const agentGuide = runPnpm(["exec", "starship-builder", "agent-guide"], consumer);
  if (!agentGuide.includes("--review-hash") || !agentGuide.includes("compare")) {
    throw new Error("Installed CLI did not include versioned agent instructions");
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
  const invalidState = runPnpmResult(["exec", "starship-builder", "state", invalidPath, "--json"], consumer);
  if (invalidState.status !== 2 || JSON.parse(invalidState.stdout).validation.valid !== false
    || JSON.parse(invalidState.stdout).preview !== null) {
    throw new Error("State did not report invalid config without rendering it");
  }

  const piped = runPnpmResult(["exec", "starship-builder", "validate", "-", "--json"], consumer, "add_newline = false\n");
  if (piped.status !== 0 || JSON.parse(piped.stdout).valid !== true) {
    throw new Error("Installed binary could not validate piped TOML");
  }

  const target = join(consumer, "agent.toml");
  const original = '# keep until applied\nformat = "$directory$character"\n';
  const candidate = 'format = "$directory$git_branch$character"\n';
  await writeFile(target, original);
  const state = runPnpmResult(["exec", "starship-builder", "state", target, "--json", "--scenario", "simple", "--width", "80"], consumer);
  if (state.status !== 0) throw new Error(`State command failed: ${state.stderr}`);
  const snapshot = JSON.parse(state.stdout);
  const originalHash = createHash("sha256").update(original).digest("hex");
  if (state.status !== 0 || snapshot.schemaVersion !== 1 || snapshot.source.hash !== originalHash
    || snapshot.config.format !== "$directory$character" || snapshot.preview.scenario !== "simple"
    || !snapshot.preview.text.includes("❯") || snapshot.validation.valid !== true) {
    throw new Error("Installed binary did not expose a structured agent state snapshot");
  }
  const statePreview = runPnpm(["exec", "starship-builder", "preview", target, "--scenario", "simple", "--width", "80", "--no-color"], consumer);
  if (snapshot.preview.text !== statePreview) throw new Error("State preview differs from the plain CLI preview");
  if (!snapshot.preview.styledLines.some((line) => line.some((run) => run.fg || run.bg))) {
    throw new Error("State does not expose styled preview runs");
  }

  const missingState = runPnpmResult(["exec", "starship-builder", "state", join(consumer, "not-created.toml"), "--json"], consumer);
  if (missingState.status !== 0 || JSON.parse(missingState.stdout).source.kind !== "missing") {
    throw new Error("State could not describe a missing target for first-run agents");
  }
  const rightInput = 'format = "$directory"\nright_format = "$time"\n';
  const rightState = runPnpmResult(["exec", "starship-builder", "state", "-", "--width", "80"], consumer, rightInput);
  const rightPreview = runPnpmResult(["exec", "starship-builder", "preview", "-", "--width", "80", "--no-color"], consumer, rightInput);
  if (rightState.status !== 0 || rightPreview.status !== 0 || JSON.parse(rightState.stdout).preview.text !== rightPreview.stdout) {
    throw new Error("State right-prompt preview differs from the plain CLI preview");
  }

  const review = runPnpmResult(["exec", "starship-builder", "apply", target, "--from", "-", "--json", "--expect-hash", originalHash], consumer, candidate);
  if (review.status !== 0) throw new Error(`Apply review failed: ${review.stderr}`);
  const plan = JSON.parse(review.stdout);
  if (review.status !== 0 || plan.applied !== false || plan.valid !== true
    || !plan.changedPaths.includes("format") || !plan.review.some((line) => line.includes("candidate TOML"))
    || !plan.preview.text.includes("feat/live-preview")) {
    throw new Error("Installed binary did not provide an agent-readable apply review");
  }
  const candidatePreview = runPnpmResult(["exec", "starship-builder", "preview", "-", "--no-color", "--width", String(plan.preview.width)], consumer, candidate);
  if (candidatePreview.status !== 0 || plan.preview.text !== candidatePreview.stdout) {
    throw new Error("Apply candidate preview differs from the plain CLI preview");
  }
  if (await readFile(target, "utf8") !== original) throw new Error("Apply review changed the target");
  if (!/^[a-f0-9]{64}$/.test(plan.reviewHash)) throw new Error("Apply review omitted its approval hash");

  const comparisonPath = join(consumer, "review.html");
  const comparison = runPnpmResult([
    "exec", "starship-builder", "compare", target, "--from", "-", "--json", "--html", comparisonPath,
    "--scenarios", "simple,dirty-repo,failed-command,ssh-root", "--widths", "40,80",
  ], consumer, candidate);
  const comparisons = JSON.parse(comparison.stdout);
  if (comparison.status !== 0 || comparisons.comparisons.length !== 8
    || !comparisons.changedPaths.includes("format") || comparisons.htmlPath !== comparisonPath
    || !comparisons.afterShareUrl.startsWith("https://starship.ndl.au/#")) {
    throw new Error("Compare did not review candidate across scenarios and widths");
  }
  const comparisonHtml = await readFile(comparisonPath, "utf8");
  if (!comparisonHtml.includes("Starship prompt comparison") || !comparisonHtml.includes("Proposed")
    || !comparisonHtml.includes("color:")) {
    throw new Error("Compare did not produce a styled self-contained review");
  }
  if (await readFile(target, "utf8") !== original) throw new Error("Compare changed the target");

  const changedCandidate = runPnpmResult([
    "exec", "starship-builder", "apply", target, "--from", "-", "--yes", "--json", "--review-hash", plan.reviewHash,
  ], consumer, 'format = "$character"\n');
  if (changedCandidate.status !== 1 || JSON.parse(changedCandidate.stdout).error.code !== "conflict"
    || await readFile(target, "utf8") !== original) {
    throw new Error("Reviewed candidate changed before apply without rejection");
  }

  const invalidApply = runPnpmResult(["exec", "starship-builder", "apply", target, "--from", "-", "--yes", "--json"], consumer, 'add_newline = "false"\n');
  if (invalidApply.status !== 2 || JSON.parse(invalidApply.stdout).valid !== false || await readFile(target, "utf8") !== original) {
    throw new Error("Apply wrote a candidate with invalid Starship options");
  }

  const malformedApply = runPnpmResult(["exec", "starship-builder", "apply", target, "--from", "-", "--yes"], consumer, "[broken\n");
  if (malformedApply.status !== 1 || !malformedApply.stderr.includes("Cannot parse candidate") || await readFile(target, "utf8") !== original) {
    throw new Error("Apply wrote malformed TOML");
  }

  const strictApply = runPnpmResult(["exec", "starship-builder", "apply", target, "--from", "-", "--yes", "--strict", "--json"], consumer, "future_option = true\n");
  if (strictApply.status !== 2 || JSON.parse(strictApply.stdout).valid !== false || await readFile(target, "utf8") !== original) {
    throw new Error("Strict apply wrote a candidate with unknown options");
  }

  const applied = runPnpmResult(["exec", "starship-builder", "apply", target, "--from", "-", "--yes", "--json", "--expect-hash", originalHash, "--review-hash", plan.reviewHash], consumer, candidate);
  const result = JSON.parse(applied.stdout);
  if (applied.status !== 0 || result.applied !== true || result.backupPath !== `${target}.bak`
    || await readFile(target, "utf8") !== candidate || await readFile(`${target}.bak`, "utf8") !== original) {
    throw new Error("Apply did not save candidate bytes with a backup");
  }

  const stale = runPnpmResult(["exec", "starship-builder", "apply", target, "--from", "-", "--yes", "--expect-hash", originalHash], consumer, original);
  if (stale.status !== 1 || !stale.stderr.includes("changed after it was loaded") || await readFile(target, "utf8") !== candidate) {
    throw new Error("Apply overwrote a target after a stale agent snapshot");
  }

  const malformedTarget = join(consumer, "malformed-current.toml");
  const malformedSource = "[broken\n";
  await writeFile(malformedTarget, malformedSource);
  const malformedState = runPnpmResult(["exec", "starship-builder", "state", malformedTarget, "--json"], consumer);
  const malformedSnapshot = JSON.parse(malformedState.stdout);
  if (malformedState.status !== 2 || malformedSnapshot.validation.diagnostics[0]?.code !== "toml-parse"
    || malformedSnapshot.raw !== malformedSource || malformedSnapshot.preview !== null) {
    throw new Error("State did not provide recoverable malformed TOML details");
  }
  const sharedUrl = runPnpm(["exec", "starship-builder", "share", target], consumer).trim();
  const sharedState = runPnpmResult(["exec", "starship-builder", "state", malformedTarget, "--from-share", sharedUrl, "--json"], consumer);
  if (sharedState.status !== 0 || !JSON.parse(sharedState.stdout).validation.valid
    || JSON.parse(sharedState.stdout).preview === null) {
    throw new Error("A shared config did not replace an invalid local file for state inspection");
  }
  const repairReviewResult = runPnpmResult(["exec", "starship-builder", "apply", malformedTarget, "--from", "-", "--json"], consumer, candidate);
  if (repairReviewResult.status !== 0) throw new Error(`Malformed target review failed: ${repairReviewResult.stderr}`);
  const repairReview = JSON.parse(repairReviewResult.stdout);
  const repaired = runPnpmResult([
    "exec", "starship-builder", "apply", malformedTarget, "--from", "-", "--yes", "--json",
    "--expect-hash", malformedSnapshot.source.hash, "--review-hash", repairReview.reviewHash,
  ], consumer, candidate);
  if (repaired.status !== 0 || !JSON.parse(repaired.stdout).applied
    || await readFile(malformedTarget, "utf8") !== candidate
    || await readFile(`${malformedTarget}.bak`, "utf8") !== malformedSource) {
    throw new Error("Apply could not repair a malformed current TOML with review and backup");
  }

  const newTarget = join(consumer, "new-agent.toml");
  const newCandidate = join(consumer, "new-candidate.toml");
  await writeFile(newCandidate, candidate);
  const newReview = runPnpmResult(["exec", "starship-builder", "apply", newTarget, "--from", newCandidate, "--json", "--expect-hash", "none"], consumer);
  if (newReview.status !== 0 || JSON.parse(newReview.stdout).beforeHash !== null) {
    throw new Error("Apply could not review a new target from a candidate file");
  }
  try {
    await stat(newTarget);
    throw new Error("Apply review created a new target without --yes");
  } catch (error) {
    if (error.message === "Apply review created a new target without --yes") throw error;
    if (error.code !== "ENOENT") throw error;
  }
  const newApply = runPnpmResult(["exec", "starship-builder", "apply", newTarget, "--from", newCandidate, "--yes", "--json", "--expect-hash", "none"], consumer);
  if (newApply.status !== 0 || JSON.parse(newApply.stdout).applied !== true || await readFile(newTarget, "utf8") !== candidate) {
    throw new Error("Apply could not create a new target from a candidate file");
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
