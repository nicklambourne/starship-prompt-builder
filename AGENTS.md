# Agent guide — Starship Prompt Builder

Conventions for agents (and humans) working in this repository. Read
[PLAN.md](PLAN.md) for what the project is and where it is going.

## Repository shape

Fully static Next.js app, exported to GitHub Pages under the `/starship-prompt-builder`
base path. Everything runs client-side; there is no backend.

- `src/lib/engine/` — the rendering engine. **Pure TypeScript, no React
  imports.** This is the part that must stay faithful to real starship.
- `src/lib/engine/modules/` — one file per starship module.
- `src/lib/scenarios/` — mocked shell contexts used by the preview and reused
  as parity fixtures.
- `src/lib/config/` — TOML import/export, defaults, presets, share links.
- `src/components/` — UI. Never put rendering logic here.
- `data/` — vendored starship artefacts (config schema, presets). Synced from
  upstream, never hand-edited.

## Build and test

```sh
pnpm install
pnpm dev          # local dev server
pnpm dev:stack    # fixed loopback dev stack for persistent handoff
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest unit tests
pnpm build        # static export to out/
```

Use the narrowest relevant check while iterating, then run every applicable
check before handing work back. `pnpm build` runs the TypeScript check too, so
a green `pnpm build` is the minimum bar before opening a PR.

### Accessibility

`tests/e2e/accessibility.spec.ts` runs axe over the whole interface — every
disclosure forced open — in both themes, and fails on any WCAG 2.1 AA
violation. Two rules it has already caught, worth knowing before adding UI:

- **Contrast is measured against the real surface.** The light theme reverses
  the neutral ramp, so a shade chosen for a dark card can land at 2:1 on a
  light one, and 3:1 (the bar for borders) is not enough for text.
- **`text-white` is not white in the light theme** — `--color-white` is
  reversed with the ramp. Filled buttons use `.text-on-solid`.

### Verification standards

- Check **real exit codes**. `cmd | tail` reports the exit status of `tail`, not
  of `cmd`. Capture `$?` directly, or redirect to a file and inspect.
- A green unit suite is not proof the UI works. Anything user-visible must be
  looked at in a browser at both ~390 px and desktop widths before it is called
  done. Assert `window.innerWidth` — the preview pane can wedge to 0×0 and fake
  a mobile render.
- A test that passes without the fix applied is not a test. Confirm new tests
  fail against the unfixed code.

### Engine fidelity

The engine is a re-implementation of starship's Rust formatter, so it drifts
silently unless pinned. When changing anything under `src/lib/engine/`:

- Read the corresponding Rust source rather than inferring behaviour. Module
  defaults live in starship's `src/configs/<module>.rs`; the formatter lives in
  `src/formatter/`.
- Module defaults must match starship **byte for byte**, including Nerd Font
  glyphs and trailing spaces in format strings.
- Add a parity case (`tests/parity/`) for anything the harness does not already
  cover. The sweep in `tests/parity/sweep.ts` gives most modules one already;
  a module that cannot have a deterministic fixture belongs in `UNSWEEPABLE`
  with the reason, not left out.
- Parity runs against a **pinned** starship on pull requests and the **latest**
  release on its weekly schedule. When the weekly run fails, the engine is
  behind upstream: fix it and move the pin in `.github/workflows/parity.yml`.

## Worktree isolation

The primary checkout is a **read-only coordination checkout**. Do not edit
files, build, test, commit, push, or run PR commands there. Use it only to
inspect repository and worktree state, fetch refs, and create or remove this
agent's own worktrees.

A **new task** is an independent change intended for its own PR. It is not each
step, subtask, or phase within one implementation plan. Every new task gets
exactly one dedicated branch and worktree; all steps for that task stay in that
pair.

Use this convention:

- Worktree root: `/Volumes/Repos/starship-prompt-builder-worktrees/`
- Worktree path: `/Volumes/Repos/starship-prompt-builder-worktrees/<task-slug>`
- Branch: `agent/<task-slug>`
- `<task-slug>`: short, lowercase, kebab-case, descriptive of the PR

