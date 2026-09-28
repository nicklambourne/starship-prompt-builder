import { formatMentions, optOptionalString, paletteFor } from "./shared";
import { checkRuleCount, RegexBudgetError, replaceRegex } from "../safeRegex";
import {
  type ModuleContext,
  type ModuleDefinition,
  type ModuleOptions,
  type ModuleVariable,
  optBool,
  optNumber,
  optString,
} from "./types";
import { parseStyleString } from "../styleString";
import { type Segment, textSegment } from "../types";

interface Substitution {
  from: string;
  to: string;
  regex: boolean;
}

/** Replaces `top` with `replacement` when `full` sits under it. */
function contractPath(full: string, top: string, replacement: string): string {
  if (full === top) return replacement;
  if (!full.startsWith(top.endsWith("/") ? top : `${top}/`)) return full;
  const rest = full.slice(top.endsWith("/") ? top.length : top.length + 1);
  return `${replacement}/${rest}`;
}

/** Rewrites `full` to start at the repository directory name, e.g. `repo/src`. */
function contractRepoPath(full: string, root: string): string | undefined {
  const repoName = root.split("/").filter((part) => part !== "").pop() ?? root;
  if (full === root) return repoName;
  if (full.startsWith(`${root}/`)) return `${repoName}/${full.slice(root.length + 1)}`;
  return undefined;
}

/**
 * Keeps only the last `length` path components. Returns undefined when nothing
 * was truncated — the caller uses that to decide whether a prefix is needed.
 */
function truncate(dirString: string, length: number): string | undefined {
  if (length === 0) return undefined;

  const components = dirString.split("/");
  // A leading "/" produces an empty first component that must not be counted.
  if (components[0] === "") components.shift();

  if (components.length <= length) return undefined;
  return components.slice(components.length - length).join("/");
}

/** `~/Projects/work/repo` → `~/P/w/repo`, applied to the truncated-away head. */
function toFishStyle(pwdDirLength: number, dirString: string, truncatedDirString: string): string {
  let head = dirString;
  while (truncatedDirString !== "" && head.endsWith(truncatedDirString)) {
    head = head.slice(0, head.length - truncatedDirString.length);
  }

  return head
    .split("/")
    .map((word) => {
      const chars = Array.from(word);
      if (word === "") return "";
      if (chars.length <= pwdDirLength) return word;
      // Dotfiles keep their dot plus `pwd_dir_length` characters.
      const take = word.startsWith(".") ? pwdDirLength + 1 : pwdDirLength;
      return chars.slice(0, take).join("");
    })
    .join("/");
}

/** The part of `path` preceding the last occurrence of `repo`. */
function beforeRootDir(path: string, repo: string): string {
  const index = path.lastIndexOf(repo);
  return index === -1 ? path : path.slice(0, index);
}

/** `substitutions` is either a list of `{from, to, regex}` or a `from = to` table. */
function readSubstitutions(options: ModuleOptions): Substitution[] {
  const raw = options.substitutions;

  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const { from, to, regex } = entry as Record<string, unknown>;
      if (typeof from !== "string" || typeof to !== "string") return [];
      return [{ from, to, regex: regex === true }];
    });
  }

  if (typeof raw === "object" && raw !== null) {
    return Object.entries(raw as Record<string, unknown>).flatMap(([from, to]) =>
      typeof to === "string" ? [{ from, to, regex: false }] : [],
    );
  }

  return [];
}

function substitutePath(dirString: string, substitutions: Substitution[]): string {
  checkRuleCount(substitutions.length);
  try {
    return substitutions.reduce(
      (acc, { from, to, regex }) =>
        // Rust's `Regex::replace` rewrites the first match only; `str::replace`
        // rewrites every occurrence.
        regex ? replaceRegex(from, acc, to) ?? acc : acc.replaceAll(from, to),
      dirString,
    );
  } catch (error) {
    if (error instanceof RegexBudgetError) throw error;
    // An invalid regex leaves the path untouched, as upstream.
    return dirString;
  }
}

/**
 * Folds the repo-root split into `$path` as pre-styled segments.
 *
 * Starship swaps `format` for `repo_root_format` when `repo_root_style` is set.
 * `ModuleResult` cannot override the format, so when the active format does not
 * name `$repo_root`/`$before_root_path` itself, the three parts are rendered
 * here with their own styles and spliced into `$path` — which reproduces
 * `repo_root_format`'s output through the default format.
 */
