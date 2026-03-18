#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PANEL_DIR="$ROOT_DIR/panel-web"
LOG_FILE="/tmp/panel-web.log"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

cd "$PANEL_DIR"
exec node server.js >>"$LOG_FILE" 2>&1
