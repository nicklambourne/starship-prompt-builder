import process from "node:process";
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";

import React from "react";
import { render } from "ink";

import { BuilderApp } from "./App";
import { ConfigConflictError, expandPath, hashContent, loadConfig, saveConfig, type LoadedConfig } from "./configFile";
import { shellCompletion } from "./completions";
import { changedPaths, reviewLines } from "./documentReview";
import { rightPromptGap } from "./terminalWidth";
import { validateConfig, type ConfigDiagnostic } from "@/lib/config/diagnostics";
import { PRESETS } from "@/lib/config/presets";
import { resolveDefaults } from "@/lib/config/defaults";
import { serialiseConfig } from "@/lib/config/toml";
import { parseConfig } from "@/lib/config/toml";
import { decodeShare, encodeShare } from "@/lib/config/share";
import { segmentsToAnsi } from "@/lib/engine/ansi";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt, type StarshipConfig } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { segmentsText } from "@/lib/engine/types";
import { getScenario } from "@/lib/scenarios";

declare const __CLI_VERSION__: string;
const VERSION = __CLI_VERSION__;

const HELP = `Starship Prompt Builder for the terminal

Usage:
  starship-builder [edit] [path] [options]
  starship-builder preview [path] [options]
  starship-builder validate [path]
  starship-builder state [path] [--json]
  starship-builder apply <path> --from <candidate.toml|-> [--yes]
  starship-builder export [path] [--full]
  starship-builder share [path]
  starship-builder presets
  starship-builder completions <bash|zsh|fish>

Examples:
  starship-builder edit ~/.config/starship.toml
  starship-builder preview - --width 100 --no-color < starship.toml
  starship-builder validate - --json < starship.toml
  starship-builder state ~/.config/starship.toml --json --scenario simple
  starship-builder apply ~/.config/starship.toml --from candidate.toml --json
  starship-builder apply ~/.config/starship.toml --from candidate.toml --yes --expect-hash SHA256_FROM_STATE
  starship-builder share starship.toml

Options:
  -c, --config <path>     Config to open (default: $STARSHIP_CONFIG or ~/.config/starship.toml)
  -p, --preset <id>       Start from a bundled preset
  -s, --scenario <id>     Preview scenario (default: dirty-repo)
      --width <columns>   Preview width for preview, state, and apply (minimum 20)
      --json              JSON output for validate, state, and apply
      --strict            Treat validation warnings as failures
      --from <path|->     Candidate TOML for apply (file or stdin)
      --yes               Write an apply candidate after validation
      --expect-hash <hash|none>  Refuse apply if target changed since state
      --no-color          Disable colors in the prompt preview
      --full              Include default values when exporting
      --from-share <url>  Open a config-only browser share link
  -h, --help              Show this help
  -v, --version           Show the version

Interactive keys:
  ↑↓/jk navigate · Enter edit · Space toggle · a add · m move
  1/2/3 workspaces · Tab left/right · : action search · P palettes
  Ctrl+Z/Y undo/redo · Ctrl+S review save · ? help · q quit

An edited TUI save regenerates TOML; review the complete diff first. Apply
copies validated candidate bytes exactly and only writes with --yes. The preview
uses simulated data and never executes custom-module commands.`;

async function readStdin(maxBytes = 2 * 1024 * 1024): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) throw new Error("Standard input exceeds 2 MiB.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function safeTerminalText(value: string): string {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, "?");
}

function printDiagnostic(item: ConfigDiagnostic): void {
  const location = item.index === undefined ? "" : ` at character ${item.index + 1}`;
  process.stderr.write(`${item.severity} [${item.code}] ${safeTerminalText(item.path)}${location}: ${safeTerminalText(item.message)}\n`);
}

function plainPreview(config: StarshipConfig, scenarioId: string, widthOption?: string) {
  const scenario = getScenario(scenarioId);
  if (scenario.id !== scenarioId) throw new Error(`Unknown scenario: ${scenarioId}`);
  const requestedWidth = widthOption === undefined ? undefined : Number(widthOption);
  if (requestedWidth !== undefined && (!Number.isInteger(requestedWidth) || requestedWidth < 20)) {
    throw new Error("--width must be an integer of at least 20 columns.");
  }
  const width = requestedWidth ?? Math.max(20, process.stdout.columns ?? scenario.terminalWidth);
  const rendered = renderPrompt({
    config,
    scenario: { ...scenario, terminalWidth: width },
    modules: moduleDefinitionsForConfig(config),
    defaultOrder: PROMPT_ORDER,
  });
  const lines = rendered.lines.map(segmentsText);
  const right = segmentsText(rendered.right);
  const text = `${rendered.leadingNewline ? "\n" : ""}${lines.map((line, index) => {
    const gap = index === lines.length - 1 && right.length > 0 ? rightPromptGap(line, right, width) : null;
    return `${line}${gap === null ? "" : `${" ".repeat(gap)}${right}`}\n`;
  }).join("")}`;
  return { scenario: scenario.id, width, leadingNewline: rendered.leadingNewline, lines, right, text, warnings: rendered.warnings };
}

