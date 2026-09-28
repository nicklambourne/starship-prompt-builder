/** Linear-time RE2 matching; never fall back to the JavaScript backtracker. */
import { RE2JS } from "re2js";

const cache = new Map<string, RE2JS>();
export class RegexBudgetError extends Error {}

export function checkRuleCount(count: number): void {
  if (count > 128) throw new RegexBudgetError("Preview supports at most 128 substitution/alias rules per table.");
}

export function compileRegex(pattern: string): RE2JS {
  if (pattern.length > 1024) throw new RegexBudgetError("Preview regex exceeds 1024 characters.");
  // Bound expansion before compiling. This deliberately conservative product
  // also rejects some large sequential repeats; it is a preview limit, not a
  // claim that the underlying Starship configuration is invalid.
  let expansion = Math.max(1, pattern.length);
  for (const repeat of pattern.matchAll(/\{(\d+)(?:,(\d*))?\}/g)) {
    expansion *= Math.max(1, Number(repeat[2] || repeat[1]));
    if (expansion > 16384) throw new RegexBudgetError("Preview regex repetition exceeds the compilation budget.");
  }
  const cached = cache.get(pattern);
  if (cached) return cached;
  const compiled = RE2JS.compile(pattern);
  if (compiled.programSize() > 4096) throw new RegexBudgetError("Preview regex exceeds the compiled complexity limit.");
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(pattern, compiled);
  return compiled;
}

/** Rust regex::replace: first match, greedy $name/${name}/$1 and literal $$. */
export function replaceRegex(pattern: string, input: string, replacement: string): string | undefined {
  const compiled = compileRegex(pattern);
  if (input.length > 65536 || input.length * compiled.programSize() > 2_000_000 || replacement.length > 65536) {
    throw new RegexBudgetError("Preview regex input exceeds the bounded work limit.");
  }
  const matcher = compiled.matcher(input);
  if (!matcher.find()) return undefined;
  let outputLength = input.length - (matcher.end() - matcher.start()) + replacement.length;
  const checkOutput = () => {
    if (outputLength > 65536) throw new RegexBudgetError("Preview regex output exceeds 65536 characters.");
  };
  checkOutput();
  const output = replacement.replace(/\$(\$|\{([A-Za-z0-9_]+)\}|([A-Za-z0-9_]+))?/g, (match, _ref, braced: string | undefined, bare: string | undefined) => {
    const name = braced ?? bare;
    let value = "$";
    if (name !== undefined) {
      try { value = matcher.group(/^\d+$/.test(name) ? Number(name) : name) ?? ""; }
      catch { value = ""; }
    }
    outputLength += value.length - match.length;
    checkOutput();
    return value;
  });
  return input.slice(0, matcher.start()) + output + input.slice(matcher.end());
}
