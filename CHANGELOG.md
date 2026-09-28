# Changelog

## Unreleased — expanded terminal app

- Coordinate saves with exclusive locks, unique private backups, final identity
  checks and non-clobbering creation. External editors are not covered by a
  universal compare-and-swap guarantee; stale locks require owner inspection.
- Validate complete nested schema types/unions; share scenario validation
  between CLI imports and browser session recovery. Accept empty share links.
- Bound regex previews and replace unsafe human terminal control bytes with
  visible markers without changing machine-readable config/JSON artifacts.
- Preserve raw TOML drafts until explicit Apply; preview drafts separately from
  applied downloads, retain comments, and make conflicts/discard explicit.
- Share grapheme-cell layout, announce visible right prompts, and hide collisions.
- Add parity inventory, named/right/Unicode/regex fixtures, offline generated-data
  checks, Firefox/WebKit smoke, performance baselines and aggregate deployment gates.

- Add typed configuration diagnostics, strict/JSON validation, stdin pipelines,
  terminal-cell alignment, and byte-preserving unchanged saves.
- Edit recursive left/right prompt formats, named modules, structured options,
  styles, palettes, and symbols from the terminal.
- Edit, save, load, and compare simulated scenarios without executing custom
  commands; exchange portable workspaces and config-only browser links.
- Review exact regenerated TOML and semantic changes before saving; detect
  external conflicts, keep backups, and recover private drafts.
- Add searchable actions, Bash/Zsh/Fish completions, installation guidance,
  fresh-package checks, and PTY/ConPTY acceptance tests on supported runtimes.

This entry is unreleased. The package has not been published to npm.
