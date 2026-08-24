# Community presets

Starship themes published by the projects whose palettes they are, rather than
by starship itself. Vendored verbatim, exactly as the parent `presets/`
directory holds starship's own, and folded into `presets.generated.json` by
`pnpm build:presets`.

All three projects licence these under the MIT licence, which permits
redistribution with attribution; the picker names the project beside each
preset and [`THIRD_PARTY.md`](../../THIRD_PARTY.md) records the terms.

| File | Project | Retrieved |
| --- | --- | --- |
| `catppuccin.toml` | [catppuccin/starship](https://github.com/catppuccin/starship) (`starship.toml`) | 2026-08-24 |
| `dracula.toml` | [dracula/starship](https://github.com/dracula/starship) (`starship.theme.toml`, the self-contained variant) | 2026-08-24 |
| `rose-pine.toml` | [rose-pine/starship](https://github.com/rose-pine/starship) | 2026-08-24 |
| `rose-pine-moon.toml` | [rose-pine/starship](https://github.com/rose-pine/starship) | 2026-08-24 |
| `rose-pine-dawn.toml` | [rose-pine/starship](https://github.com/rose-pine/starship) | 2026-08-24 |

Dracula publishes two files: `starship.toml`, which is the palette alone, and
`starship.theme.toml`, which is the palette plus the module styling it is for.
The second is the one bundled — the first would load as a preset that changes
nothing you can see.
