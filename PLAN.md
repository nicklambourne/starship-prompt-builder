# Starship Prompt Builder — Project Plan

A live, in-browser configurator for the [Starship](https://starship.rs) cross-shell
prompt. Point, click, and preview your prompt in a simulated terminal — then export
a `starship.toml` that reproduces exactly what you saw.

- **Live site:** https://starship.ndl.au/
- **Repo:** https://github.com/nicklambourne/starship-prompt-builder
- **Status:** M0–M4 complete. All 102 starship modules implemented, the parity
  harness is green against real starship, and the builder is live. M5 (polish,
  a11y audit, launch) is what remains.

---

## 1. Why

Starship is configured through a single `starship.toml` with ~80 modules, each with
its own options, format strings, and style strings. The feedback loop today is:
edit TOML → reload shell → squint → repeat. There is no official visual editor.

Starship Prompt Builder closes that loop: every setting change re-renders a simulated
prompt instantly, across multiple mocked shell contexts (clean repo, dirty repo,
failed command, Python project, SSH session, …), and the resulting TOML is always
one click away.

### Goals

1. **Live preview** — faithful rendering of the prompt for a given config and a
   mocked shell context, updating on every keystroke.
2. **Full-fidelity config model** — support the real config surface: top-level
   options, per-module options, format strings, style strings, palettes, presets.
3. **Import & export** — paste an existing `starship.toml` and continue from it;
   export a minimal TOML (non-default values only) or a full one.
4. **Zero backend** — fully static site, all parsing/rendering client-side.
   No accounts, no telemetry, no server. Shareable configs encode into the URL.
5. **Open source** — MIT, contributions welcome, module coverage is parallelisable.

### Non-goals

- Executing real shell commands or reading the visitor's actual environment.
- Being a general ANSI/terminal emulator (no scrollback, no PTY).
- Supporting starship's transient prompts for specific shells beyond visual
  approximation (shell-specific behaviour is out of scope for a browser).
- A theme-sharing community backend (a curated in-repo gallery covers this;
  anything server-side violates goal 4).

---

## 2. Product overview

Single-page builder with three primary panes (responsive: stacked with tabs on
mobile, side-by-side on desktop — both first-class from day one):

```
┌────────────┬──────────────────────────┬───────────────────────┐
│  Modules   │  Settings (per module)   │  Preview              │
│            │                          │  ┌─────────────────┐  │
│ ☑ directory│  format   [template…]    │  │ simulated       │  │
│ ☑ git_br…  │  style    [style builder]│  │ terminal        │  │
│ ☑ git_st…  │  symbol   [ input]      │  └─────────────────┘  │
│ ☐ nodejs   │  disabled [switch]       │  Scenario: [dirty-git]│
│ …          │  truncation_length [3]   │  ┌─────────────────┐  │
│ (drag to   │  …                       │  │ starship.toml   │  │
│  reorder)  │                          │  │ (live output)   │  │
└────────────┴──────────────────────────┴───────────────────────┘
```

Key interactions:

- **Module list** — search, enable/disable (writes `disabled = true/false`),
  drag-to-reorder (rewrites the top-level `format` string). Modules grouped:
  core (directory, character, git\_\*…), languages, cloud/context, misc.
- **Settings pane** — schema-driven form for the selected module; a "top level"
  pseudo-module edits `format`, `right_format`, `add_newline`, `palette`, etc.
- **Preview pane** — the simulated terminal (see §4) plus a scenario switcher
  and a terminal-theme switcher (a few bundled colour schemes + light/dark).
- **TOML pane** — live two-way view: edits to the TOML re-parse into the UI;
  UI changes re-serialise. Copy / download buttons.
- **Preset gallery** — start from any official starship preset
  (nerd-font-symbols, pastel-powerline, tokyo-night, gruvbox-rainbow, …).
- **Share** — config compressed (lz-string) into the URL fragment; opening a
  shared link restores the full builder state. Fragment = never sent to a server.

---

## 3. Architecture

Fully static Next.js app (`output: "export"`), deployed to GitHub Pages. All
logic runs in the browser; the only "data" is vendored JSON/TOML checked into
the repo at build time.

```
src/
  app/                    # Next.js App Router pages and metadata
  components/
    builder/
      Builder.tsx         # page composition and engine/UI adapters
      useBuilderSession.ts # URL, storage, and lifecycle coordination
      FormatBuilder.tsx   # structured format-editor composition
      useFormatTreeDrag.ts # format-tree gesture coordination
      FormatNode.tsx      # one recursive format row
      SettingsForm.tsx    # schema-driven module options
    terminal/             # static terminal and segment rendering
    ui/                   # shared controls, popovers, icons, fields
  lib/
    engine/               # THE CORE — pure TS, zero React imports
      formatString.ts     #   format-string parser → AST
      styleString.ts      #   style-string parser → Style
      render.ts           #   format evaluation
      prompt.ts           #   whole-prompt assembly
      ansi.ts             #   Segment[] → ANSI (for parity tests)
      modules/            #   one file per starship module + registry
    config/               # TOML, defaults, presets, metadata, share/session
    scenarios/            # mocked shell contexts used by preview and parity
  state/
    builderStore.ts       # zustand state, actions, and bounded history
data/                     # vendored upstream artefacts and generated metadata
public/                   # static images and subsetted terminal fonts
```

**Engine is pure and framework-free.** `lib/engine` takes
`(config, scenario) → Segment[][]` and never touches the DOM. This is what makes
the parity test harness (§8) possible: the same engine output serialises to ANSI
for comparison against real starship, and to React spans for display.

**State and UI coordination:** the zustand store owns durable builder state —
the parsed config, simulated scenario, terminal choices, actions, and bounded
undo/redo history. Editor-local state such as disclosures, search, popovers, and
drag targets stays with the component that renders it. `Builder` and
`FormatBuilder` compose data and callbacks; dedicated hooks own browser session
side effects and format-tree gestures. Derived prompt output and UI adapters are
memoised in the composition layer rather than folded into the pure engine.

---

## 4. The rendering engine

The hard, valuable part. Starship's rendering has three layers we must reproduce:

### 4.1 Format strings

Grammar (per starship docs):

- **Text** — literal output; `\` escapes `$ \ [ ] ( )`.
- **Variables** — `$module` / `${module}`; `${env_var.NAME}` and
  `${custom.name}` dotted forms; the special `$all` expands to every
  not-explicitly-mentioned module in default order.
- **Text groups** — `[content](style)`: content rendered with the style.
  Nestable; inner styles override.
- **Conditionals** — `(content)`: rendered only if at least one variable inside
  is non-empty. Nestable.
- In *module* format strings, variables are the module's own (`$symbol`,
  `$branch`, `$version`, `$style`, …) rather than module names.

Parser: hand-written recursive-descent → small AST
(`Text | Variable | Group | Conditional`). No parser library needed; the grammar
is tiny but the escaping/nesting rules deserve exhaustive unit tests.

### 4.2 Style strings

Space-separated tokens, e.g. `bold fg:#af8700 bg:blue`, `underline dimmed red`,
`none`:

- Modifiers: `bold`, `italic`, `underline`, `dimmed`, `inverted`, `blink`,
  `hidden`, `strikethrough`, `none`.
- Colours: 16 named (`red`, `bright-blue`, …), 256-indexed (`fg:38`),
  24-bit hex (`#af8700`), with `fg:`/`bg:` prefixes (bare colour = foreground).
- **Palettes**: `palette = "name"` + `[palettes.name]` tables define named
  colours usable anywhere a colour is (including redefining `red` etc.).

Parsed to `{ fg?, bg?, modifiers: Set }`. Rendered to CSS (inline style / CSS
vars); the same struct serialises to SGR codes for parity tests.

### 4.3 Modules

Each module is `{ name, defaults, evaluate }` where
`evaluate(options, scenario) → Record<string, Value> | null`:

- `null` ⇒ module not shown (e.g. `git_branch` outside a repo, `nodejs` with no
  `package.json` in the mocked context).
- Otherwise the returned variables (plus `symbol`/`style` from options) are
  interpolated into the module's `format` template via the §4.1 parser.

Cross-cutting behaviours to implement in the shared renderer, not per-module:

- Top-level `format` default (`$all` + defined module order), `right_format`,
  `add_newline`, `line_break` module, multi-line prompts.
- `fill` module — pads to terminal width; preview uses a configurable width
  (default 80 cols) so `fill` and `right_format` behave believably.
- `character` — success/error/vim-keymap variants driven by scenario state.
- Version formatting (`version_format = "v${raw}"`), path truncation +
  `truncate_to_repo`, `truncation_symbol`, repo-root highlighting in
  `directory`.
- `detect_files` / `detect_extensions` / `detect_folders` options evaluated
  against the scenario's mocked file listing — so toggling detection options
  visibly flips modules on/off.

**Fidelity strategy:** v1 is a TypeScript re-implementation, kept honest by the
parity harness (§8). Compiling starship itself to WASM was considered and
deferred: starship links against libgit2, spawns external processes for version
detection, and does real filesystem scanning — the surgery to extract a pure
"formatter core" upstream is a possible v2 contribution to starship itself, not
a v1 dependency.

### 4.4 Terminal display

A custom React component, not xterm.js — we render a *static* prompt, not an
interactive PTY, and we need clean control over themes, wrapping, and copy
behaviour. `Segment[] → <span>` with a colour-scheme map (ANSI 16 → theme
colours; a few bundled themes: one dark default, one light, plus
popular schemes later). A bundled **Nerd Font subset** (JetBrainsMono Nerd Font,
OFL — glyphs woff2-subsetted at build time) makes preset symbols render
correctly, with a "no nerd font" toggle that swaps to a plain stack so users can
see what non-patched fonts will show.

---

## 5. Scenario simulation

A `Scenario` is a mocked shell context — the input starship would normally read
from the environment:

```ts
interface Scenario {
  path: string;               // cwd; repo root marked for truncate_to_repo
  files: string[];            // flat listing for detect_* rules
  git?: { branch; state?; ahead; behind; staged; modified; untracked; … };
  status: number;             // last exit code
  cmdDurationMs: number;
  jobs: number;
  user: string; host: string; ssh: boolean; root: boolean;
  shell: "zsh" | "bash" | "fish" | "pwsh" | …;
  keymap?: "insert" | "normal";
  time: string;               // fixed, for deterministic rendering
  battery?: { pct: number; charging: boolean };
  toolVersions: Record<string, string>;  // nodejs → "22.19.0", python → …
  env: Record<string, string>;
  k8s?, aws?, gcloud?, nix?, conda?, container?: …;
}
```

Bundled scenarios (switchable in the preview pane, each individually editable):

1. **Simple** — home directory, clean, exit 0.
2. **Dirty git repo** — branch `feat/thing`, staged+modified+untracked, ahead 2.
3. **Failed command** — exit 127, 3.2 s duration, 1 background job.
4. **Polyglot project** — package.json + pyproject.toml + Cargo.toml + Docker.
5. **SSH as root** — username/hostname modules light up.
6. **Cloud/K8s** — aws profile, gcloud, kubernetes context, terraform workspace.
7. **Rebase in progress** — `git_state`, conflicted files.

Scenarios are the demo *and* the test fixtures: each bundled scenario maps 1:1
to a reproducible fixture directory in the parity harness (§8).

---

## 6. Schema-driven settings UI

Two data sources, merged at build time:

1. **`data/config-schema.json`** — starship's published JSON Schema (generated
   from its Rust structs; 113 definitions). Gives us every module, option name,
   type, default, and doc-comment — and a `pnpm sync:schema` script diffs a
   fresh copy so new starship releases become a mechanical update.
