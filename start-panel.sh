#!/usr/bin/env bash
# 启动 OpenSwarm Web 面板
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source "$SCRIPT_DIR/.env" && set +a

# 端口冲突交由 Node 报错，不终止其他应用或正在运行的面板。
PANEL_PORT="${PANEL_WEB_PORT:-3999}"

cd panel-web
# Prefer Homebrew Node 22 for local panel/openclaw compatibility.
if [[ -x "/opt/homebrew/opt/node@22/bin/node" ]]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
# Mac 上约 3 秒后自动打开浏览器（与 start-panel.command 一致）
[[ "$(uname)" == "Darwin" ]] && (sleep 3 && open "http://localhost:${PANEL_PORT:-3999}" 2>/dev/null) &
exec node server.js
