import { rightPromptGap } from "./terminalWidth";
import { moduleDefinitionsForConfig } from "@/lib/engine/modules";
import { renderPrompt, type StarshipConfig } from "@/lib/engine/prompt";
import { PROMPT_ORDER } from "@/lib/engine/promptOrder";
import { NAMED_COLORS, segmentsText, type Color, type Segment, type Style } from "@/lib/engine/types";
import { getScenario, listScenarios } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios/types";
import { getTheme, xterm256, type TerminalTheme } from "@/lib/terminalThemes";

const DEFAULT_COMPARE_SCENARIOS = ["simple", "dirty-repo", "failed-command", "ssh-root"];
const DEFAULT_COMPARE_WIDTHS = [40, 80];

export function previewWidth(option: string | undefined, fallback: number): number {
  const width = option === undefined ? Math.max(20, process.stdout.columns ?? fallback) : Number(option);
  if (!Number.isInteger(width) || width < 20 || width > 500) {
    throw new Error("--width must be an integer from 20 to 500 columns.");
  }
  return width;
}

export function selectedScenarios(option?: string): string[] {
  const ids = option ? option.split(",").map((id) => id.trim()) : DEFAULT_COMPARE_SCENARIOS;
  if (ids.length === 0 || ids.length > 12 || ids.some((id) => !listScenarios().some((scenario) => scenario.id === id))) {
    throw new Error(`--scenarios must list 1–12 known IDs: ${listScenarios().map((scenario) => scenario.id).join(", ")}.`);
  }
  return [...new Set(ids)];
}

export function selectedWidths(option?: string): number[] {
  const widths = option ? option.split(",").map(Number) : DEFAULT_COMPARE_WIDTHS;
  if (widths.length === 0 || widths.length > 6 || widths.some((width) => !Number.isInteger(width) || width < 20 || width > 500)) {
    throw new Error("--widths must list 1–6 integer widths from 20 to 500 columns.");
  }
  return [...new Set(widths)];
}

export function promptPreview(config: StarshipConfig, scenarioId: string, widthOption?: string, scenarioFile?: Scenario) {
  const scenario = scenarioFile ?? getScenario(scenarioId);
  if (!scenarioFile && scenario.id !== scenarioId) throw new Error(`Unknown scenario: ${scenarioId}`);
  const width = previewWidth(widthOption, scenario.terminalWidth);
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
  return {
    scenario: scenario.id,
    width,
    leadingNewline: rendered.leadingNewline,
    lines,
    right,
    text,
    warnings: rendered.warnings,
    // Consumers that want a styled preview can render these runs with their
    // chosen terminal palette. Plain text remains the stable baseline.
    styledLines: rendered.lines.map((line) => serialiseSegments(line)),
    styledRight: serialiseSegments(rendered.right),
  };
}

type Run = { text: string; fg?: Color; bg?: Color; modifiers: string[] };

function serialiseSegments(segments: Segment[]): Run[] {
  let previous: Style | undefined;
  return segments.flatMap((segment) => {
    if (segment.kind !== "text" || !segment.value) return [];
    const style = segment.style;
    const resolve = (color: Color | undefined): Color | undefined =>
      color?.kind === "prev" ? previous?.[color.source] : color;
    const fg = resolve(style?.fg);
    const bg = resolve(style?.bg);
    previous = { fg, bg, modifiers: new Set(style?.modifiers ?? []) };
    return [{ text: segment.value, fg, bg, modifiers: [...(style?.modifiers ?? [])] }];
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function colorCss(color: Color | undefined, theme: TerminalTheme): string | undefined {
  if (!color) return undefined;
  if (color.kind === "named") return theme.ansi[NAMED_COLORS.indexOf(color.name)];
  if (color.kind === "fixed") return xterm256(color.index, theme);
  if (color.kind === "rgb") return `rgb(${color.r},${color.g},${color.b})`;
  return undefined;
}

function renderRuns(runs: Run[], theme: TerminalTheme): string {
  return runs.map((run) => {
    let fg = colorCss(run.fg, theme);
    let bg = colorCss(run.bg, theme);
    if (run.modifiers.includes("inverted")) {
      [fg, bg] = [bg ?? theme.background, fg ?? theme.foreground];
    }
    const css = [
      fg ? `color:${fg}` : "",
      bg ? `background:${bg}` : "",
      run.modifiers.includes("bold") ? "font-weight:700" : "",
      run.modifiers.includes("italic") ? "font-style:italic" : "",
      run.modifiers.includes("dimmed") ? "opacity:.6" : "",
      run.modifiers.includes("hidden") ? "visibility:hidden" : "",
      run.modifiers.includes("underline") || run.modifiers.includes("strikethrough")
        ? `text-decoration:${[run.modifiers.includes("underline") ? "underline" : "", run.modifiers.includes("strikethrough") ? "line-through" : ""].filter(Boolean).join(" ")}` : "",
    ].filter(Boolean).join(";");
    return `<span${css ? ` style="${css}"` : ""}>${escapeHtml(run.text)}</span>`;
  }).join("");
}

export interface ComparisonCell {
  scenario: string;
  label: string;
  width: number;
  before: ReturnType<typeof promptPreview> | null;
  after: ReturnType<typeof promptPreview>;
}

export function comparisonHtml(cells: ComparisonCell[], changedPaths: string[], themeId = "tokyo-night"): string {
  const theme = getTheme(themeId);
  const prompt = (preview: ReturnType<typeof promptPreview> | null) => {
    if (!preview) return "<p>Current file cannot be previewed.</p>";
    const lines = preview.styledLines.map((runs, index) => {
      const right = index === preview.styledLines.length - 1 && preview.right
        ? rightPromptGap(preview.lines[index], preview.right, preview.width) : null;
      return `${renderRuns(runs, theme)}${right === null ? "" : `${" ".repeat(right)}${renderRuns(preview.styledRight, theme)}`}`;
    });
    return `<pre class="prompt" style="color:${theme.foreground};background:${theme.background}">${preview.leadingNewline ? "\n" : ""}${lines.join("\n")}\n</pre>`;
  };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Starship prompt comparison</title><style>body{font:16px system-ui;background:#111827;color:#f3f4f6;max-width:1100px;margin:auto;padding:24px}h1{font-size:1.5rem}h2{font-size:1.1rem}section{border:1px solid #475569;border-radius:12px;padding:16px;margin:20px 0}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px}.prompt{font:14px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre;overflow:auto;padding:16px;border-radius:8px;min-height:5em}.label{font-weight:600;margin-bottom:6px}.meta{color:#cbd5e1}</style><main><h1>Starship prompt comparison</h1><p class="meta">Simulated previews. Custom module commands are never run.</p><p>Changed options: ${escapeHtml(changedPaths.join(", ") || "none")}</p>${cells.map((cell) => `<section><h2>${escapeHtml(cell.label)} · ${cell.width} columns</h2><div class="pair"><div><div class="label">Current</div>${prompt(cell.before)}</div><div><div class="label">Proposed</div>${prompt(cell.after)}</div></div></section>`).join("")}</main></html>`;
}