2. **`data/module-meta.json`** — hand-curated overlay the schema can't express:
   human labels/grouping, docs URLs, which options are format/style strings
   (they're plain `string` in the schema), example values, per-module scenario
   hints ("this module needs `git` state to appear"), display order.

Control mapping (`SettingsForm` walks the merged schema):

| Schema shape                 | Control                                        |
| ---------------------------- | ---------------------------------------------- |
| `boolean`                    | Switch                                         |
| `string` (plain)             | TextField                                      |
| `string` (style, per meta)   | **StyleStringBuilder** — token chips + colour picker, palette-aware |
| `string` (format, per meta)  | **FormatEditor** — textarea with `$variable` autocomplete + inline validation |
| number                       | NumberField                                    |
| enum                         | Select                                         |
| `string[]`                   | Tag/chip editor                                |
| maps (`detect_files`, aliases, `palettes.*`) | Key-value editor              |

Unknown/unsupported options never block: anything the form can't render falls
back to a raw TOML value editor, so the full config surface is always reachable.

---

## 7. TOML import/export & sharing

- **Library:** `smol-toml` (parse + stringify, actively maintained, small).
- **Import:** parse → validate against schema (unknown keys kept, surfaced as
  warnings, round-tripped untouched) → populate store. Malformed TOML shows
  line-anchored errors; nothing is silently dropped.
- **Export:** diff against `defaults.ts`, emit only non-default values, in
  starship's documented key order, with a generated header comment. "Full
  export" toggle emits resolved defaults too (some users prefer explicit files).
- **Share links:** `location.hash = lz-string(minimal TOML)`. Hash fragments
  never reach a server (goal 4). A `?preset=tokyo-night` query loads a bundled
  preset by name for cheap deep-links from the gallery.

---

## 8. Testing & fidelity

The parity harness runs two sets of cases: hand-written fixtures for the
formatter's hard parts (conditionals, escapes, nested groups, palettes), and a
generated sweep with one case per module — 41 of them — pinning each module's
defaults against the real binary. Modules that depend on hardware, the clock,
the network or an installed toolchain cannot have a deterministic fixture;
they are listed with reasons in `tests/parity/sweep.ts` and printed by the
suite rather than quietly omitted.

Per the repo owner's standing rules: verification means real exit codes, tests
that fail without the fix, and looking at the actual UI — not just green suites.

1. **Unit (vitest)** — exhaustive table-driven tests for the format-string and
   style-string parsers (escaping, nesting, conditionals, palettes) and for each
   module's `evaluate` against scenario fixtures.
2. **Parity harness (the flagship)** — a CI job that installs *real* starship
   on the runner, materialises each bundled scenario as an actual directory
   (git repo with the right dirty state, `package.json`, mocked `PATH` shims so
   `node --version` etc. answer with the scenario's versions), then runs
   `starship prompt --terminal-width 80 --status <n> --cmd-duration <ms> --path <dir>`
   for a matrix of configs (defaults + every vendored preset) and compares raw
   ANSI output byte-for-byte against our engine's ANSI serialisation.
   Divergences fail CI with a rendered side-by-side diff. This pins the TS
   re-implementation to ground truth and catches starship upstream changes
   (the job also runs on a weekly schedule against starship latest).
3. **Component/e2e (Playwright)** — builder flows: toggle module → preview and
   TOML update; import preset → preview matches vendored golden render; share
   link round-trip. Run against a production build (`next build` output), not
   the dev server.
4. **Visual/manual** — every UI milestone verified in the browser at ~390 px and
   desktop widths before merge; screenshots in PRs.

CI (GitHub Actions, hosted runners): `typecheck` + `unit` + `build` on every PR;
parity + Playwright on PRs touching the engine and on `main`; Pages deploy on
`main` after checks pass.

---

## 9. Tech stack

| Concern      | Choice                            | Rationale                                    |
| ------------ | --------------------------------- | -------------------------------------------- |
| Framework    | Next.js 16 (App Router), React 19 | static export; maintainer's standard stack   |
| UI kit       | HeroUI v3 + Tailwind CSS v4       | modern styling per project brief             |
| Language     | TypeScript, strict                | engine correctness lives on types            |
| State        | zustand                           | small, selector-friendly, no boilerplate     |
| TOML         | smol-toml                         | parse + stringify, small, maintained         |
| Sharing      | lz-string                         | URL-fragment compression, tiny               |
| Tests        | vitest, Playwright                | fast unit runner; e2e against prod build     |
| Hosting      | GitHub Pages (`basePath: /starship-prompt-builder`) | free, static, fits goal 4         |
| Dev env      | nix + direnv (`tools/nix/shell.nix`) | pinned node/pnpm, no global installs      |

---

## 10. Milestones

**M0 — Scaffold & deploy** ✅
Repo, plan, Next.js + HeroUI + Tailwind static export, CI, Pages deploy,
vendored config schema.

**M1 — Engine core** ✅
Format-string and style-string parsers ported rule-for-rule from starship's
pest grammar and `parse_style_string`, with table-driven unit tests; segment
renderer with starship's conditional, text-group and meta-variable semantics;
ANSI serialiser reproducing nu_ansi_term's style-difference algorithm; the
simulated terminal with seven colour schemes and a Nerd Font picker.

**M2 — Full editor** ✅
Schema-driven settings for every module, driven by the vendored JSON schema
plus a curated overlay marking which strings are format strings and which are
style strings (derived mechanically from starship's `map_meta` bindings, since
the schema types both as plain `string`). Style builder, format editor with
live validation, module search/toggle/reorder, TOML import with error
reporting, seven scenarios, undo/redo.

**M3 — Presets, palettes, sharing** ✅
All 12 official presets vendored and loadable; palette-aware colour pickers;
share links compressed into the URL fragment; right prompt, multi-line and
`fill` support.

**M4 — Module coverage** ✅
All 102 modules in starship's `PROMPT_ORDER`, each with defaults copied
verbatim from `src/configs/*.rs` and verified programmatically code point by
code point. A coverage test fails if starship gains a module the registry does
not implement.

**M5 — Polish & launch** — remaining
Submission to starship's community list. Also outstanding: the approximations
listed in §13.

CI stays on GitHub-hosted runners for as long as this repository is public;
the self-hosted cluster is deliberately not used (see `docs/ci-runners.md`).

---

## 10a. What the engine does not reproduce

Faithfulness has a boundary: a browser cannot run `git`, spawn version
commands, or read a filesystem. Where a module depends on that, it reads from
the Scenario instead, and the approximation is documented in the module's own
file. The ones worth knowing:

- **Version detection** is scenario data, not a real `--version` call, so a
  module hides when its tool is absent from the scenario rather than printing a
  bare symbol.
- **`aws`** cannot inspect a credentials file; a named profile stands in, with
  `force_display` honoured exactly.
- **`git_status`** carries aggregate counts only, so worktree-versus-index
  sub-counts follow the aggregates and typechanges are always zero.
- **`custom`** cannot execute commands, so `$output` is always empty.
- **`memory_usage`**, **`localip`**, **`sudo`** and **`battery`** use fixed
  plausible readings, chosen so that editing their thresholds still visibly
  flips them on and off.

## 11. Risks & mitigations

| Risk                                                        | Mitigation                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| Renderer drifts from real starship (the "uncanny preview")  | Parity harness from M1 day one; weekly CI against starship latest          |
| Starship config surface changes upstream                    | `sync:schema` diff script; schema-driven UI absorbs new options cheaply    |
| Format-string edge cases (escaping, nesting) are gnarly     | Grammar is small; table-driven tests seeded from starship's own docs/tests |
| Module long tail stalls momentum                            | Registry design makes each module a ~1-file contribution; label as good-first-issue |
| Nerd Font licensing/size                                    | Fonts split by `unicode-range` into text, used icons and the long tail (`pnpm build:fonts`); no subset carries a Reserved Font Name |
| HeroUI v3 gaps for exotic controls (colour picker, drag)    | HeroUI for chrome; specialised bits hand-rolled or headless (dnd-kit)      |
| GitHub Pages `basePath` foot-guns (assets, deep links)      | `basePath` set from M0; e2e runs against the exported output              |

---

## 12. Licensing & attribution

- This project: **MIT** (© Nicholas Lambourne).
- Starship is **ISC**-licensed; vendored artefacts (config schema, preset
  TOMLs) retain attribution in `data/README.md` and are synced, not forked.
- JetBrainsMono Nerd Font: **OFL 1.1** (licence shipped alongside the subset).
- "Starship Prompt Builder" is an unaffiliated community tool; the README states this
  and links to the official project.
