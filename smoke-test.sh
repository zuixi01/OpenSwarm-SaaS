#!/bin/bash
# OpenSwarm 冒烟测试：验证 install + 面板能起
# 用法：在项目根目录执行 ./smoke-test.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/openswarm-smoke-$$"

echo "=== OpenSwarm 冒烟测试 ==="
echo "复制到 $TEST_DIR ..."

mkdir -p "$TEST_DIR"
# 复制项目，排除生成物；若本机有 openclaw、panel-web/node_modules 则一并复制（免 clone、免 npm install）
if [[ -d "$SCRIPT_DIR/openclaw" ]] && [[ -f "$SCRIPT_DIR/openclaw/openclaw.mjs" ]]; then
  EXCLUDE_OPENCLAW=""
  echo "（复制已有 openclaw，跳过拉取）"
else
  EXCLUDE_OPENCLAW="--exclude=openclaw"
fi
if [[ -d "$SCRIPT_DIR/panel-web/node_modules" ]]; then
  EXCLUDE_NODE_MODULES=""
  echo "（复制已有 panel-web/node_modules）"
else
  EXCLUDE_NODE_MODULES="--exclude=panel-web/node_modules"
fi
rsync -a --exclude=hexes --exclude=workers.conf --exclude=yin/moltbot.json $EXCLUDE_OPENCLAW $EXCLUDE_NODE_MODULES \
  --exclude=.env --exclude=config.json --exclude=.git \
  "$SCRIPT_DIR/" "$TEST_DIR/" 2>/dev/null || {
  cp -r "$SCRIPT_DIR"/* "$TEST_DIR/" 2>/dev/null || true
  [[ -n "$EXCLUDE_OPENCLAW" ]] && rm -rf "$TEST_DIR/openclaw" 2>/dev/null || true
  [[ -n "$EXCLUDE_NODE_MODULES" ]] && rm -rf "$TEST_DIR/panel-web/node_modules" 2>/dev/null || true
  rm -rf "$TEST_DIR/hexes" "$TEST_DIR/workers.conf" "$TEST_DIR/.env" "$TEST_DIR/config.json" 2>/dev/null || true
}

cd "$TEST_DIR"
echo "运行 install.sh ..."
./install.sh

echo "验证 hexes、workers.conf、yin ..."
[[ -d hexes/数据分析师 ]] || { echo "FAIL: hexes/数据分析师 不存在"; rm -rf "$TEST_DIR"; exit 1; }
[[ -f workers.conf ]] || { echo "FAIL: workers.conf 不存在"; rm -rf "$TEST_DIR"; exit 1; }
[[ -f yin/moltbot.json ]] || [[ -f yin/moltbot.json.example ]] || { echo "FAIL: yin 配置不存在"; rm -rf "$TEST_DIR"; exit 1; }
[[ -x yin/start-yin.sh ]] || { echo "FAIL: yin/start-yin.sh 不可执行"; rm -rf "$TEST_DIR"; exit 1; }

# 若无 node_modules 则安装
if [[ ! -d panel-web/node_modules/ws ]]; then
  echo "安装 panel-web 依赖 ..."
  (cd panel-web && npm install --silent 2>/dev/null) || true
fi
[[ -d panel-web/node_modules/ws ]] || { echo "FAIL: panel-web 依赖未安装（请先 cd panel-web && npm install）"; rm -rf "$TEST_DIR"; exit 1; }

echo "启动面板（5秒）..."
cd panel-web
node server.js &
PID=$!
sleep 3

echo "请求首页 ..."
if curl -s --noproxy '*' http://127.0.0.1:3999 2>/dev/null | grep -q "六十四"; then
  echo "PASS: 首页正常"
else
  echo "FAIL: 首页无「六十四」"
  kill $PID 2>/dev/null || true
  rm -rf "$TEST_DIR"
  exit 1
fi

echo "请求 /api/config ..."
CONFIG=$(curl -s --noproxy '*' http://127.0.0.1:3999/api/config 2>/dev/null)
if echo "$CONFIG" | grep -qE '"portMain"|"portHexStart"|"panelPort"'; then
  echo "PASS: /api/config 返回有效 JSON"
else
  echo "FAIL: /api/config 无效或非 JSON"
  kill $PID 2>/dev/null || true
  rm -rf "$TEST_DIR"
  exit 1
fi

echo "请求 /api/system ..."
SYS=$(curl -s --noproxy '*' http://127.0.0.1:3999/api/system 2>/dev/null)
if echo "$SYS" | grep -qE '"mem"|"cpuPct"|"cpus"'; then
  echo "PASS: /api/system 返回有效 JSON"
else
  echo "FAIL: /api/system 无效或非 JSON"
  kill $PID 2>/dev/null || true
  rm -rf "$TEST_DIR"
  exit 1
fi

echo "请求 /api/config/check-ports ..."
CHECK=$(curl -s --noproxy '*' "http://127.0.0.1:3999/api/config/check-ports?portMain=18789&portHexStart=18791&panelPort=3999" 2>/dev/null)
if echo "$CHECK" | grep -qE '"inUse"|"autoFixed"|"config"'; then
  echo "PASS: /api/config/check-ports 返回有效结果"
else
  echo "FAIL: /api/config/check-ports 无效"
  kill $PID 2>/dev/null || true
  rm -rf "$TEST_DIR"
  exit 1
fi

kill $PID 2>/dev/null || true
rm -rf "$TEST_DIR"
echo "=== 冒烟测试通过 ==="
