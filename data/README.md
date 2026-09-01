# Vendored data

Everything here except [`presets-community/`](presets-community) and
[`presets-inspired/`](presets-inspired) comes from
[starship](https://github.com/starship/starship), © the Starship contributors
and [ISC licensed](https://github.com/starship/starship/blob/master/LICENSE);
the first directory holds MIT-licensed themes from the projects whose palettes
they are, and the second holds original Starship translations of other prompt
styles. Each has a README of its own. Vendored files are not hand-edited;
translated presets are maintained here as project source.

`*.generated.json` artefacts are committed so the app builds without a codegen
step. Regenerate them with `pnpm build:data` after any upstream sync.

## `config-schema.json` — synced

Starship's published configuration JSON Schema, generated from its Rust config
structs. Source: https://starship.rs/config-schema.json (retrieved 2026-08-18,
starship 1.26.0).

```sh
pnpm sync:schema     # curl the schema
pnpm build:schema    # regenerate schema.generated.json
```

(A diff report on sync is planned — see PLAN.md §6.)

## `schema.generated.json` — generated

Produced by `scripts/build-schema.mjs` from `config-schema.json`.

The raw schema is ~167 KB, most of it the reference prose repeated from
starship's docs site, plus the `$ref` scaffolding schemars emits. Shipping it
whole would put all of that in the client bundle and force a normalisation pass
on every page load. The generated artefact pre-resolves the `$ref`s, collapses
each option's type to one of the kinds the UI has an editor for, and keeps only
the first paragraph of each module description — the rest is a click away via
the per-module docs link in `src/lib/config/meta.ts`.

Result: 106 modules and 9 root options in roughly a third of the bytes.

## `presets/` — synced

Official preset TOMLs, copied verbatim from
https://github.com/starship/starship/tree/master/docs/public/presets/toml
(12 files, retrieved 2026-08-18).

## `presets.generated.json` — generated

Produced by `scripts/build-presets.mjs`. It folds the preset TOMLs into one
JSON file alongside the labels and descriptions from starship's
[presets index](https://starship.rs/presets/), because neither Next.js nor
vitest can `import` a `.toml` as text without a loader configured identically
in both.

```sh
pnpm build:presets
```
