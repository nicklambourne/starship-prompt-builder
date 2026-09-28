/**
 * `kubernetes` — current kubectl context, namespace, user and cluster.
 *
 * Port of `src/modules/kubernetes.rs`.
 *
 * Two aliasing mechanisms coexist upstream and both are reproduced here: the
 * modern `contexts` array (which can also override `symbol` and `style`) and
 * the deprecated `context_aliases` / `user_aliases` tables applied on top.
 * Both accept either a literal name or a regular expression that is anchored
 * with `^…$`, with `$1`-style capture references usable in the replacement.
 * Starship uses Rust's `regex` crate; this preview uses bounded, linear-time
 * RE2 matching. Unsupported dialect features never use a backtracking fallback.
 */

import { detectEnvVars, optAliasTable } from "./cloudUtils";
import { checkRuleCount, RegexBudgetError, replaceRegex } from "../safeRegex";
import {
  type ModuleDefinition,
  type ModuleOptions,
  detects,
  optString,
  optStringArray,
} from "./types";

interface ContextRule {
  contextPattern: string;
  userPattern?: string;
  symbol?: string;
  style?: string;
  contextAlias?: string;
  userAlias?: string;
}

function optContextRules(options: ModuleOptions): ContextRule[] {
  const value = options.contexts;
  if (!Array.isArray(value)) return [];
  checkRuleCount(value.length);

  const rules: ContextRule[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const rule = entry as Record<string, unknown>;
    if (typeof rule.context_pattern !== "string") continue;
    rules.push({
      contextPattern: rule.context_pattern,
      userPattern: typeof rule.user_pattern === "string" ? rule.user_pattern : undefined,
      symbol: typeof rule.symbol === "string" ? rule.symbol : undefined,
      style: typeof rule.style === "string" ? rule.style : undefined,
      contextAlias: typeof rule.context_alias === "string" ? rule.context_alias : undefined,
      userAlias: typeof rule.user_alias === "string" ? rule.user_alias : undefined,
    });
  }
  return rules;
}

function regexAlias(pattern: string, value: string, replacement: string): string | undefined {
  try { return replaceRegex(`^${pattern}$`, value, replacement); }
  catch (error) {
    if (error instanceof RegexBudgetError) throw error;
    return undefined;
  }
}

/**
 * Port of `get_aliased_name`. A missing pattern matches anything; a pattern that
 * does not match yields `undefined` so the caller can try the next rule.
 */
function aliasedName(
  pattern: string | undefined,
  currentValue: string | undefined,
  alias: string | undefined,
): string | undefined {
  const replacement = alias ?? currentValue;
  if (replacement === undefined) return undefined;
  if (pattern === undefined) return replacement;
  if (currentValue === undefined) return undefined;
  if (currentValue === pattern) return replacement;

  return regexAlias(pattern, currentValue, replacement);
}

/** Port of the deprecated `*_aliases` lookup: literal key first, then regex. */
function deprecatedAlias(value: string, aliases: Record<string, string>): string {
  checkRuleCount(Object.keys(aliases).length);
  const literal = aliases[value];
  if (literal !== undefined) return literal;

  for (const [pattern, replacement] of Object.entries(aliases)) {
    const result = regexAlias(pattern, value, replacement);
    if (result !== undefined) return result;
  }
  return value;
}

export const kubernetes: ModuleDefinition = {
  name: "kubernetes",
  defaults: {
    symbol: "☸ ",
    format: "[$symbol$context( \\($namespace\\))]($style) in ",
    style: "cyan bold",
    disabled: true,
    context_aliases: {},
    user_aliases: {},
    detect_extensions: [],
    detect_files: [],
    detect_folders: [],
    detect_env_vars: [],
    contexts: [],
  },

  evaluate(options, { scenario }) {
    const envVarNames = optStringArray(options, "detect_env_vars");
    const haveScanConfig =
      optStringArray(options, "detect_files").length > 0 ||
      optStringArray(options, "detect_folders").length > 0 ||
      optStringArray(options, "detect_extensions").length > 0;

    // A directory scan, when configured, wins outright; env vars are only
    // consulted when no scan is configured; with neither, the module shows.
    const scanned = haveScanConfig ? detects(options, scenario) : undefined;
    const fromEnv =
      envVarNames.length > 0 ? detectEnvVars(scenario, envVarNames) : undefined;
    if (!(scanned ?? fromEnv ?? true)) return null;

    const kube = scenario.kubernetes;
    if (!kube?.context) return null;

    let matched: ContextRule | undefined;
    let context = kube.context;
    let user = kube.user;

    for (const rule of optContextRules(options)) {
      const contextAlias = aliasedName(rule.contextPattern, kube.context, rule.contextAlias);
      if (contextAlias === undefined) continue;

      const userAlias = aliasedName(rule.userPattern, kube.user, rule.userAlias);
      if (rule.userPattern !== undefined && userAlias === undefined) continue;

      matched = rule;
      context = contextAlias;
      user = userAlias;
      break;
    }

    context = deprecatedAlias(context, optAliasTable(options, "context_aliases"));
    if (user !== undefined) {
      user = deprecatedAlias(user, optAliasTable(options, "user_aliases"));
    }

    return {
      variables: {
        symbol: matched?.symbol ?? optString(options, "symbol"),
        context,
        namespace: kube.namespace,
        cluster: kube.cluster,
        user,
      },
      styleVariables: { style: matched?.style ?? optString(options, "style") },
    };
  },
};
