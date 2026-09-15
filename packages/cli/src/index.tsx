import process from "node:process";
import { parseArgs } from "node:util";

import React from "react";
import { render } from "ink";

import { BuilderApp } from "./App";
import { loadConfig } from "./configFile";
import { PRESETS } from "@/lib/config/presets";
import { resolveDefaults } from "@/lib/config/defaults";
import { serialiseConfig } from "@/lib/config/toml";
import { segmentsToAnsi } from "@/lib/engine/ansi";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { segmentsText } from "@/lib/engine/types";
import { getScenario } from "@/lib/scenarios";

const VERSION = "0.1.0";

const HELP = `Starship Prompt Builder for the terminal

Usage:
  starship-builder [edit] [path] [options]
  starship-builder preview [path] [options]
  starship-builder validate [path]
  starship-builder export [path] [--full]
  starship-builder presets

Options:
  -c, --config <path>     Config to open (default: $STARSHIP_CONFIG or ~/.config/starship.toml)
  -p, --preset <id>       Start from a bundled preset
  -s, --scenario <id>     Preview scenario (default: dirty-repo)
      --no-color          Disable colors in the prompt preview
      --full              Include default values when exporting
  -h, --help              Show this help
  -v, --version           Show the version

Interactive keys:
  ↑↓/jk navigate · Enter edit · Space toggle · a add · m move
  Ctrl+Z/Y undo/redo · Ctrl+S save · ? help · q quit`;

function plainWidth(value: string): number {
  return [...value].length;
}

async function main() {
  const parsed = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      config: { type: "string", short: "c" },
      preset: { type: "string", short: "p" },
      scenario: { type: "string", short: "s", default: "dirty-repo" },
      "no-color": { type: "boolean", default: false },
      full: { type: "boolean", default: false },
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

  const knownCommands = new Set(["edit", "preview", "validate", "export", "presets"]);
  const first = parsed.positionals[0];
  const command = first && knownCommands.has(first) ? first : "edit";
  const path = parsed.values.config
    ?? (command === "edit" && first && !knownCommands.has(first) ? first : parsed.positionals[1]);

  if (command === "presets") {
    for (const preset of PRESETS) process.stdout.write(`${preset.id.padEnd(34)} ${preset.label}\n`);
    return;
  }

  const loaded = await loadConfig({ path, preset: parsed.values.preset });
  if (command === "validate") {
    process.stdout.write(`Valid Starship configuration: ${loaded.sourceLabel}\n`);
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

  const scenario = getScenario(parsed.values.scenario);
  if (scenario.id !== parsed.values.scenario) {
    throw new Error(`Unknown scenario: ${parsed.values.scenario}`);
  }

  if (command === "preview") {
    const width = Math.max(20, process.stdout.columns ?? scenario.terminalWidth);
    const rendered = renderPrompt({
      config: loaded.config,
      scenario: { ...scenario, terminalWidth: width },
      modules: definitions,
      defaultOrder: PROMPT_ORDER,
    });
    if (rendered.leadingNewline) process.stdout.write("\n");
    rendered.lines.forEach((line, index) => {
      let output = segmentsToAnsi(line);
      if (index === rendered.lines.length - 1 && rendered.right.length > 0) {
        const gap = Math.max(1, width - plainWidth(segmentsText(line)) - plainWidth(segmentsText(rendered.right)));
        output += `${" ".repeat(gap)}${segmentsToAnsi(rendered.right)}`;
      }
      if (parsed.values["no-color"]) {
        output = segmentsText(line);
        if (index === rendered.lines.length - 1 && rendered.right.length > 0) {
          const gap = Math.max(1, width - plainWidth(output) - plainWidth(segmentsText(rendered.right)));
          output += `${" ".repeat(gap)}${segmentsText(rendered.right)}`;
        }
      }
      process.stdout.write(`${output}\n`);
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
