# Security and support

For a suspected vulnerability, use **Report a vulnerability** on the repository's
GitHub Security tab when private reporting is enabled. If unavailable, contact
the maintainer through the contact information on the repository owner's public
profile. Do not put secrets, personal TOML, shell history or exploit payloads in
a public issue. Ordinary bugs belong in GitHub Issues with a minimal synthetic
config and the CLI/site version.

## Boundaries

The site is static and renders simulated environments locally. Config imports,
URL fragments, storage, scenario files and preview text are untrusted. The engine
does not execute custom commands; the real Starship parity tests execute only
repository-controlled synthetic fixtures on GitHub-hosted runners.

CLI apply requires explicit approval and a reviewed candidate. Same-target saves
are coordinated by a private exclusive lock; external editors do not participate
in that lock. A final identity/hash check reduces but cannot eliminate the race
between a non-cooperating writer and rename. Parent directories must be trusted.
Backups use exclusive, unpredictable names and private permissions. Never treat
a stale-lock error as permission to delete an active writer's lock.

Human terminal text is sanitized before trusted styles are composed. JSON and
config artifacts preserve data, so consuming programs must also render untrusted
strings safely. Regex previews use a bounded RE2 subset, not arbitrary JS regex.

Production response headers belong to the Cloudflare infrastructure owner, not
the static export. See `docs/security-headers.md` for the required edge policy.
Release publishing and live protection changes require maintainer approval.
