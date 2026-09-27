# Terminal acceptance checklist

The checks below are run from the task worktree, not the coordination checkout.
The component suite exercises detailed controls; a passing component suite
alone is not evidence that a real terminal works. The packed-package and
PTY/ConPTY journeys cover the installed entry point.

| Journey | Automated check |
| --- | --- |
| New interactive config, explicit missing read-only input, malformed option | `configFile.test.ts`, `test-package.mjs` |
| Recursive format, right prompt, named modules, palettes and structured values | `App.test.tsx`, `formatEditor.test.ts`, `structuredValue.test.ts`, `palettes.test.ts`, `namedModules.test.ts` |
| Apply/cancel, undo/redo, external editor return | `App.test.tsx`, `model.test.ts`, `externalEditor.test.ts` |
| Scenario picker, versioned files, workspace exchange and simulated custom output | `App.test.tsx`, `scenarioFile.test.ts`, `workspaceFile.test.ts` |
| Save review, unchanged bytes, backup, conflict, symlink and draft | `App.test.tsx`, `configFile.test.ts`, `documentReview.test.ts`, `draftFile.test.ts` |
| Width, Unicode cells, narrow terminal and no color | `terminalWidth.test.ts`, `App.test.tsx`, `test-terminal.mjs` |
| Installed open → edit → review → save → quit, resize and Ctrl+C | `pnpm test:cli:pty` (PTY/ConPTY) |
| Fresh package, stdin, share links, validation exit codes, completions, version | `pnpm test:cli:package` |
| Web/browser and accessibility regression | `pnpm test:e2e` |
| Starship engine parity | `pnpm test:parity` locally if Starship is installed; PR parity workflow otherwise |

Before a public npm release, manually smoke at least one SSH session, a small
and large window in an actual Unix terminal, and Windows Terminal. CI's
ConPTY journey is process-level but cannot establish every emulator's font and
keybinding behavior. These manual checks are not represented as completed by
the automated suite.
