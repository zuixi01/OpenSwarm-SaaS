#!/usr/bin/env bash
# One-click launcher for Codex "Run Operation"
# Starts:
#  - panel-web on 3999
#  - main gateway on 18789
#
# NOTE:
# In some Codex run environments, child processes are reaped after command exit.
# On macOS we default to Terminal.app detached launch.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="$ROOT_DIR/panel-web"
OPENCLAW_DIR="$ROOT_DIR/openclaw"
YIN_DIR="$ROOT_DIR/yin"

PANEL_PORT="${PANEL_WEB_PORT:-3999}"
MAIN_PORT="${MAIN_GATEWAY_PORT:-18789}"

PANEL_LOG="/tmp/panel-web.log"
MAIN_LOG="/tmp/openswarm-main.log"
LAUNCH_MODE="${OPENSWARM_LAUNCH_MODE:-auto}" # auto|terminal|nohup|launchctl
AGENT_DIR="$HOME/Library/LaunchAgents"
PANEL_LABEL="com.openswarm.panel"
MAIN_LABEL="com.openswarm.main"
PANEL_PLIST="$AGENT_DIR/$PANEL_LABEL.plist"
MAIN_PLIST="$AGENT_DIR/$MAIN_LABEL.plist"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令: $1"
    exit 1
  fi
}

need_cmd lsof
need_cmd node

