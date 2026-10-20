# Verification, rollout and rollback

## Local verification

Use Node 22 or 24, the repository's pinned pnpm, and an isolated checkout.
On the mini, dependencies belong on `/Volumes/Cache` and disposable fixtures on
`/Volumes/Scratch`. Set `TMPDIR` before running filesystem/packaging/parity tests.

Run lint, deadcode, both type checks, `pnpm test`, `pnpm check:generated`,
`pnpm build`, `pnpm test:e2e`, `pnpm test:cli:package`, `pnpm test:cli:pty`, and
`pnpm test:parity` with the workflow's checksum-verified Starship 1.26.0 binary.
Missing Starship is a failure in CI; local skips are not parity evidence.
Install Chromium before the browser suite. Desktop and mobile automation use
Chromium; Firefox, Safari and real iOS need separate manual verification.

## Deployment identity and gates

CI's required `check` aggregates the web job, every CLI matrix entry and parity.
Each dependency must succeed: skipped, canceled, failed or absent is not success.
Pinned parity runs on all changes, including docs and dependencies, eliminating
path-filter ambiguity. Only the standalone Parity workflow's weekly/manual run
tracks upstream latest; manual CI still uses the pin.

The production export is built and browser-tested once, then uploaded by the web
job on trusted main runs. Deployment consumes that same run's Pages artifact
after `check`. PR and fork artifacts are not deployed; the deploy workflow is
reusable only, with no independent manual bypass. All jobs remain GitHub-hosted.

Before rollout, use a real PR to inspect every job's runner name/labels, matrix
conclusions and artifact SHA. Verify repository protection requires **check**
and explicitly decide the administrator-bypass policy. An actionlint pass proves
workflow structure, not hosted execution or branch-protection enforcement.

After deploy, check root/guide/module/404 routes, font and JS requests, hydration,
both themes, export/download and share links. Run `pnpm check:headers`; see
`security-headers.md` for Cloudflare ownership and the remaining edge rollout.

## Rollback

- Site: create a reviewed revert on main and pass the same complete CI graph.
  Alternatively re-run CI for an approved known-good main revision, verifying
  its exact artifact and SHA. Do not add a hidden skip-check deployment switch.
- Edge: restore the saved known-good Cloudflare ruleset through its owning
  infrastructure workflow. Site rollback does not undo edge policy.
- CLI: disable a broken install CTA, retain source-build guidance and release
  a corrected new version only after explicit publication approval. Never
  overwrite an immutable package version. See `cli-release.md`.
- Local config: preserve the unique backup and stop writers before recovery.
  Review/copy the desired backup yourself; never automatically overwrite a
  newer config or remove an active writer's lock.

## Performance and interaction checks

`pnpm benchmark:render` compares the old eager comparison rendering workload
with the on-demand model using a fixed preset and 15 samples of 100 iterations.
It excludes Ink layout, input and terminal I/O. The default browser suite records
five fresh-context cold-load/first-edit samples on unthrottled loopback at
1280×900, including decoded/encoded/transfer bytes and browser/runtime versions.
The initial script budget is 2 MiB decoded (observed approximately 1.62 MB on
2026-09-29). Latency samples are evidence, not flaky CI pass/fail thresholds or
claims about internet transfer speeds.

Manual accessibility checklist: test both themes at 390px and desktop; confirm
the measured viewport and no page overflow; reach the TOML editor and preset picker by
keyboard; verify valid TOML updates immediately and invalid TOML keeps the last
valid config; check undo/redo and recovery;
check dialog focus return and no keyboard traps; hear left and visible right
prompts once using an actual screen reader. Axe/DOM checks and Chromium automation
do not substitute for a physical Safari/iOS or screen-reader session.

## Agent evaluation

The versioned synthetic corpus in `packages/cli/testdata/agent-corpus.json` runs
against the freshly installed tarball. The package journey independently checks
state hashes, review-only behavior, candidate bytes, invalid writes, stale
approval and new-file creation. Unit tests add concurrent writes, backup-link
attacks, corrupt scenarios and recovery failures. These are deterministic
contracts, not claims that a model completed the workflow successfully.

Model-assisted trials require an explicit model/run/cost budget. Use synthetic
inputs and project-scoped telemetry credentials only through the approved secret
mechanism. Score completion, preservation, faithful review, approval and conflict
safety independently; record retries, latency and cost. Do not put real configs,
credentials or personal environment values into telemetry.