Before making changes:

1. From the primary coordination checkout, inspect `git status` and
   `git worktree list`. Preserve every existing worktree and branch.
2. Fetch the current base: `git fetch --prune origin main`.
3. Create the task from the fetched base — always from `origin/main`, never
   from a possibly-stale local `main`:

   ```sh
   git worktree add -b agent/<task-slug> \
     /Volumes/Repos/starship-prompt-builder-worktrees/<task-slug> origin/main
   ```

4. Report the worktree's absolute path and branch name before editing, and
   again in the final handoff.

All edits, builds, tests, commits, pushes, and `gh` PR commands run from the
task worktree. Do not base a new task on an unmerged branch unless a stacked
change was explicitly requested.

Treat every pre-existing worktree as owned by another session. Never reuse,
reset, clean, stash, delete, or prune it. Continue in an existing worktree only
when explicitly asked to continue that same PR, and first verify its branch is
still that PR's head. If a slug or branch name is already taken, pick a new one.

`node_modules` is not shared between worktrees — run `pnpm install` inside each
new worktree before building.

After GitHub confirms the PR is **merged**, remove only this agent's own
worktree, and only when `git status --short` in it is empty:

```sh
git worktree remove /Volumes/Repos/starship-prompt-builder-worktrees/<task-slug>
git branch -D agent/<task-slug>
```

Squash-merged branches are not ancestors of `main`, so confirm the PR's `MERGED`
state via `gh pr view` rather than relying on `git branch --merged`. Deleting a
branch that an open PR points at (head **or** base) closes that PR — only delete
after the merge is confirmed. If a worktree is dirty, its ownership is
uncertain, or removal fails, preserve it and report its path and condition
instead of forcing cleanup. Never run broad automatic worktree or branch
cleanup.

## Persistent local development handoff

When the user asks for a running local demo, leave one canonical watch-mode
server running rather than starting a new port and worktree for every task.

1. Use `/Volumes/Repos/starship-prompt-builder-worktrees/local-dev` and local
   branch `codex/local-dev` for the user-facing stack. Do not create parallel
   persistent worktrees. If that worktree or its process is dirty, unknown, or
   owned by another active session, preserve it and report the blocked handoff.
2. Preserve an existing user-facing URL and port. Otherwise use
   `pnpm dev:stack`, whose default is `http://127.0.0.1:3000`. Temporary
   verification servers must set a different `STARSHIP_DEV_PORT`.
3. Before interrupting a running stack, install and start the requested
   revision on a temporary port. Confirm its root returns HTTP 200 and its
   worktree `HEAD` is the intended revision.
4. Only after that check passes, stop the previous verified Starship process,
   update the canonical worktree, and start `pnpm dev:stack` on the preserved
   user-facing port. Confirm HTTP 200 again and keep the final process running
   after the agent turn ends.
5. Report the live URL, canonical worktree, branch, exact commit, watch-mode
   status, and final health result. Never claim the handoff succeeded unless
   the final process is healthy.

## Pull requests

One PR per change, branched from fresh `origin/main`. Verify
`git log origin/main..HEAD` before pushing. Default to:

```bash
gh pr merge --auto --squash --delete-branch
```

Check the PR is still `OPEN` before pushing follow-up commits — pushing after
auto-merge has fired strands commits on a deleted branch.

Commits are authored as `Nicholas Lambourne <dev@ndl.au>`; agents are never
listed as author, committer, or co-author.

## CI

See [.github/workflows/](.github/workflows/). **Every job runs on
GitHub-hosted runners, and must keep doing so while this repository is
public.** A fork's pull request is attacker-authored code; the `ubox`
self-hosted cluster sits on a home LAN. Do not add `runs-on` expressions that
select a self-hosted runner, even guarded ones — the reasoning, including why
the fork-PR guard was rejected rather than kept, is in
[docs/ci-runners.md](docs/ci-runners.md).

Toolchains come from `actions/setup-node`; pnpm is resolved through corepack
from the `packageManager` field.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
