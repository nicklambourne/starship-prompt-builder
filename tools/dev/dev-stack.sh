#!/usr/bin/env bash
# Run the canonical loopback development server used for persistent handoffs.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_root"

web_port="${STARSHIP_DEV_PORT:-3000}"
case "$web_port" in
  ''|*[!0-9]*)
    echo "dev stack: STARSHIP_DEV_PORT must be a numeric port" >&2
    exit 1
    ;;
esac
if ((web_port < 1 || web_port > 65535)); then
  echo "dev stack: STARSHIP_DEV_PORT must be between 1 and 65535" >&2
  exit 1
fi

echo "[start] Starship Prompt Builder at http://127.0.0.1:$web_port"
exec pnpm exec next dev --hostname 127.0.0.1 --port "$web_port"
