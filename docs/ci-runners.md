# CI runners

**This repository is public, so every job runs on GitHub-hosted runners. It is
not, and should not be, moved onto the `ubox` self-hosted cluster.**

## Why not ubox

The other repositories on that cluster — `byteling`, `everyscreen`, `noodle` —
are private. This one is public, and that difference is decisive.

`ubox` runs MicroK8s on a home LAN and holds production credentials. A public
repository accepts pull requests from forks, and a fork's pull request carries
attacker-authored code: its workflow files, its build scripts, its
dependencies. Running that on a machine inside the network is handing a
stranger a shell on the LAN.

The mitigation usually offered is a runner split — fork pull requests to
GitHub-hosted runners, everything else self-hosted:

```yaml
runs-on: ${{ (github.event.pull_request.head.repo.fork && 'ubuntu-latest') || vars.SELF_HOSTED_RUNNER || 'ubuntu-latest' }}
```

That was this repository's design, and it is now rejected, for three reasons:

1. **It is one expression away from a LAN breach.** Every new workflow, and
   every edit to an existing one, has to repeat the guard correctly. A job that
   omits it fails open — onto the cluster — and nothing in CI complains.
2. **`pull_request_target`, `workflow_run` and label-triggered reruns each
   defeat it differently.** Any of them can put fork-authored code on a trusted
   ref, and the expression above only inspects `pull_request`.
3. **The prize is small.** The whole suite is a few minutes of Node. There is
   no GPU, no giant cache, no proprietary toolchain — nothing the cluster gives
   this project that a hosted runner does not.

The cluster's own `arc.tf` already encodes the same conclusion for the public
`nicklambourne` profile repository: it has no scale set.

## What runs where

| Workflow     | GitHub-hosted runners   | Notes                                      |
| ------------ | ----------------------- | ------------------------------------------ |
| `ci.yml`     | Ubuntu, macOS, Windows  | web checks; Node 20 CLI and package matrix |
| `parity.yml` | Ubuntu                  | installs Starship, compares raw ANSI       |
| `deploy.yml` | Ubuntu                  | builds the export, publishes to Pages      |

Toolchains come from `actions/setup-node`, with pnpm resolved through corepack
from the `packageManager` field. There is no job `container:` — that existed
only because ARC runs in Kubernetes container mode, where the `setup-*` actions
do not work.

## If this repository ever goes private

Then the calculus changes and the cluster is a reasonable host. Follow the
byteling setup: install the ARC GitHub App on the repository, add a scale set
to `arc.tf` plus its values file, `terraform apply`, and set the
`SELF_HOSTED_RUNNER` repository variable to the scale-set name. Note that ARC
runs without Docker-in-Docker, so `actions/setup-*` stops working and the
toolchain has to move back into a job `container:`.
