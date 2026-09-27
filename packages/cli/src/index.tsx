import process from "node:process";
import { parseArgs } from "node:util";

import React from "react";
import { render } from "ink";

import { BuilderApp } from "./App";
import { loadConfig, type LoadedConfig } from "./configFile";
import { shellCompletion } from "./completions";
import { rightPromptGap } from "./terminalWidth";
import { validateConfig, type ConfigDiagnostic } from "@/lib/config/diagnostics";
import { PRESETS } from "@/lib/config/presets";
import { resolveDefaults } from "@/lib/config/defaults";
import { serialiseConfig } from "@/lib/config/toml";
import { parseConfig } from "@/lib/config/toml";
import { decodeShare, encodeShare } from "@/lib/config/share";
import { segmentsToAnsi } from "@/lib/engine/ansi";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt } from "@/lib/engine/prompt";
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
  starship-builder export [path] [--full]
  starship-builder share [path]
  starship-builder presets
  starship-builder completions <bash|zsh|fish>

Examples:
  starship-builder edit ~/.config/starship.toml
  starship-builder preview - --width 100 --no-color < starship.toml
  starship-builder validate - --json < starship.toml
  starship-builder share starship.toml

Options:
  -c, --config <path>     Config to open (default: $STARSHIP_CONFIG or ~/.config/starship.toml)
  -p, --preset <id>       Start from a bundled preset
  -s, --scenario <id>     Preview scenario (default: dirty-repo)
      --width <columns>   Preview width (minimum 20)
      --json              JSON diagnostics for validate
      --strict            Treat validation warnings as failures
      --no-color          Disable colors in the prompt preview
      --full              Include default values when exporting
      --from-share <url>  Open a config-only browser share link
  -h, --help              Show this help
  -v, --version           Show the version

Interactive keys:
  ↑↓/jk navigate · Enter edit · Space toggle · a add · m move
  1/2/3 workspaces · Tab left/right · : action search · P palettes
  Ctrl+Z/Y undo/redo · Ctrl+S review save · ? help · q quit

An edited save regenerates TOML; review the complete diff first. The preview
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

  const knownCommands = new Set(["edit", "preview", "validate", "export", "share", "presets", "completions"]);
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

  if (parsed.values.json && command !== "validate") throw new Error("--json is only available with validate.");
  if (parsed.values.strict && command !== "validate") throw new Error("--strict is only available with validate.");
  const loaded: LoadedConfig = path === "-" ? await (async () => {
    if (command === "edit") throw new Error("Interactive editing cannot read from stdin; use a file path.");
    const text = await readStdin();
    const result = parseConfig(text);
    if (!result.ok) throw new Error(`Cannot parse stdin: ${result.error}`);
    return { config: result.config, originalContent: text, source: "file" as const, sourceLabel: "stdin", displayPath: "(stdin)", writePath: "(stdin)", expectedHash: null };
  })() : await loadConfig({
    path,
    preset: parsed.values.preset,
    requireFile: command !== "edit" && !parsed.values.preset && !parsed.values["from-share"],
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
