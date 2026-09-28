# Starship Prompt Builder CLI

An interactive editor for `starship.toml`, powered by the same pure renderer as
[Starship Prompt Builder](https://starship.ndl.au). No shell commands from a
configuration are run by the preview; custom-module output is simulated.

The package is **not yet published to npm**. Build it from the repository with
Node.js 22 or 24, corepack, and `pnpm install --frozen-lockfile`, then run
`pnpm build:cli` and `node packages/cli/dist/index.js --help` from the root.
The terminal must support UTF-8 and be at least 60 columns wide. The `spb`
binary is an alias once the package is installed.

```sh
starship-builder edit ~/.config/starship.toml
starship-builder --preset plain-text-symbols
starship-builder preview ~/.config/starship.toml --scenario cloud --width 100 --no-color
starship-builder validate ~/.config/starship.toml --json
starship-builder state ~/.config/starship.toml --json --scenario simple --width 80
cat ~/.config/starship.toml | starship-builder validate - --strict
starship-builder apply ~/.config/starship.toml --from candidate.toml --json
starship-builder apply ~/.config/starship.toml --from candidate.toml --yes --expect-hash SHA256_FROM_STATE
starship-builder export ~/.config/starship.toml --full
starship-builder share ~/.config/starship.toml
starship-builder presets
starship-builder completions bash  # also zsh and fish
```

An absent default config starts interactive mode from a preset. Explicit file
inputs for `preview`, `validate`, `state`, `export`, and `share` must exist; they do not
silently become presets. A validation failure exits 2; file, parse, and usage
errors exit 1. `--strict` makes unknown/future-option warnings fail validation.
`--json` writes structured output to stdout for `validate` and `apply`;
`state` always emits JSON. Errors go to stderr. `--from-share`
imports a browser share link as the starting config for read-only commands or the TUI, not `apply`.

For an agent, `state --json` is a single read-only snapshot of the config on disk:
schema version, source path and SHA-256 hash, parsed config, validation diagnostics,
and a plain-text preview for the selected simulated scenario and width. It does
not include unsaved edits in a running TUI. `preview.text` preserves source text;
human `preview --no-color` replaces unsafe terminal controls with visible question
marks. Invalid options produce JSON with
`validation.valid: false`, a null preview, and exit 2.

`apply` takes an explicit target path and candidate TOML from `--from <file>`
or stdin (`--from -`). By default it **only reviews** the candidate: complete
old/new file bodies, changed config paths, diagnostics, hashes, and a simulated
prompt preview. Choose its context with `--scenario` and `--width`. Add `--json`
for a machine-readable review, then `--yes` to write. To prevent an agent from
overwriting a file changed since its `state` snapshot, pass that snapshot's
`source.hash` as `--expect-hash`; use `none` if the target did not exist.
Validation errors (or warnings with `--strict`) block writes with exit 2.
Applied bytes are the candidate's exact bytes, without TUI regeneration;
the previous file is copied to a unique `<target>.<random-id>.bak` (0600 on POSIX).
Cooperating writers use an exclusive per-target `.lock`; new files are published
without clobbering a competing creation. Existing files use a final identity/hash
check and atomic rename, **not universal filesystem compare-and-swap**: an external
editor can still write between that check and rename. Parent directories must be
trusted. Lock contention fails immediately; inspect the lock and ensure no writer
is active before manually removing a stale lock. The result includes cleanup
`warnings`; a cleanup warning does not mean the save failed. Both
`state` and `apply --json` may expose values from your configuration, so review
their output before sharing it outside your machine.

Inside the TUI, use arrows or `j`/`k` to navigate, Enter to edit, Space to
toggle, `a` to add, `m` to move, and `Tab` to switch left/right formats. Press
`2` for simulated inputs and scenario selection, `3` for TOML, `P` for
palettes, `?` for help, or `:` for searchable actions and module settings.
The action search offers alternatives for shortcuts a terminal intercepts.
`Ctrl+Z`/`Ctrl+Y` undo/redo and `Ctrl+S` opens save review.

Save review shows the full current and proposed file, semantic changes,
diagnostics, destination, and backup plan. **An edited save regenerates TOML**:
comments, whitespace, and source formatting may change. An unchanged loaded
file is kept byte-for-byte. Detected disk changes block replacement; reload or
Save As instead. The same lock/backup limitations described above apply. Unsaved edits create a private recovery draft keyed by
the destination, separate from the real config. Recovery never overwrites a
newer disk file without an explicit new decision.

Preview widths are integers from 20 to 500 cells. Ambiguous Unicode widths still
depend on the physical terminal and font; the shared layout is a simulation.
Config-controlled regex uses linear-time RE2 matching, not JavaScript backtracking.
Patterns are limited to 1,024 characters, conservative repetition expansion and
4,096 compiled instructions; inputs, replacements and outputs to 65,536 characters;
and matching to two million input-character/instruction units. Each alias table
is limited to 128 rules. Unsupported syntax (including lookaround/backreferences)
or budgets produce preview warnings; no unsafe fallback is used. These are preview
limits, not claims that a configuration is invalid in Starship.

JSON and generated TOML exports preserve values and can contain control characters.
Treat them as data: redirect them to files or parse them, rather than writing raw
decoded strings to an interactive terminal.

The Environment pane edits only simulated data. Press `p` to choose a built-in
scenario, `o`/`s` to load/save a versioned scenario JSON file, `c` to compare
built-in scenarios, and `x` to clear an optional context such as Git or AWS.
The TOML pane offers `r` reload, `o` open another config, `p` a preset,
`w`/`i` workspace export/import, and `l`/`u` config-only share-link
generation/import. A workspace includes the simulated scenario and width;
ordinary TOML and share links never include that environment data.

Shell completions can be saved to the location your shell reads, for example:

```sh
starship-builder completions bash > ~/.local/share/bash-completion/completions/starship-builder
starship-builder completions zsh > ~/.zsh/completions/_starship-builder
starship-builder completions fish > ~/.config/fish/completions/starship-builder.fish
```

If the preview differs from your shell, check the scenario, terminal width,
and font. Nerd Font icons require a compatible terminal font; plain Unicode
symbols work more broadly. `--no-color` removes ANSI styling from headless
previews and the interactive terminal output.
