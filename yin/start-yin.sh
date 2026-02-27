#!/bin/bash
# 启动阴（openclaw tui）
# 端口：18789，agent：main

printf '\033]0;阴 - openclaw\007'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT_FOR_ENV="$(cd "$SCRIPT_DIR/.." && pwd)"
[[ -f "${PROJECT_ROOT_FOR_ENV}/.env" ]] && source "${PROJECT_ROOT_FOR_ENV}/.env" 2>/dev/null || true
YIN_DIR="$SCRIPT_DIR"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCLAW_DIR="${OPENCLAW_DIR:-$PROJECT_ROOT/openclaw}"
MAIN_GATEWAY_PORT=18789

cd "$OPENCLAW_DIR" || exit 1

export OPENCLAW_STATE_DIR="$YIN_DIR"
export OPENCLAW_GATEWAY_PORT=$MAIN_GATEWAY_PORT
export YINOVA_ROOT="$PROJECT_ROOT"

# 清除代理环境变量，让 openclaw 直连智谱 API（不需要梯子）
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

# 检查主网关是否已启动
if lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -q ":${MAIN_GATEWAY_PORT} "; then
  echo "主网关已在运行（端口 ${MAIN_GATEWAY_PORT}）"
else
  echo "启动主网关（端口 ${MAIN_GATEWAY_PORT}）..."
  # 清理可能残留的锁文件
  rm -f "$YIN_DIR"/agents/main/sessions/*.lock 2>/dev/null
  nohup node openclaw.mjs gateway </dev/null >> /tmp/yinova-main.log 2>&1 &
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
exec node openclaw.mjs tui
