#!/usr/bin/env bash
# Yinova 本机环境检测（Mac）- 缺什么会提示

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Yinova 环境检测 (Mac) ==="
echo ""

missing=0

# Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "× Node.js 未安装"
  echo "  请安装 Node.js 18 或更高版本。离线用户：双击本目录下的 node-*.pkg；有网用户可运行 setup-env-mac.sh"
  echo ""
  ((missing++))
else
  ver=$(node -v 2>/dev/null | sed 's/^v//')
  major=${ver%%.*}
  if [[ -z "$major" || "$major" -lt 18 ]]; then
    echo "× Node.js 版本过低：$(node -v)，需要 18 或更高"
    echo "  请升级 Node.js 或重新安装 node-*.pkg"
    echo ""
    ((missing++))
  else
    echo "✓ Node.js $(node -v)"
  fi
fi

# npm
if ! command -v npm >/dev/null 2>&1; then
  echo "× npm 未找到（通常随 Node 安装）"
  ((missing++))
else
  echo "✓ npm $(npm -v)"
fi

# openclaw dist
if [[ ! -f "openclaw/dist/entry.mjs" && ! -f "openclaw/dist/entry.js" ]]; then
  echo "× openclaw 缺少构建产物 (dist/entry.mjs 或 entry.js)"
  echo "  在线用户：重新运行 ./install.sh 拉取完整 openclaw"
  echo "  离线用户：将 openclaw-offline.zip 解压到本目录，覆盖 openclaw 文件夹"
  echo ""
  ((missing++))
else
  echo "✓ openclaw 已就绪"
fi

# 关键脚本
for f in install.sh start-panel.sh start-panel.command; do
  if [[ ! -f "$f" ]]; then
    echo "× 缺少脚本: $f"
    ((missing++))
  fi
done
[[ -f "install.sh" && -f "start-panel.sh" ]] && echo "✓ 关键脚本存在"

echo ""
if [[ $missing -eq 0 ]]; then
  echo ">>> 环境完整，可以运行：双击 install-offline-mac.command 初始化，然后双击 start-panel.command 启动面板。"
else
  echo ">>> 以上缺项请先补齐，再运行 install-offline-mac.command 或 ./install.sh"
fi
echo ""
read -n 1 -s -r -p "按任意键关闭本窗口..."
