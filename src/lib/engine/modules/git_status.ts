import type { GitState } from "@/lib/scenarios/types";
import { renderMeta } from "./shared";
import {
  type ModuleContext,
  type ModuleDefinition,
  type ModuleOptions,
  type ModuleVariable,
  optString,
} from "./types";
import type { Segment } from "../types";

/** The order `$all_status` expands to, from starship's `ALL_STATUS_FORMAT`. */
const ALL_STATUS = [
  "conflicted",
  "stashed",
  "deleted",
  "renamed",
  "modified",
  "typechanged",
  "staged",
  "untracked",
] as const;

/**
 * Renders one count option, e.g. `modified = "!"` or `modified = "[$count!](red)"`.
 * A zero count renders nothing at all, as upstream.
 */
function formatCount(
  options: ModuleOptions,
  key: string,
  count: number,
  ctx: ModuleContext,
): { segments: Segment[] } | undefined {
  if (count === 0) return undefined;
  return renderMeta(optString(options, key), ctx, { count: String(count) });
}

/**
 * The counts starship derives from `git status --porcelain=2`, mapped onto the
 * aggregate counts the scenario carries. The scenario does not distinguish
 * worktree from index changes beyond `staged`/`modified`, nor does it model
 * typechanges, so the split variables are derived rather than measured:
 * `worktree_*` follow the worktree counts and `index_modified` follows
 * `staged`.
 */
function counts(git: GitState): Record<string, number> {
  return {
    conflicted: git.conflicted,
    stashed: git.stashed,
    deleted: git.deleted,
    renamed: git.renamed,
    modified: git.modified,
    typechanged: 0,
    staged: git.staged,
    untracked: git.untracked,
    worktree_added: 0,
    worktree_deleted: git.deleted,
    worktree_modified: git.modified,
    worktree_typechanged: 0,
    index_added: 0,
    index_deleted: 0,
    index_modified: git.staged,
    index_typechanged: 0,
  };
}

/** `⇕` / `⇡` / `⇣` / `up_to_date`, per the tracking-branch comparison. */
function aheadBehind(
  options: ModuleOptions,
  git: GitState,
  ctx: ModuleContext,
): { segments: Segment[] } | undefined {
  // Without a tracking branch starship has no ahead/behind counts at all.
  if (!git.hasRemote) return undefined;

  if (git.ahead > 0 && git.behind > 0) {
    return renderMeta(optString(options, "diverged"), ctx, {
      ahead_count: String(git.ahead),
      behind_count: String(git.behind),
    });
  }
  if (git.ahead > 0) return formatCount(options, "ahead", git.ahead, ctx);
  if (git.behind > 0) return formatCount(options, "behind", git.behind, ctx);
  return renderMeta(optString(options, "up_to_date"), ctx);
}

export const git_status: ModuleDefinition = {
  name: "git_status",
  defaults: {
    format: "([\\[$all_status$ahead_behind\\]]($style) )",
    style: "red bold",
    stashed: "\\$",
    ahead: "⇡",
    behind: "⇣",
    up_to_date: "",
    diverged: "⇕",
    conflicted: "=",
    deleted: "✘",
    renamed: "»",
    modified: "!",
    staged: "+",
    untracked: "?",
    typechanged: "",
    worktree_added: "",
    worktree_deleted: "",
    worktree_modified: "",
    worktree_typechanged: "",
    index_added: "",
    index_deleted: "",
    index_modified: "",
    index_typechanged: "",
    ignore_submodules: false,
    disabled: false,
    use_git_executable: false,
    windows_starship: undefined,
  },
  evaluate(options, ctx) {
    const git = ctx.scenario.git;
    if (!git) return null;

    const byName = counts(git);
    const variables: Record<string, ModuleVariable> = {};
    for (const [name, count] of Object.entries(byName)) {
      variables[name] = formatCount(options, name, count, ctx);
    }
    variables.ahead_behind = aheadBehind(options, git, ctx);

    // `$all_status` is a meta variable upstream; here it is the concatenation
    // of the segments its component variables already produced.
    variables.all_status = {
      segments: ALL_STATUS.flatMap((name) => {
        const value = variables[name];
        return typeof value === "object" && value !== undefined ? value.segments : [];
      }),
    };

    return { variables };
  },
};