async function main() {
  const parsed = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      config: { type: "string", short: "c" },
      preset: { type: "string", short: "p" },
      scenario: { type: "string", short: "s", default: "dirty-repo" },
      width: { type: "string" },
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      "no-color": { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      from: { type: "string" },
      yes: { type: "boolean", default: false },
      "expect-hash": { type: "string" },
      "from-share": { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });

  if (parsed.values.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (parsed.values.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const knownCommands = new Set(["edit", "preview", "validate", "state", "apply", "export", "share", "presets", "completions"]);
  const first = parsed.positionals[0];
  const command = first && knownCommands.has(first) ? first : "edit";
  const path = parsed.values.config
    ?? (command === "edit" && first && !knownCommands.has(first) ? first : parsed.positionals[1]);

  if (command === "presets") {
    for (const preset of PRESETS) process.stdout.write(`${preset.id.padEnd(34)} ${preset.label}\n`);
    return;
  }
  if (command === "completions") {
    process.stdout.write(shellCompletion(parsed.positionals[1] ?? ""));
    return;
  }

  if (parsed.values.json && !["validate", "state", "apply"].includes(command)) throw new Error("--json is only available with validate, state, or apply.");
  if (parsed.values.strict && !["validate", "state", "apply"].includes(command)) throw new Error("--strict is only available with validate, state, or apply.");
  if (command !== "apply" && (parsed.values.from !== undefined || parsed.values.yes || parsed.values["expect-hash"] !== undefined)) {
    throw new Error("--from, --yes, and --expect-hash are only available with apply.");
  }
  if (command === "apply") {
    if (!path || path === "-") throw new Error("Apply requires an explicit target file path.");
    if (!parsed.values.from) throw new Error("Apply requires --from <candidate.toml|->.");
    if (parsed.values.preset || parsed.values["from-share"]) throw new Error("Apply reads a target file and cannot start from a preset or share link.");
    const expected = parsed.values["expect-hash"];
    if (expected !== undefined && expected !== "none" && !/^[a-f0-9]{64}$/.test(expected)) {
      throw new Error("--expect-hash must be a SHA-256 hex digest or none.");
    }
  }
  const loaded: LoadedConfig = path === "-" ? await (async () => {
    if (command === "edit") throw new Error("Interactive editing cannot read from stdin; use a file path.");
    const text = await readStdin();
    const result = parseConfig(text);
    if (!result.ok) throw new Error(`Cannot parse stdin: ${result.error}`);
    return { config: result.config, originalContent: text, source: "file" as const, sourceLabel: "stdin", displayPath: "(stdin)", writePath: "(stdin)", expectedHash: null };
  })() : await loadConfig({
    path,
    preset: parsed.values.preset,
    requireFile: command !== "edit" && command !== "apply" && !parsed.values.preset && !parsed.values["from-share"],
  });
  if (parsed.values["from-share"]) {
    const url = parsed.values["from-share"];
    const config = decodeShare(url.includes("#") ? url.slice(url.indexOf("#")) : url);
    if (!config) throw new Error("Invalid or unsupported config-only share link.");
    loaded.config = config;
    loaded.source = "preset";
    loaded.sourceLabel = "browser share link";
    loaded.originalContent = null;
  }
  if (command === "apply") {
    const expected = parsed.values["expect-hash"];
    if (expected !== undefined && (expected === "none" ? null : expected) !== loaded.expectedHash) {
      throw new ConfigConflictError(loaded.displayPath);
    }
    const candidate = parsed.values.from === "-"
      ? await readStdin()
      : await readFile(expandPath(parsed.values.from!), "utf8");
    if (Buffer.byteLength(candidate) > 2 * 1024 * 1024) throw new Error("Candidate exceeds 2 MiB.");
    const parsedCandidate = parseConfig(candidate);
    if (!parsedCandidate.ok) {
      const location = parsedCandidate.line ? ` at line ${parsedCandidate.line}` : "";
      throw new Error(`Cannot parse candidate${location}: ${parsedCandidate.error}`);
    }
    const candidateDiagnostics = validateConfig(parsedCandidate.config);
    const valid = !candidateDiagnostics.some((item) => item.severity === "error" || parsed.values.strict && item.severity === "warning");
    const before = loaded.originalContent ?? null;
    const preview = valid ? plainPreview(parsedCandidate.config, parsed.values.scenario, parsed.values.width) : null;
    const report = {
      schemaVersion: 1,
      valid,
      applied: false,
      changed: before !== candidate,
      target: loaded.displayPath,
      beforeHash: loaded.expectedHash,
      afterHash: hashContent(candidate),
      diagnostics: candidateDiagnostics,
      changedPaths: changedPaths(before === null ? {} : loaded.config, parsedCandidate.config),
      review: reviewLines(before, candidate, "candidate TOML (verbatim)"),
      preview,
      backupPath: null as string | null,
      warnings: [] as string[],
    };
    if (valid && parsed.values.yes && report.changed) {
      const saved = await saveConfig({ path: loaded.displayPath, expectedWritePath: loaded.writePath, content: candidate, expectedHash: loaded.expectedHash });
      report.applied = true;
      report.backupPath = saved.backupPath;
      report.warnings = saved.warnings;
    }
    if (parsed.values.json) process.stdout.write(`${JSON.stringify(report)}\n`);
    else {
      candidateDiagnostics.forEach(printDiagnostic);
      report.warnings.forEach((warning) => process.stderr.write(`warning: ${safeTerminalText(warning)}\n`));
      process.stdout.write(`${report.review.join("\n")}\n`);
      if (preview) process.stdout.write(`Preview (${preview.scenario}, ${preview.width} columns):\n${preview.text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "?")}`);
      if (report.applied) process.stdout.write(`Applied ${report.target}${report.backupPath ? `; backup: ${report.backupPath}` : ""}\n`);
      else if (valid && report.changed && !parsed.values.yes) process.stdout.write("No file written. Re-run with --yes to apply this candidate.\n");
    }
    if (!valid) process.exitCode = 2;
    return;
  }
  const diagnostics = validateConfig(loaded.config);
  const failed = diagnostics.some((item) => item.severity === "error" || parsed.values.strict && item.severity === "warning");
  if (command === "validate") {
    if (parsed.values.json) {
      process.stdout.write(`${JSON.stringify({ valid: !failed, diagnostics })}\n`);
    } else {
      diagnostics.forEach(printDiagnostic);
      if (!failed) process.stdout.write(`Valid Starship configuration: ${loaded.sourceLabel}\n`);
    }
    if (failed) process.exitCode = 2;
    return;
  }

  if (command === "state") {
    const hasErrors = diagnostics.some((item) => item.severity === "error");
    const preview = hasErrors ? null : plainPreview(loaded.config, parsed.values.scenario, parsed.values.width);
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      source: { kind: loaded.source, label: loaded.sourceLabel, path: loaded.displayPath, hash: loaded.expectedHash },
      config: loaded.config,
      validation: { valid: !failed, diagnostics },
      preview,
    })}\n`);
    if (failed) process.exitCode = 2;
    return;
  }

  diagnostics.forEach(printDiagnostic);
  if (diagnostics.some((item) => item.severity === "error")) {
    process.exitCode = 2;
    return;
  }

  const definitions = moduleDefinitionsForConfig(loaded.config);
  if (command === "export") {
    process.stdout.write(serialiseConfig(loaded.config, {
      full: parsed.values.full,
      defaults: resolveDefaults(definitions),
    }));
    return;
  }
  if (command === "share") {
    process.stdout.write(`https://starship.ndl.au/#${encodeShare(loaded.config)}\n`);
    return;
  }

  const scenario = getScenario(parsed.values.scenario);
  if (scenario.id !== parsed.values.scenario) {
    throw new Error(`Unknown scenario: ${parsed.values.scenario}`);
  }

  if (command === "preview") {
    const requestedWidth = parsed.values.width === undefined ? undefined : Number(parsed.values.width);
    if (requestedWidth !== undefined && (!Number.isInteger(requestedWidth) || requestedWidth < 20)) {
      throw new Error("--width must be an integer of at least 20 columns.");
    }
    const width = requestedWidth ?? Math.max(20, process.stdout.columns ?? scenario.terminalWidth);
    const rendered = renderPrompt({
      config: loaded.config,
      scenario: { ...scenario, terminalWidth: width },
      modules: definitions,
      defaultOrder: PROMPT_ORDER,
    });
    const color = !parsed.values["no-color"] && process.env.NO_COLOR === undefined;
    if (rendered.leadingNewline) process.stdout.write("\n");
    rendered.lines.forEach((line, index) => {
      const isLast = index === rendered.lines.length - 1 && rendered.right.length > 0;
      const plain = segmentsText(line);
      const gap = isLast ? rightPromptGap(plain, segmentsText(rendered.right), width) : null;
      const right = gap === null ? "" : `${" ".repeat(gap)}${color ? segmentsToAnsi(rendered.right) : segmentsText(rendered.right)}`;
      process.stdout.write(`${color ? segmentsToAnsi(line) : plain}${right}\n`);
    });
    for (const warning of rendered.warnings) process.stderr.write(`warning: ${warning}\n`);
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive mode requires a TTY. Use preview, validate, or export in scripts.");
  }

  const app = render(
    <BuilderApp
      loaded={loaded}
      scenarioId={parsed.values.scenario}
      color={!parsed.values["no-color"] && process.env.NO_COLOR === undefined}
    />,
  );
  await app.waitUntilExit();
}

main().catch((error) => {
  process.stderr.write(`starship-builder: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
