# CLI release gate

The package manifest, binary, and changelog must agree. `packages/cli/scripts/build.mjs`
embeds the manifest version into the binary; the fresh-install smoke test
compares `--version` with the installed manifest. Do not infer publication from
the presence of a package manifest: as checked on 2026-09-27, the npm registry
returned 404 for `starship-prompt-builder-cli`.

Before publishing:

1. Confirm ownership of the intended npm package name and obtain explicit
   release authorization. This repository does not carry a publish token or
   auto-publish on pull requests.
2. Move the Unreleased changelog entry to the release version and update
   `packages/cli/package.json`. Run `pnpm install --lockfile-only` and verify
   `starship-builder --version` from a freshly packed install.
3. Require green `pnpm lint`, `pnpm deadcode`, `pnpm test`, `pnpm build`,
   `pnpm test:e2e`, `pnpm test:cli:package`, and `pnpm test:cli:pty`. The PR
   workflow runs package and PTY/ConPTY journeys on GitHub-hosted Linux,
   macOS, and Windows runners under both Node.js 22 and 24. Inspect the
   completed job metadata to confirm the actual runner for each job.
4. Run `pnpm --dir packages/cli pack`, inspect tarball contents and size,
   then use `npm publish --dry-run` from the package directory. Verify that
   the runtime bundle, README, license, and binary are present.
5. Publish manually only after the above review, then install into a new
   consumer directory and compare the published package version and behavior
   with the release artifact.

Platform claims are limited to configurations actually checked by CI. The
interactive journey covers open → edit → review → save → quit, resize, and
Ctrl+C; additional terminal emulators and SSH sessions should be manually
smoked before a public release. The preview's glyph appearance still depends
on the user's terminal font.
