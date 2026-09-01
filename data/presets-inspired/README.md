# Prompt-inspired presets

Original Starship configurations that recreate styles from other prompt
projects. Unlike the files in adjacent `presets/` and `presets-community/`,
these TOMLs are translations rather than verbatim upstream files.

The six Powerlevel10k presets translate the Lean, Classic and Rainbow styles,
each at one-line and two-line prompt heights. Their module order, ANSI-256
colours, separators, spacing and demonstration shell state were derived from
Powerlevel10k's official `internal/wizard.zsh`, `config/p10k-lean.zsh`,
`config/p10k-classic.zsh` and `config/p10k-rainbow.zsh` at commit
`3308262dfbd743b6e1d3956a2b5572f7a049d692`, retrieved 2026-09-01. The
Starship presets deliberately translate those semantics rather than vendoring
Zsh-specific configuration.

Powerlevel10k is MIT licensed: © 2009–2014 Robby Russell and contributors;
© 2014–2017 Ben Hilburn; © 2019 Roman Perepelitsa and contributors. The picker
and the licences page carry the same attribution.