is_listening() {
  local port="$1"
  lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -q ":${port} "
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

resolve_openclaw_node() {
  local maj min
  maj="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  min="$(node -p "process.versions.node.split('.')[1]" 2>/dev/null || echo 0)"

  if [[ "$maj" -gt 22 || ( "$maj" -eq 22 && "$min" -ge 12 ) ]]; then
    echo "node"
    return 0
  fi

  local cached
  cached="$(find "$HOME/.npm/_npx" -type f -path '*/node_modules/node/bin/node' 2>/dev/null | head -n 1 || true)"
  if [[ -n "$cached" ]]; then
    echo "$cached"
    return 0
  fi

  # fallback; may download if missing
  echo "npx -y node@22.12.0"
}

start_panel() {
  echo "启动 panel-web (:${PANEL_PORT})..."
  if [[ "$LAUNCH_MODE" == "launchctl" ]]; then
    mkdir -p "$AGENT_DIR"
    cat >"$PANEL_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$PANEL_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT_DIR/scripts/run-panel-web.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$PANEL_LOG</string>
  <key>StandardErrorPath</key><string>$PANEL_LOG</string>
</dict>
</plist>
PLIST
    launchctl bootout "gui/$(id -u)/$PANEL_LABEL" >/dev/null 2>&1 || true
    kill_port "$PANEL_PORT"
    if ! launchctl bootstrap "gui/$(id -u)" "$PANEL_PLIST"; then
      echo "launchctl 启动 panel 失败，回退 nohup..."
      (
        cd "$PANEL_DIR"
        nohup node server.js </dev/null >"$PANEL_LOG" 2>&1 &
      )
    fi
    launchctl kickstart -k "gui/$(id -u)/$PANEL_LABEL" >/dev/null 2>&1 || true
  elif [[ "$LAUNCH_MODE" == "terminal" || ( "$LAUNCH_MODE" == "auto" && "$(uname)" == "Darwin" ) ]]; then
    if ! osascript >/dev/null <<OSA
tell application "Terminal"
  do script "cd \"$ROOT_DIR\"; set -a; [ -f .env ] && source .env; set +a; cd \"$PANEL_DIR\"; exec node server.js >> \"$PANEL_LOG\" 2>&1"
  activate
end tell
OSA
    then
      echo "Terminal 启动 panel 失败，回退 nohup..."
      (
        cd "$PANEL_DIR"
        nohup node server.js </dev/null >"$PANEL_LOG" 2>&1 &
      )
    fi
  else
    kill_port "$PANEL_PORT"
    (
      cd "$PANEL_DIR"
      nohup node server.js </dev/null >"$PANEL_LOG" 2>&1 &
    )
  fi

  for _ in {1..15}; do
    if is_listening "$PANEL_PORT"; then
      echo "panel-web 已就绪: http://localhost:${PANEL_PORT}"
      return 0
    fi
    sleep 1
  done

  echo "panel-web 启动失败，请查看日志: $PANEL_LOG"
  return 1
}

start_main_gateway() {
  echo "启动主控网关 (:${MAIN_PORT})..."
  if [[ "$LAUNCH_MODE" == "launchctl" ]]; then
    mkdir -p "$AGENT_DIR"
    cat >"$MAIN_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$MAIN_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$ROOT_DIR/scripts/run-main-gateway.sh</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$MAIN_LOG</string>
  <key>StandardErrorPath</key><string>$MAIN_LOG</string>
</dict>
</plist>
PLIST
    launchctl bootout "gui/$(id -u)/$MAIN_LABEL" >/dev/null 2>&1 || true
    kill_port "$MAIN_PORT"
    if ! launchctl bootstrap "gui/$(id -u)" "$MAIN_PLIST"; then
      echo "launchctl 启动主控失败，回退 nohup..."
      local node_cmd
      node_cmd="$(resolve_openclaw_node)"
      (
        cd "$OPENCLAW_DIR"
        export OPENCLAW_STATE_DIR="$YIN_DIR"
        export OPENCLAW_GATEWAY_PORT="$MAIN_PORT"
        export OPENSWARM_ROOT="$ROOT_DIR"
        unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
        nohup bash -lc "$node_cmd openclaw.mjs gateway" </dev/null >"$MAIN_LOG" 2>&1 &
      )
    fi
    launchctl kickstart -k "gui/$(id -u)/$MAIN_LABEL" >/dev/null 2>&1 || true
  elif [[ "$LAUNCH_MODE" == "terminal" || ( "$LAUNCH_MODE" == "auto" && "$(uname)" == "Darwin" ) ]]; then
    local node_cmd
    node_cmd="$(resolve_openclaw_node)"
    if ! osascript >/dev/null <<OSA
tell application "Terminal"
  do script "cd \"$ROOT_DIR\"; set -a; [ -f .env ] && source .env; set +a; cd \"$OPENCLAW_DIR\"; export OPENCLAW_STATE_DIR=\"$YIN_DIR\" OPENCLAW_GATEWAY_PORT=\"$MAIN_PORT\" OPENSWARM_ROOT=\"$ROOT_DIR\"; unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy; exec bash -lc '$node_cmd openclaw.mjs gateway' >> \"$MAIN_LOG\" 2>&1"
  activate
end tell
OSA
    then
      echo "Terminal 启动主控失败，回退 nohup..."
      (
        cd "$OPENCLAW_DIR"
        export OPENCLAW_STATE_DIR="$YIN_DIR"
        export OPENCLAW_GATEWAY_PORT="$MAIN_PORT"
        export OPENSWARM_ROOT="$ROOT_DIR"
        unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
        nohup bash -lc "$node_cmd openclaw.mjs gateway" </dev/null >"$MAIN_LOG" 2>&1 &
      )
    fi
  else
    kill_port "$MAIN_PORT"
    local node_cmd
    node_cmd="$(resolve_openclaw_node)"
    (
      cd "$OPENCLAW_DIR"
      export OPENCLAW_STATE_DIR="$YIN_DIR"
      export OPENCLAW_GATEWAY_PORT="$MAIN_PORT"
      export OPENSWARM_ROOT="$ROOT_DIR"
      unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy
      nohup bash -lc "$node_cmd openclaw.mjs gateway" </dev/null >"$MAIN_LOG" 2>&1 &
    )
  fi

  for _ in {1..20}; do
    if is_listening "$MAIN_PORT"; then
      echo "主控网关已就绪: ws://127.0.0.1:${MAIN_PORT}"
      return 0
    fi
    sleep 1
  done

  echo "主控网关启动失败，请查看日志: $MAIN_LOG"
  return 1
}

echo "== OpenSwarm Codex 一键启动 =="
start_panel
start_main_gateway

echo ""
echo "启动完成"
echo "面板: http://localhost:${PANEL_PORT}"
echo "主控: ws://127.0.0.1:${MAIN_PORT}"
echo "日志: $PANEL_LOG / $MAIN_LOG"
