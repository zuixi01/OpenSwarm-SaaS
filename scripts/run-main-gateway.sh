#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_DIR="$ROOT_DIR/openclaw"
YIN_DIR="$ROOT_DIR/yin"
MAIN_PORT="${MAIN_GATEWAY_PORT:-18789}"
LOG_FILE="/tmp/openswarm-main.log"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

resolve_node_cmd() {
  local maj min cached
  maj="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  min="$(node -p "process.versions.node.split('.')[1]" 2>/dev/null || echo 0)"
  if [[ "$maj" -gt 22 || ( "$maj" -eq 22 && "$min" -ge 12 ) ]]; then
    echo "node"
    return 0
  fi
  cached="$(find "$HOME/.npm/_npx" -type f -path '*/node_modules/node/bin/node' 2>/dev/null | head -n 1 || true)"
  if [[ -n "$cached" ]]; then
    echo "$cached"
    return 0
  fi
  echo "npx -y node@22.12.0"
}

NODE_CMD="$(resolve_node_cmd)"

cd "$OPENCLAW_DIR"
export OPENCLAW_STATE_DIR="$YIN_DIR"
export OPENCLAW_GATEWAY_PORT="$MAIN_PORT"
export OPENSWARM_ROOT="$ROOT_DIR"
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

exec bash -lc "$NODE_CMD openclaw.mjs gateway" >>"$LOG_FILE" 2>&1
