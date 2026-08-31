# Contributing

The most useful contributions are about **fidelity**: this project
re-implements starship's renderer in TypeScript, and a re-implementation drifts
from the thing it copies unless people keep checking. If you have ever looked
at the preview and thought *that is not what my prompt does*, that is a bug
worth reporting, and usually a small one to fix.

```sh
pnpm install
pnpm dev
```

Before opening a pull request:

```sh
pnpm typecheck
pnpm test
pnpm build && pnpm test:e2e
pnpm test:parity     # needs the real starship on PATH
```

The parity suite skips locally when starship is missing and fails in CI, so
please install it — `curl -fsSL https://starship.rs/install.sh | sh` — if you
are touching the engine.

## Where changes belong

The runtime has four deliberate boundaries:

- `src/lib/engine/` is pure TypeScript. It accepts config plus a simulated
  scenario and never imports React, reads the DOM, or probes the real machine.
- `src/lib/config/` translates between Starship data and builder data: TOML,
  defaults, metadata, presets, format trees, sharing, and local sessions.
- `src/state/builderStore.ts` owns durable builder state, actions, and bounded
  undo/redo history. Short-lived disclosure, search, popover, and drag state
  stays in the component that renders it.
- `src/components/builder/Builder.tsx` composes the page and its engine/UI
  adapters. Browser persistence belongs in `useBuilderSession`; structured
  format composition belongs in `FormatBuilder`; format-tree gestures belong
  in `useFormatTreeDrag`; and recursive row rendering belongs in `FormatNode`.

If a change starts moving rendering rules into a component or browser effects
into the store, stop and keep the boundary explicit instead.

## Adding or correcting a module

Every starship module is one file in
[`src/lib/engine/modules/`](src/lib/engine/modules/), exporting a
`ModuleDefinition`. Here is a whole one:

```ts
/**
 * `guix_shell` — whether the shell is inside a guix shell.
 *
 * Port of `src/modules/guix_shell.rs`.
 */

import { type ModuleDefinition, optString } from "./types";

export const guixShell: ModuleDefinition = {
  name: "guix_shell",
  defaults: {
    format: "via [$symbol]($style) ",
    symbol: "🐃 ",
    style: "yellow bold",
    disabled: false,
  },

  evaluate(options, { scenario }) {
    if (scenario.env.GUIX_ENVIRONMENT === undefined) return null;

    return { variables: { symbol: optString(options, "symbol") } };
  },
};
```

Three rules, and they are the whole job:

1. **`defaults` are copied from starship's Rust, byte for byte.** They live in
   `src/configs/<module>.rs` upstream. Trailing spaces in format strings are
   load-bearing, and so are the exact Nerd Font glyphs — copy, do not retype.
   A test walks every module and compares them code point by code point.
2. **`evaluate` returns `null` when the module would not appear.** That is how
   starship's own modules behave, and it is what makes the preview honest: a
   module that is switched on but showing nothing is a real state, and the
   interface explains it rather than pretending.
3. **Read the environment from `scenario`, never from the machine.** The engine
   is pure: no filesystem, no processes, no clock. Anything the module needs
   comes from [`Scenario`](src/lib/scenarios/types.ts) — add a field if what
   you need is not there yet, and add a control for it in
   [`EnvironmentPanel`](src/components/builder/EnvironmentPanel.tsx) so people
   can drive it.

Register the module in
[`src/lib/engine/modules/index.ts`](src/lib/engine/modules/index.ts). A
coverage test fails if starship's prompt order contains a module the registry
does not, so a new upstream module announces itself.

### Proving it

Add a case to [`tests/parity/sweep.ts`](tests/parity/sweep.ts), which gives
most modules one already. A case makes the module appear on **both** sides:
the real binary reads the environment and the filesystem of a temporary
directory, and the engine reads the scenario, so a case that sets one usually
has to set the other.

```ts
{ module: "guix_shell", env: { GUIX_ENVIRONMENT: "/gnu/store/env" },
  scenario: { env: { GUIX_ENVIRONMENT: "/gnu/store/env" } } },
```

The harness asserts a case actually renders something, so a pair that agrees
about nothing at all fails rather than passing quietly.

Some modules cannot have a deterministic fixture — they read hardware, the
clock, the network, or a version from a toolchain that may not be installed on
the machine running the tests. Those belong in `UNSWEEPABLE` **with the
reason**; the suite prints the list, so the gap stays visible.

## Anything else

- Match the surrounding style. The codebase comments *why*, not *what*, and
  keeps to Australian spelling.
- UI changes need a look in a real browser at both ~390px and desktop widths —
  a green test suite is not evidence that something looks right.
- `tests/e2e/accessibility.spec.ts` runs axe over the whole interface in both
  themes and fails on any WCAG 2.1 AA violation. New UI has to clear it.
- One pull request per change, branched from a fresh `main`.

Questions, or an idea you are not sure about, are welcome as an issue first —
particularly for anything that changes what the engine renders.
