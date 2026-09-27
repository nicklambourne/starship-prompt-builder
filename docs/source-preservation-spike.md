# TUI source-preservation spike

The current parser (`smol-toml`) returns values, not source spans or a mutable
syntax tree. Regenerating valid TOML from its values preserves semantic known
and unknown settings, but cannot retain comments, chosen quote styles,
whitespace, or CRLF line endings. The corpus in
`packages/cli/src/sourcePreservation.test.ts` pins these cases: comments,
array-of-tables, quoted/dotted keys, multiline strings, unknown tables, and
CRLF all parse and re-export semantically but differ byte-for-byte.

Two approaches were considered:

1. **Source-aware TOML syntax tree.** This is the only credible route to broad
   comment/format preservation, but the current parser does not provide source
   spans. Replacing it needs separate work on duplicate keys, arrays-of-tables,
   mixed quoting, and error recovery before it is safe for dotfiles.
2. **Conservative targeted text patches.** A line-based replacement handles
   one flat scalar but fails on dotted/quoted keys, repeated array tables,
   multiline values, and comments attached to a line. It cannot reliably
   identify which same-named key was edited without parsing source structure.

For T4, edited saves therefore use a **complete, explicit regenerated-file
review** and keep a backup. An unchanged loaded file is not written at all.
No universal comment preservation is claimed. Source-preserving mutation is
a follow-up only after a source-aware parser and the corpus pass byte-level
tests for changes outside the edited span.
