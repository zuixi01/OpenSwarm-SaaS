#!/bin/bash
# 启动主控（openclaw tui）
# 端口：18789，agent：main

printf '\033]0;主控 - openclaw\007'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT_FOR_ENV="$(cd "$SCRIPT_DIR/.." && pwd)"
[[ -f "${PROJECT_ROOT_FOR_ENV}/.env" ]] && source "${PROJECT_ROOT_FOR_ENV}/.env" 2>/dev/null || true
YIN_DIR="$SCRIPT_DIR"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_DIR="${OPENCLAW_DIR:-$PROJECT_ROOT/openclaw}"
MAIN_GATEWAY_PORT=18789

# openclaw 2026 requires Node >=22.12; fallback to npx node@22.12.0 on older runtimes.
OPENCLAW_NODE_CMD=()
if command -v node >/dev/null 2>&1; then
  NODE_MAJ=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
  NODE_MIN=$(node -p "process.versions.node.split('.')[1]" 2>/dev/null || echo 0)
else
  NODE_MAJ=0
  NODE_MIN=0
fi
if [[ "$NODE_MAJ" -gt 22 || ( "$NODE_MAJ" -eq 22 && "$NODE_MIN" -ge 12 ) ]]; then
  OPENCLAW_NODE_CMD=(node)
else
  OPENCLAW_NODE_CMD=(npx -y node@22.12.0)
fi

cd "$OPENCLAW_DIR" || exit 1

export OPENCLAW_STATE_DIR="$YIN_DIR"
export OPENCLAW_GATEWAY_PORT=$MAIN_GATEWAY_PORT
export OPENSWARM_ROOT="$PROJECT_ROOT"

# 清除代理环境变量，让 openclaw 直连智谱 API（不需要梯子）
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

# 检查主网关是否已启动
if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -q ":${MAIN_GATEWAY_PORT} "; then
  echo "主网关已在运行（端口 ${MAIN_GATEWAY_PORT}）"
else
  echo "启动主网关（端口 ${MAIN_GATEWAY_PORT}）..."
  # 清理可能残留的锁文件
  rm -f "$YIN_DIR"/agents/main/sessions/*.lock 2>/dev/null
  nohup "${OPENCLAW_NODE_CMD[@]}" openclaw.mjs gateway </dev/null >> /tmp/openswarm-main.log 2>&1 &
  # 等待 gateway 就绪（最多15秒）
  for i in {1..15}; do
    if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -q ":${MAIN_GATEWAY_PORT} "; then
      echo "网关已就绪"
      break
    fi
    sleep 1
  done
fi

# 启动 TUI
exec "${OPENCLAW_NODE_CMD[@]}" openclaw.mjs tui
