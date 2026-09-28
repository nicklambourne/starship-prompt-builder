# Starship Prompt Builder CLI

An interactive editor for `starship.toml`, powered by the same pure renderer as
[Starship Prompt Builder](https://starship.ndl.au). No shell commands from a
configuration are run by the preview; custom-module output is simulated.

Install the packaged v0.2.0 release with Node.js 22 or newer:

```sh
npm install -g https://github.com/nicklambourne/starship-prompt-builder/releases/download/cli-v0.2.0/starship-prompt-builder-cli-0.2.0.tgz
starship-builder --version
```

The package is **not yet published to npm**. To build from the repository instead,
use Node.js 22 or 24, corepack, and `pnpm install --frozen-lockfile`, then run
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
starship-builder compare ~/.config/starship.toml --from candidate.toml --json --html review.html
starship-builder apply ~/.config/starship.toml --from candidate.toml --yes --review-hash REVIEW_HASH --expect-hash SHA256_FROM_STATE
starship-builder capabilities
starship-builder agent-guide
starship-builder export ~/.config/starship.toml --full
starship-builder share ~/.config/starship.toml
starship-builder presets
starship-builder completions bash  # also zsh and fish
```

An absent default config starts interactive mode from a preset. Explicit file
inputs for `preview`, `validate`, `export`, and `share` must exist; they do not
silently become presets. A validation failure exits 2; file, parse, and usage
errors exit 1. `--strict` makes unknown/future-option warnings fail validation.
`--json` writes structured output to stdout for `validate`, `apply`, and `compare`;
`state` always emits JSON. JSON mode also reports parse, file, conflict, and usage
errors as `{ "schemaVersion": 1, "ok": false, "error": { "code", "message" } }` on stdout.
Without JSON mode, errors go to stderr. `--from-share`
imports a browser share link as the starting config for read-only commands or the TUI, not `apply`.

For an agent, `state --json` is a single read-only snapshot of the config on disk:
schema version, source path and SHA-256 hash, parsed config, validation diagnostics,
plain text and styled runs for the selected simulated scenario and width. It does
not include unsaved edits in a running TUI. `preview.text` matches `preview
--no-color` for the same inputs. Invalid options or malformed current TOML
produce JSON with `validation.valid: false`, a null preview, and exit 2. A
malformed file also has `raw` and a `toml-parse` diagnostic so an agent can
repair it. A missing target has `source.kind: "missing"`, null hash, and a
bundled-preset starting config.

`capabilities` emits JSON with commands, scenarios, themes, presets, and the
current config schema. `agent-guide` prints a versioned workflow for agents.
Use these commands for discovery rather than assuming an option or module.

`compare` reads an explicit target and candidate without changing either one.
It previews both across four common situations and 40/80-column terminals by
default; use `--scenarios` and `--widths` for a smaller set. `--html review.html`
writes a new, self-contained, colour-aware browser report and refuses to
overwrite an existing report. JSON output includes the comparison matrix,
changed values, and config-only browser links for the before and after states.
`--theme <id>` selects the HTML terminal palette. A versioned scenario file
exported from the TUI or copied from the browser handoff works with
`--scenario-file <path>` on `preview`, `state`, `apply`, and `compare`; compare
adds it to the selected built-in situations.

`apply` takes an explicit target path and candidate TOML from `--from <file>`
or stdin (`--from -`). By default it **only reviews** the candidate: complete
old/new file bodies, changed config paths and values, diagnostics, hashes, and a simulated
prompt preview. Choose its context with `--scenario` and `--width`. Add `--json`
for a machine-readable review or `--compact` to omit full file bodies. A review
returns `reviewHash`, binding the target path, its current hash, and the exact
candidate bytes. After showing the review to a person, use `--yes --review-hash`
to write only that candidate against the reviewed target. To prevent an agent from
overwriting a file changed since its `state` snapshot, pass that snapshot's
`source.hash` as `--expect-hash`; use `none` if the target did not exist.
Validation errors (or warnings with `--strict`) block writes with exit 2.
Applied bytes are the candidate's exact bytes, without TUI regeneration;
the previous file is copied to `.bak` and the target is replaced atomically.
An on-disk change during apply is also detected before replacement. Both
`state` and `apply --json` may expose values from your configuration, so review
their output before sharing it outside your machine.
To restore the last backup, review `<path>.bak` as a candidate with `apply`
before writing it. The backup is replaced by the next successful save, so keep
a separate copy if you need longer history.

Inside the TUI, use arrows or `j`/`k` to navigate, Enter to edit, Space to
toggle, `a` to add, `m` to move, and `Tab` to switch left/right formats. Press
`2` for simulated inputs and scenario selection, `3` for TOML, `P` for
palettes, `?` for help, or `:` for searchable actions and module settings.
The action search offers alternatives for shortcuts a terminal intercepts.
`Ctrl+Z`/`Ctrl+Y` undo/redo and `Ctrl+S` opens save review.

Save review shows the full current and proposed file, semantic changes,
diagnostics, destination, and backup plan. **An edited save regenerates TOML**:
comments, whitespace, and source formatting may change. An unchanged loaded
file is kept byte-for-byte. A file changed on disk cannot be silently
overwritten; reload or Save As instead. The prior file is copied to `.bak`
before replacement. Unsaved edits create a private recovery draft keyed by
the destination, separate from the real config. Recovery never overwrites a
newer disk file without an explicit new decision.

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
