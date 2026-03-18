#!/usr/bin/env bash
# 按 worker_id 启动 OpenClaw gateway（可选仅后台或再开 TUI）
# 用法: RUN_GATEWAY_BACKGROUND=1 ./start-worker.sh <worker_id>   # 仅后台
#       ./start-worker.sh <worker_id> tui                         # 后台起网关再开 TUI
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT_FOR_ENV="${OPENSWARM_ROOT:-$SCRIPT_DIR}"
[[ -f "${PROJECT_ROOT_FOR_ENV}/.env" ]] && source "${PROJECT_ROOT_FOR_ENV}/.env" 2>/dev/null || true
PROJECT_ROOT="${OPENSWARM_ROOT:-$SCRIPT_DIR}"
CONF="${SCRIPT_DIR}/workers.conf"
OPENCLAW_DIR="${OPENCLAW_DIR:-$PROJECT_ROOT/openclaw}"

# openclaw 2026 requires Node >=22.12; prefer Homebrew Node@22 on macOS, fallback to npx node@22.12.0.
OPENCLAW_NODE_CMD=()
BREW_NODE22="/opt/homebrew/opt/node@22/bin/node"
if [[ -x "$BREW_NODE22" ]]; then
  OPENCLAW_NODE_CMD=("$BREW_NODE22")
elif command -v node >/dev/null 2>&1; then
  NODE_MAJ=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
  NODE_MIN=$(node -p "process.versions.node.split('.')[1]" 2>/dev/null || echo 0)
  if [[ "$NODE_MAJ" -gt 22 || ( "$NODE_MAJ" -eq 22 && "$NODE_MIN" -ge 12 ) ]]; then
    OPENCLAW_NODE_CMD=(node)
  else
    OPENCLAW_NODE_CMD=(npx -y node@22.12.0)
  fi
else
  OPENCLAW_NODE_CMD=(npx -y node@22.12.0)
fi

if [[ ! -f "$CONF" ]]; then
  echo "缺少 workers.conf" >&2
  exit 1
fi

get_worker() {
  local id="$1"
  local line
  line=$(grep -E "^${id}\|" "$CONF" | head -1)
  if [[ -z "$line" ]]; then
    echo "workers.conf 中未找到 worker_id=$id" >&2
    return 1
  fi
  IFS='|' read -r _ state_dir port token <<< "$line"
  state_dir="${state_dir// }"
  port="${port// }"
  token="${token// }"
  # 相对路径则解析为绝对路径
  [[ "$state_dir" != /* ]] && state_dir="${PROJECT_ROOT}/${state_dir}"
  echo "$state_dir|$port|$token"
}

wid="${1:?用法: $0 <worker_id> [tui]}"
mode="${2:-}"
background_only=
[[ -n "${RUN_GATEWAY_BACKGROUND:-}" ]] && background_only=1

worker=$(get_worker "$wid") || exit 1
IFS='|' read -r state_dir port token <<< "$worker"

export OPENCLAW_STATE_DIR="$state_dir"
export OPENCLAW_GATEWAY_PORT="$port"
[[ -n "$token" ]] && export OPENCLAW_GATEWAY_TOKEN="$token"

# 清除代理，让 openclaw 直连智谱 API
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy

if lsof -ti ":$port" >/dev/null 2>&1; then
  if [[ "$mode" == "tui" ]]; then
    cd "$OPENCLAW_DIR" && exec "${OPENCLAW_NODE_CMD[@]}" openclaw.mjs tui
  fi
  [[ -z "$background_only" ]] && echo "端口 $port 已在运行"
  exit 0
fi

# 后台启动 gateway（使用项目内 openclaw）
(
  cd "$OPENCLAW_DIR" || exit 1
  nohup "${OPENCLAW_NODE_CMD[@]}" openclaw.mjs gateway </dev/null >> "/tmp/openswarm-worker-${wid}.log" 2>&1 &
)
sleep 2
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if lsof -ti ":$port" >/dev/null 2>&1; then
    if [[ -n "$background_only" ]]; then
      exit 0
    fi
    if [[ "$mode" == "tui" ]]; then
      cd "$OPENCLAW_DIR" && exec "${OPENCLAW_NODE_CMD[@]}" openclaw.mjs tui
    fi
    echo "网关已启动，端口 $port，日志 /tmp/openswarm-worker-${wid}.log"
    exit 0
  fi
  sleep 1
done
echo "启动超时，端口 $port 未就绪，请查看 /tmp/openswarm-worker-${wid}.log" >&2
exit 1