function foldedPath(
  before: string,
  root: string,
  rest: string,
  options: ModuleOptions,
  ctx: ModuleContext,
): { segments: Segment[] } {
  const palette = paletteFor(ctx);
  const style = optString(options, "style");
  const rootStyle = optOptionalString(options, "repo_root_style") ?? style;
  const beforeStyle = optOptionalString(options, "before_repo_root_style") ?? style;

  const segments: Segment[] = [];
  if (before !== "") segments.push(textSegment(before, parseStyleString(beforeStyle, palette)));
  if (root !== "") segments.push(textSegment(root, parseStyleString(rootStyle, palette)));
  // The trailing part carries no style so it inherits `$style` from the format.
  if (rest !== "") segments.push(textSegment(rest));
  return { segments };
}

export const directory: ModuleDefinition = {
  name: "directory",
  defaults: {
    truncation_length: 3,
    truncate_to_repo: true,
    fish_style_pwd_dir_length: 0,
    use_logical_path: true,
    substitutions: [],
    format: "[$path]($style)[$read_only]($read_only_style) ",
    repo_root_format:
      "[$before_root_path]($before_repo_root_style)[$repo_root]($repo_root_style)[$path]($style)[$read_only]($read_only_style) ",
    style: "cyan bold",
    repo_root_style: undefined,
    before_repo_root_style: undefined,
    disabled: false,
    read_only: "🔒",
    read_only_style: "red",
    truncation_symbol: "",
    home_symbol: "~",
    // Kept for config fidelity: the preview is always POSIX, so there is no
    // separator to convert.
    use_os_path_sep: true,
  },
  evaluate(options, ctx) {
    const { scenario } = ctx;
    const { home, path: displayDir } = scenario;

    const homeSymbol = optString(options, "home_symbol");
    const truncateToRepo = optBool(options, "truncate_to_repo", true);
    const truncationLength = optNumber(options, "truncation_length", 3);
    const repoRootStyle = optOptionalString(options, "repo_root_style");
    const style = optString(options, "style");

    // The repository is only consulted for the two options that need it.
    const repoRoot =
      truncateToRepo || repoRootStyle !== undefined ? scenario.git?.root : undefined;

    const contractedToRepo =
      truncateToRepo && repoRoot !== undefined && repoRoot !== home
        ? contractRepoPath(displayDir, repoRoot)
        : undefined;

    let isTruncated = contractedToRepo !== undefined;
    let dirString = contractedToRepo ?? contractPath(displayDir, home, homeSymbol);

    const substitutions = readSubstitutions(options);
    dirString = substitutePath(dirString, substitutions);

    const truncated = truncate(dirString, truncationLength);
    if (truncated !== undefined) {
      isTruncated = true;
      dirString = truncated;
    }

    const fishLength = optNumber(options, "fish_style_pwd_dir_length");
    const prefix = !isTruncated
      ? ""
      : // Substitutions can rewrite the head of the path, so starship refuses to
        // combine them with fish-style contraction.
        fishLength > 0 && substitutions.length === 0
        ? toFishStyle(fishLength, contractPath(displayDir, home, homeSymbol), dirString)
        : optString(options, "truncation_symbol");

    let beforeRootPath = "";
    let repoRootName = "";
    let path = prefix + dirString;

    if (repoRoot !== undefined && repoRootStyle !== undefined) {
      const contracted = contractRepoPath(displayDir, repoRoot);
      if (contracted === undefined) return null;

      const name = contracted.split("/")[0];
      const afterRepoRoot = contracted.replace(name, "");
      const segmentsAfterRoot = afterRepoRoot.split("/").length;

      if (truncationLength === 0 || segmentsAfterRoot - 1 < truncationLength) {
        beforeRootPath = prefix + beforeRootDir(dirString, contracted);
        repoRootName = name;
        path = afterRepoRoot;
      }
    }

    const splitAtRoot = beforeRootPath !== "" || repoRootName !== "";
    const format = optString(options, "format");
    const formatUsesRoot =
      formatMentions(format, "repo_root") || formatMentions(format, "before_root_path");

    const variables: Record<string, ModuleVariable> = {
      path:
        splitAtRoot && !formatUsesRoot
          ? foldedPath(beforeRootPath, repoRootName, path, options, ctx)
          : path,
      before_root_path: formatUsesRoot ? beforeRootPath : undefined,
      repo_root: formatUsesRoot ? repoRootName : undefined,
      read_only: scenario.readOnly ? optString(options, "read_only") : undefined,
    };

    return {
      variables,
      styleVariables: {
        style,
        read_only_style: optString(options, "read_only_style"),
        repo_root_style: repoRootStyle ?? style,
        before_repo_root_style: optOptionalString(options, "before_repo_root_style") ?? style,
      },
    };
  },
};
