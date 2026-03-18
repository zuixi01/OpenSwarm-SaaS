#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== OpenSwarm Offline Setup (Mac) ==="

# 1. 检查 Node 是否已安装
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "× Node.js 未安装。"
  echo "请先双击本目录下的 node-*.pkg 安装 Node.js，再双击运行本脚本。"
  read -n 1 -s -r -p "按任意键退出..."
  exit 1
fi

echo "✓ 检测到 Node.js $(node -v)"

# 2. 确保关键脚本可执行
chmod +x install.sh start-panel.sh start-panel.command 2>/dev/null || true
chmod +x start-worker.sh stop-worker.sh 2>/dev/null || true
[ -f "yin/start-yin.sh" ] && chmod +x yin/start-yin.sh 2>/dev/null || true

# 3. 运行一次安装脚本
echo
echo ">>> 正在执行 ./install.sh（首次初始化，稍等片刻）..."
./install.sh

echo
echo "=== 离线安装完成 ==="
echo "接下来可以这样启动面板："
echo "  方式一：双击 start-panel.command（推荐 Mac 用户）"
echo "  方式二：在终端中运行："
echo "           cd \"${SCRIPT_DIR}\""
echo "           ./start-panel.sh"
echo
echo "面板启动后，浏览器打开：http://localhost:3999"
echo "首次使用：在配置页填写 API Key 即可。"
read -n 1 -s -r -p "按任意键关闭本窗口..."

