#!/usr/bin/env bash
# OpenSwarm 完整控制面板：主(主控) + 易经 64 数字员工（数据分析师～职场顾问）
# 用法: ./panel-full.sh [status|start|stop|tui] [id]
#   id: 主|1|2|...|64  其中 主=主控(18789)，1～64=数据分析师～职场顾问

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${OPENSWARM_ROOT:-$SCRIPT_DIR}"
CONF="${SCRIPT_DIR}/workers.conf"
OPENCLAW_DIR="${OPENCLAW_DIR:-$PROJECT_ROOT/openclaw}"
YIN_DIR="$PROJECT_ROOT/yin"

PORT_MAIN=18789

status_port() {
  local port=$1
  if lsof -ti ":$port" >/dev/null 2>&1; then echo "运行中"; else echo "未运行"; fi
}

print_status() {
  local st_main
  st_main=$(status_port "$PORT_MAIN")
  echo "========== 主控（主网关）=========="
  printf "  %-6s  %-5s  %s\n" "主" "$PORT_MAIN" "$st_main"
  echo ""
  echo "========== 64 数字员工 (数据分析师～职场顾问) =========="
  echo "id  | 员工名   | port  | 状态"
  echo "----|--------|-------|----------"
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    IFS='|' read -r id state_dir port _ <<< "$line"
    port="${port// }"
    name=$(basename "$state_dir")
    st=$(status_port "$port")
    printf "%2s   | %-6s | %-5s | %s\n" "$id" "$name" "$port" "$st"
  done < "$CONF"
}

start_main_yin() {
  if [[ ! -f "$OPENCLAW_DIR/openclaw.mjs" ]]; then
    echo "openclaw 不存在，请先运行 ./install.sh"
    return 1
  fi
  if lsof -ti ":$PORT_MAIN" >/dev/null 2>&1; then
    echo "主(18789) 已在运行"
    return 0
  fi
  ( cd "$OPENCLAW_DIR" && \
    export OPENCLAW_STATE_DIR="$YIN_DIR" OPENCLAW_GATEWAY_PORT=$PORT_MAIN && \
    nohup node openclaw.mjs gateway </dev/null >> /tmp/openswarm-main.log 2>&1 & )
  sleep 2
  if lsof -ti ":$PORT_MAIN" >/dev/null 2>&1; then
    echo "主(主控) 已启动，端口 $PORT_MAIN，日志 /tmp/openswarm-main.log"
  else
    echo "启动失败，请查看 /tmp/openswarm-main.log"
    return 1
  fi
}

do_start() {
  local id="$1"
  if [[ -z "$id" ]]; then
    echo "用法: $0 start <id>  其中 id = 主|1～64 (数据分析师～职场顾问)"
    echo "  主 = 主控网关(18789)。"
    return 1
  fi
  if [[ "$id" == "主" || "$id" == "main" ]]; then
    start_main_yin
    return $?
  fi
  RUN_GATEWAY_BACKGROUND=1 "$SCRIPT_DIR/start-worker.sh" "$id"
}

do_stop() {
  local id="$1"
  if [[ -z "$id" ]]; then
    echo "用法: $0 stop <id>  其中 id = 主|1|2|...|64"
    return 1
  fi
  if [[ "$id" == "主" ]]; then
    "$SCRIPT_DIR/stop-worker.sh" --port "$PORT_MAIN"
    return 0
  fi
  "$SCRIPT_DIR/stop-worker.sh" "$id"
}

do_tui() {
  local id="$1"
  if [[ -z "$id" || "$id" == "主" ]]; then
    echo "用法: $0 tui <id>  其中 id = 1～64 (数据分析师～职场顾问)"
    return 1
  fi
  "$SCRIPT_DIR/start-worker.sh" "$id" tui
}

action="${1:-status}"
arg="${2:-}"

case "$action" in
  status)
    if [[ ! -f "$CONF" ]]; then
      echo "缺少 workers.conf"
      exit 1
    fi
    print_status
    ;;
  start)
    if [[ ! -f "$CONF" ]]; then exit 1; fi
    do_start "$arg"
    ;;
  stop)
    if [[ ! -f "$CONF" ]]; then exit 1; fi
    do_stop "$arg"
    ;;
  tui)
    if [[ ! -f "$CONF" ]]; then exit 1; fi
    do_tui "$arg"
    ;;
  *)
    echo "用法: $0 [status|start|stop|tui] [id]"
    echo "  status       查看主(主控)+64 数字员工状态（默认）"
    echo "  start <id>   启动 id=主(主控)|1～64(数据分析师～职场顾问)"
    echo "  stop <id>    停止 id=主|1～64"
    echo "  tui <id>     启动并开 TUI，id=1～64 (数据分析师～职场顾问)"
    exit 1
    ;;
esac
