import process from "node:process";
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

import React from "react";
import { render } from "ink";

import { BuilderApp } from "./App";
import { ConfigConflictError, expandPath, hashContent, loadConfig, saveConfig, type LoadedConfig } from "./configFile";
import { shellCompletion } from "./completions";
import { changedPaths, changedValues, reviewLines } from "./documentReview";
import { comparisonHtml, promptPreview, previewWidth, selectedScenarios, selectedWidths } from "./agentWorkflow";
import { loadScenarioFile } from "./scenarioFile";
import { rightPromptGap } from "./terminalWidth";
import { validateConfig, type ConfigDiagnostic } from "@/lib/config/diagnostics";
import { PRESETS } from "@/lib/config/presets";
import { ROOT_OPTIONS, getModuleSchemas } from "@/lib/config/schema";
import { resolveDefaults } from "@/lib/config/defaults";
import { serialiseConfig } from "@/lib/config/toml";
import { parseConfig } from "@/lib/config/toml";
import { decodeShare, encodeShare } from "@/lib/config/share";
import { segmentsToAnsi } from "@/lib/engine/ansi";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { segmentsText } from "@/lib/engine/types";
import { getScenario, listScenarios } from "@/lib/scenarios";
import { TERMINAL_THEMES } from "@/lib/terminalThemes";

declare const __CLI_VERSION__: string;
const VERSION = __CLI_VERSION__;

const HELP = `Starship Prompt Builder for the terminal

Usage:
  starship-builder [edit] [path] [options]
  starship-builder preview [path] [options]
  starship-builder validate [path]
  starship-builder state [path] [--json]
  starship-builder apply <path> --from <candidate.toml|-> [--yes]
  starship-builder compare <path> --from <candidate.toml|-> [--html review.html]
  starship-builder capabilities
  starship-builder agent-guide
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
  starship-builder apply ~/.config/starship.toml --from candidate.toml --yes --review-hash REVIEW_HASH
  starship-builder compare ~/.config/starship.toml --from candidate.toml --html review.html
  starship-builder share starship.toml

Options:
  -c, --config <path>     Config to open (default: $STARSHIP_CONFIG or ~/.config/starship.toml)
  -p, --preset <id>       Start from a bundled preset
  -s, --scenario <id>     Preview scenario (default: dirty-repo)
      --width <columns>   Preview width for preview, state, and apply (minimum 20)
      --json              JSON output for validate, state, apply, and compare
      --compact           Apply review with changed values only (omit full file bodies)
      --strict            Treat validation warnings as failures
      --from <path|->     Candidate TOML for apply (file or stdin)
      --yes               Write an apply candidate after validation
      --expect-hash <hash|none>  Refuse apply if target changed since state
      --review-hash <hash>  Refuse apply if candidate or target changed since review
      --scenarios <ids>   Comma-separated scenario IDs for compare
      --widths <columns>  Comma-separated terminal widths for compare
      --html <path>       Write a self-contained visual comparison (new file)
      --theme <id>        Terminal palette for comparison HTML
      --scenario-file <path>  Use a versioned custom scenario JSON document
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

const AGENT_GUIDE = `# Starship Prompt Builder agent workflow (v1)

1. Ask what the person wants and which config file is in scope. Run starship-builder capabilities for supported scenarios and options.
2. Run starship-builder state <path> --json. The source hash identifies the disk version. An absent file starts from the bundled preset; a malformed file returns a parse diagnostic and its hash.
3. Write a candidate TOML to a separate file. Preserve options and comments the person did not ask to change. Never execute custom module commands for a preview.
4. Run starship-builder compare <path> --from <candidate> --json --html <new-review.html>. Show the person the visual before/after report, changed options, and diagnostics. CLI share links contain config only; include TOML directly when handing a design to an agent.
5. Run starship-builder apply <path> --from <candidate> --json for a read-only file review. Show the exact candidate and the report's reviewHash. Wait for approval of that review.
6. Apply with starship-builder apply <path> --from <candidate> --yes --review-hash <reviewHash> --expect-hash <beforeHash|none> --json. Check applied and the final afterHash. The previous file is at <path>.bak; review that backup as a candidate before restoring it.

