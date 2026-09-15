# Starship Prompt Builder CLI

An interactive terminal editor for `starship.toml`, powered by the same
renderer and bundled module definitions as the Starship Prompt Builder web
app.

```sh
starship-builder ~/.config/starship.toml
starship-builder --preset plain-text-symbols
starship-builder preview ~/.config/starship.toml --no-color
starship-builder validate ~/.config/starship.toml
```

Use arrow keys or `j`/`k` to navigate, Enter to edit, Space to toggle, `a` to
add, `m` to move, Ctrl+Z/Ctrl+Y to undo/redo, and Ctrl+S to review and save.
The shorter `spb` command is an alias. Requires Node.js 20 or newer.
