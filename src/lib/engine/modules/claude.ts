/**
 * Claude Code status-line modules.
 *
 * Unlike ordinary shell modules, these read the JSON context Claude Code
 * passes to Starship on stdin. The browser models that input on Scenario so
 * the engine remains pure and deterministic.
 */

import { renderTime } from "./cmd_duration";
import { renderMeta } from "./shared";
import {
  type ModuleDefinition,
  type ModuleOptions,
  optNumber,
  optString,
} from "./types";

interface DisplayRule {
  threshold: number;
  style: string;
  hidden: boolean;
}

const CONTEXT_DISPLAY: DisplayRule[] = [
  { threshold: 0, style: "bold green", hidden: true },
  { threshold: 30, style: "bold green", hidden: false },
  { threshold: 60, style: "bold yellow", hidden: false },
  { threshold: 80, style: "bold red", hidden: false },
];

const COST_DISPLAY: DisplayRule[] = [
  { threshold: 0, style: "bold green", hidden: true },
  { threshold: 1, style: "bold yellow", hidden: false },
  { threshold: 5, style: "bold red", hidden: false },
];

function readDisplay(options: ModuleOptions, fallback: DisplayRule[]): DisplayRule[] {
  if (!Array.isArray(options.display)) return fallback;
  return options.display.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const rule = entry as Record<string, unknown>;
    return [
      {
        threshold: typeof rule.threshold === "number" ? rule.threshold : 0,
        style: typeof rule.style === "string" ? rule.style : "bold green",
        hidden: typeof rule.hidden === "boolean" ? rule.hidden : false,
      },
    ];
  });
}

function displayFor(
  value: number,
  options: ModuleOptions,
  fallback: DisplayRule[],
): DisplayRule | undefined {
  return readDisplay(options, fallback)
    .filter((rule) => value >= rule.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0];
}

/** Port of Starship's compact integer display used by the Claude modules. */
function humanizeInt(value: number): string {
  const absolute = Math.abs(value);
  const units = [
    { threshold: 1_000_000_000, suffix: "b" },
    { threshold: 1_000_000, suffix: "m" },
    { threshold: 1_000, suffix: "k" },
  ];
  const unit = units.find((candidate) => absolute >= candidate.threshold);
  if (!unit) return String(Math.round(value));
  const compact = (value / unit.threshold).toFixed(1).replace(/\.0$/, "");
  return `${compact}${unit.suffix}`;
}

export const claude_context: ModuleDefinition = {
  name: "claude_context",
  defaults: {
    format: "[$gauge $percentage]($style) ",
    symbol: "",
    gauge_width: 5,
    gauge_full_symbol: "█",
    gauge_partial_symbol: "▒",
    gauge_empty_symbol: "░",
    display: CONTEXT_DISPLAY,
    disabled: false,
  },
  evaluate(options, ctx) {
    const data = ctx.scenario.claude?.contextWindow;
    if (!data) return null;

    const percentageFloat = Math.max(0, Math.min(100, data.usedPercentage));
    const percentage = Math.round(percentageFloat);
    const display = displayFor(percentageFloat, options, CONTEXT_DISPLAY);
    if (!display || display.hidden) return null;

    const width = Math.max(0, Math.trunc(optNumber(options, "gauge_width", 5)));
    const partialSymbol = optString(options, "gauge_partial_symbol");
    const filledFloat = (percentage / 100) * width;
    let filledCount: number;
    let partial = false;
    if (partialSymbol.length === 0) {
      filledCount = Math.round(filledFloat);
    } else {
      filledCount = Math.floor(filledFloat);
      partial = filledFloat - filledCount >= 0.25;
    }
    filledCount = Math.min(filledCount, width);
    const partialCount = partial && filledCount < width ? 1 : 0;
    const emptyCount = Math.max(0, width - filledCount - partialCount);
    const gauge =
      optString(options, "gauge_full_symbol").repeat(filledCount) +
      partialSymbol.repeat(partialCount) +
      optString(options, "gauge_empty_symbol").repeat(emptyCount);

    return {
      variables: {
        symbol: renderMeta(optString(options, "symbol"), ctx),
        gauge,
        percentage: `${percentage}%`,
        input_tokens: humanizeInt(data.totalInputTokens),
        output_tokens: humanizeInt(data.totalOutputTokens),
        curr_input_tokens: humanizeInt(data.currentUsage.inputTokens),
        curr_output_tokens: humanizeInt(data.currentUsage.outputTokens),
        curr_cache_creation_tokens: humanizeInt(
          data.currentUsage.cacheCreationInputTokens,
        ),
        curr_cache_read_tokens: humanizeInt(data.currentUsage.cacheReadInputTokens),
        total_tokens: humanizeInt(data.size),
      },
      styleVariables: { style: display.style },
    };
  },
};

export const claude_cost: ModuleDefinition = {
  name: "claude_cost",
  defaults: {
    format: "[$symbol(\\$$cost)]($style) ",
    symbol: "💰 ",
    display: COST_DISPLAY,
    disabled: false,
  },
  evaluate(options, ctx) {
    const cost = ctx.scenario.claude?.cost;
    if (!cost) return null;
    const display = displayFor(cost.totalCostUsd, options, COST_DISPLAY);
    if (!display || display.hidden) return null;

    return {
      variables: {
        symbol: renderMeta(optString(options, "symbol"), ctx),
        cost: cost.totalCostUsd.toFixed(2),
        duration: renderTime(cost.totalDurationMs, false),
        api_duration: renderTime(cost.totalApiDurationMs, false),
        lines_added: humanizeInt(cost.totalLinesAdded),
        lines_removed: humanizeInt(cost.totalLinesRemoved),
      },
      styleVariables: { style: display.style },
    };
  },
};

export const claude_model: ModuleDefinition = {
  name: "claude_model",
  defaults: {
    format: "[$symbol$model]($style) ",
    symbol: "🤖 ",
    style: "bold blue",
    model_aliases: {},
    disabled: false,
  },
  evaluate(options, ctx) {
    const claude = ctx.scenario.claude;
    if (!claude) return null;
    const aliases =
      typeof options.model_aliases === "object" &&
      options.model_aliases !== null &&
      !Array.isArray(options.model_aliases)
        ? (options.model_aliases as Record<string, unknown>)
        : {};
    const alias = aliases[claude.model.id] ?? aliases[claude.model.displayName];
    const model = typeof alias === "string" ? alias : claude.model.displayName;

    return {
      variables: {
        symbol: renderMeta(optString(options, "symbol"), ctx),
        model,
        model_id: claude.model.id,
        effort: claude.effort,
      },
    };
  },
};

export const CLAUDE_MODULES: ModuleDefinition[] = [
  claude_context,
  claude_cost,
  claude_model,
];