Validation failures exit 2. File, parse, conflict, and usage failures exit 1. With --json, failures produce a JSON error object on stdout. The preview uses simulated shell data; verify the real shell after installation.`;

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

function failureCode(error: unknown): string {
  if (error instanceof ConfigConflictError || error instanceof ReviewConflictError) return "conflict";
  if (error instanceof SyntaxError) return "parse";
  const code = (error as NodeJS.ErrnoException).code;
  if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS")) return "usage";
  if (typeof code === "string" && /^E[A-Z]+$/.test(code)) return "file";
  const message = (error as Error).message ?? "";
  if (/Cannot parse|Cannot load|TOML/i.test(message)) return "parse";
  if (/does not exist/i.test(message)) return "file";
  if (/Unknown|requires|only available|must be|Invalid|Unsupported|Option|argument/i.test(message)) return "usage";
  return "runtime";
}

class ReviewConflictError extends Error {
  constructor() {
    super("Candidate or target changed since the reviewed proposal. Review it again.");
  }
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
      compact: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      "no-color": { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      from: { type: "string" },
      yes: { type: "boolean", default: false },
      "expect-hash": { type: "string" },
      "review-hash": { type: "string" },
      scenarios: { type: "string" },
      widths: { type: "string" },
      html: { type: "string" },
      theme: { type: "string" },
      "scenario-file": { type: "string" },
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

  const knownCommands = new Set(["edit", "preview", "validate", "state", "apply", "compare", "capabilities", "agent-guide", "export", "share", "presets", "completions"]);
  const first = parsed.positionals[0];
  const command = first && knownCommands.has(first) ? first : "edit";
  const path = parsed.values.config
    ?? (command === "edit" && first && !knownCommands.has(first) ? first : parsed.positionals[1]);

  if (command === "presets") {
    if (parsed.values.json) process.stdout.write(`${JSON.stringify(PRESETS.map(({ id, label, description }) => ({ id, label, description })))}\n`);
    else for (const preset of PRESETS) process.stdout.write(`${preset.id.padEnd(34)} ${preset.label}\n`);
    return;
  }
  if (command === "capabilities") {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      cliVersion: VERSION,
      commands: [...knownCommands],
      scenarios: listScenarios().map(({ id, label, description, terminalWidth }) => ({ id, label, description, terminalWidth })),
      themes: TERMINAL_THEMES.map(({ id, label }) => ({ id, label })),
      presets: PRESETS.map(({ id, label, description }) => ({ id, label, description })),
      configSchema: { root: ROOT_OPTIONS, modules: getModuleSchemas() },
      agentGuide: "starship-builder agent-guide",
    })}\n`);
    return;
  }
  if (command === "agent-guide") {
    process.stdout.write(`${AGENT_GUIDE}\n`);
    return;
  }
  if (command === "completions") {
    process.stdout.write(shellCompletion(parsed.positionals[1] ?? ""));
    return;
  }

  if (parsed.values.json && !["validate", "state", "apply", "compare"].includes(command)) throw new Error("--json is only available with validate, state, apply, compare, presets, or capabilities.");
  if (parsed.values.strict && !["validate", "state", "apply", "compare"].includes(command)) throw new Error("--strict is only available with validate, state, apply, or compare.");
  if (parsed.values.compact && command !== "apply") throw new Error("--compact is only available with apply.");
  if (!["apply", "compare"].includes(command) && parsed.values.from !== undefined) throw new Error("--from is only available with apply or compare.");
  if (command !== "apply" && (parsed.values.yes || parsed.values["expect-hash"] !== undefined || parsed.values["review-hash"] !== undefined)) {
    throw new Error("--yes, --expect-hash, and --review-hash are only available with apply.");
  }
  if (command !== "compare" && (parsed.values.scenarios || parsed.values.widths || parsed.values.html || parsed.values.theme)) {
    throw new Error("--scenarios, --widths, --html, and --theme are only available with compare.");
  }
  if (parsed.values["scenario-file"] && !["preview", "state", "apply", "compare"].includes(command)) {
    throw new Error("--scenario-file is only available with preview, state, apply, or compare.");
  }
  if (command === "apply" || command === "compare") {
    if (!path || path === "-") throw new Error(`${command} requires an explicit target file path.`);
    if (!parsed.values.from) throw new Error(`${command} requires --from <candidate.toml|->.`);
    if (parsed.values.preset || parsed.values["from-share"]) throw new Error(`${command} reads a target file and cannot start from a preset or share link.`);
  }
  if (command === "apply") {
    const expected = parsed.values["expect-hash"];
    if (expected !== undefined && expected !== "none" && !/^[a-f0-9]{64}$/.test(expected)) {
      throw new Error("--expect-hash must be a SHA-256 hex digest or none.");
    }
    if (parsed.values["review-hash"] !== undefined && !/^[a-f0-9]{64}$/.test(parsed.values["review-hash"])) {
      throw new Error("--review-hash must be a SHA-256 hex digest.");
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
    requireFile: !["edit", "apply", "compare", "state"].includes(command) && !parsed.values.preset && !parsed.values["from-share"],
    allowInvalid: ["apply", "compare", "state"].includes(command),
  });
  if (parsed.values["from-share"]) {
    const url = parsed.values["from-share"];
    const config = decodeShare(url.includes("#") ? url.slice(url.indexOf("#")) : url);
    if (!config) throw new Error("Invalid or unsupported config-only share link.");
    loaded.config = config;
    loaded.source = "preset";
    loaded.sourceLabel = "browser share link";
    loaded.originalContent = null;
    loaded.parseError = undefined;
  }
  const customScenario = parsed.values["scenario-file"]
    ? await loadScenarioFile(expandPath(parsed.values["scenario-file"]))
    : undefined;
  if (command === "apply" || command === "compare") {
    if (command === "compare") {
      selectedScenarios(parsed.values.scenarios);
      selectedWidths(parsed.values.widths);
      if (parsed.values.theme && !TERMINAL_THEMES.some((theme) => theme.id === parsed.values.theme)) {
        throw new Error(`Unknown terminal theme: ${parsed.values.theme}`);
      }
    }
    const expected = parsed.values["expect-hash"];
    if (command === "apply" && expected !== undefined && (expected === "none" ? null : expected) !== loaded.expectedHash) {
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
    const preview = valid && command === "apply" ? promptPreview(parsedCandidate.config, parsed.values.scenario, parsed.values.width, customScenario) : null;
    const changes = changedPaths(before === null || loaded.parseError ? {} : loaded.config, parsedCandidate.config);
    const values = changedValues(before === null || loaded.parseError ? {} : loaded.config, parsedCandidate.config);
    if (command === "compare") {
      const scenarioIds = selectedScenarios(parsed.values.scenarios);
      if (customScenario && !scenarioIds.includes(customScenario.id)) scenarioIds.push(customScenario.id);
      const cells = valid ? scenarioIds.flatMap((scenario) =>
        selectedWidths(parsed.values.widths).map((width) => {
          const override = scenario === customScenario?.id ? customScenario : undefined;
          return {
            scenario,
            label: override?.label ?? getScenario(scenario).label,
            width,
            before: loaded.parseError ? null : promptPreview(loaded.config, scenario, String(width), override),
            after: promptPreview(parsedCandidate.config, scenario, String(width), override),
          };
        })) : [];
      const htmlPath = parsed.values.html ? expandPath(parsed.values.html) : null;
      if (htmlPath && valid) {
        await writeFile(htmlPath, comparisonHtml(cells, changes, parsed.values.theme), { flag: "wx", mode: 0o600 });
      }
      const report = {
        schemaVersion: 1,
        valid,
        target: loaded.displayPath,
        beforeHash: loaded.expectedHash,
        afterHash: hashContent(candidate),
        beforeParseError: loaded.parseError ?? null,
        diagnostics: candidateDiagnostics,
        changedPaths: changes,
        changes: values,
        htmlPath: valid ? htmlPath : null,
        beforeShareUrl: loaded.parseError ? null : `https://starship.ndl.au/#${encodeShare(loaded.config)}`,
        afterShareUrl: valid ? `https://starship.ndl.au/#${encodeShare(parsedCandidate.config)}` : null,
        comparisons: cells,
      };
      if (parsed.values.json) process.stdout.write(`${JSON.stringify(report)}\n`);
      else {
        candidateDiagnostics.forEach(printDiagnostic);
        process.stdout.write(`Changed options: ${changes.join(", ") || "none"}\n`);
        for (const cell of cells) process.stdout.write(`\n${cell.scenario} (${cell.width} columns)\nCurrent:\n${cell.before?.text ?? "Cannot preview malformed current TOML.\n"}Proposed:\n${cell.after.text}`);
        if (htmlPath && valid) process.stdout.write(`\nVisual review: ${htmlPath}\n`);
      }
      if (!valid) process.exitCode = 2;
      return;
    }
    const afterHash = hashContent(candidate);
    const reviewHash = hashContent(JSON.stringify([loaded.writePath, loaded.expectedHash, afterHash]));
    if (parsed.values["review-hash"] && parsed.values["review-hash"] !== reviewHash) throw new ReviewConflictError();
    const report = {
      schemaVersion: 1,
      valid,
      applied: false,
      changed: before !== candidate,
      target: loaded.displayPath,
      beforeHash: loaded.expectedHash,
      afterHash,
      reviewHash,
      beforeParseError: loaded.parseError ?? null,
      diagnostics: candidateDiagnostics,
      changedPaths: changes,
      changes: values,
      review: parsed.values.compact ? null : reviewLines(before, candidate, "candidate TOML (verbatim)"),
      preview,
      backupPath: null as string | null,
    };
    if (valid && parsed.values.yes && report.changed) {
      const saved = await saveConfig({ path: loaded.writePath, content: candidate, expectedHash: loaded.expectedHash });
      report.applied = true;
      report.backupPath = saved.backupPath;
    }
    if (parsed.values.json) process.stdout.write(`${JSON.stringify(report)}\n`);
    else {
      candidateDiagnostics.forEach(printDiagnostic);
      process.stdout.write(parsed.values.compact
        ? `${JSON.stringify(report.changes, null, 2)}\n`
        : `${report.review?.join("\n")}\n`);
      if (preview) process.stdout.write(`Preview (${preview.scenario}, ${preview.width} columns):\n${preview.text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "?")}`);
      if (report.applied) process.stdout.write(`Applied ${report.target}${report.backupPath ? `; backup: ${report.backupPath}` : ""}\n`);
      else if (valid && report.changed && !parsed.values.yes) process.stdout.write("No file written. Re-run with --yes to apply this candidate.\n");
    }
    if (!valid) process.exitCode = 2;
    return;
  }
  const diagnostics: ConfigDiagnostic[] = loaded.parseError
    ? [{ code: "toml-parse", severity: "error", path: loaded.displayPath, message: loaded.parseError.message, line: loaded.parseError.line }]
    : validateConfig(loaded.config);
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
    const preview = hasErrors ? null : promptPreview(loaded.config, parsed.values.scenario, parsed.values.width, customScenario);
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      source: { kind: loaded.expectedHash === null && loaded.source === "preset" && !parsed.values.preset && !parsed.values["from-share"] ? "missing" : loaded.source, label: loaded.sourceLabel, path: loaded.displayPath, hash: loaded.expectedHash },
      config: loaded.parseError ? null : loaded.config,
      raw: loaded.parseError ? loaded.originalContent : undefined,
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

  const scenario = customScenario ?? getScenario(parsed.values.scenario);
  if (!customScenario && scenario.id !== parsed.values.scenario) {
    throw new Error(`Unknown scenario: ${parsed.values.scenario}`);
  }

  if (command === "preview") {
    const width = previewWidth(parsed.values.width, scenario.terminalWidth);
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
  if (process.argv.includes("--json") || process.argv.some((arg) => ["state", "capabilities"].includes(arg))) {
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, ok: false, error: { code: failureCode(error), message: (error as Error).message } })}\n`);
  } else {
    process.stderr.write(`starship-builder: ${(error as Error).message}\n`);
  }
  process.exitCode = 1;
});
