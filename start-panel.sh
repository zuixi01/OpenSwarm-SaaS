#!/usr/bin/env bash
# 启动 OpenSwarm Web 面板
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[[ -f "$SCRIPT_DIR/.env" ]] && set -a && source "$SCRIPT_DIR/.env" && set +a

# 若端口 3999 已被占用，先释放（避免复制项目后旧实例占端口导致 EADDRINUSE）
PANEL_PORT="${PANEL_WEB_PORT:-3999}"
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :"$PANEL_PORT" 2>/dev/null || true)
  if [[ -n "$PIDS" ]]; then
    echo "端口 $PANEL_PORT 已被占用，正在释放..."
    kill -9 $PIDS 2>/dev/null || true
    sleep 1
  fi
fi

cd panel-web
# Prefer Homebrew Node 22 for local panel/openclaw compatibility.
if [[ -x "/opt/homebrew/opt/node@22/bin/node" ]]; then
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
# Mac 上约 3 秒后自动打开浏览器（与 start-panel.command 一致）
[[ "$(uname)" == "Darwin" ]] && (sleep 3 && open "http://localhost:${PANEL_PORT:-3999}" 2>/dev/null) &
exec node server.js
