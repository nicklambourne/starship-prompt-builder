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
cat ~/.config/starship.toml | starship-builder validate - --strict
starship-builder export ~/.config/starship.toml --full
starship-builder share ~/.config/starship.toml
starship-builder presets
starship-builder agent-guide
starship-builder completions bash  # also zsh and fish
```

An absent default config starts interactive mode from a preset. Explicit file
inputs for `preview`, `validate`, `export`, and `share` must exist; they do not
silently become presets. A validation failure exits 2; file, parse, and usage
errors exit 1. `--strict` makes unknown/future-option warnings fail validation.
`--json` writes diagnostics only to stdout; errors go to stderr. `--from-share`
imports a browser share link as the starting config for any command.

## Working with an agent

Run `starship-builder agent-guide` for the versioned, non-interactive workflow.
It works without a config file or TTY. The [terminal guide](https://starship.ndl.au/terminal/)
has a starter prompt you can copy into an agent chat or append to your existing
`AGENTS.md` (or equivalent) for repeated use. An agent should show the current
simulated preview, edit a separate candidate, validate and compare it, and only
change the live config when requested. Direct file edits do not inherit the
TUI's conflict and backup safeguards.

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
