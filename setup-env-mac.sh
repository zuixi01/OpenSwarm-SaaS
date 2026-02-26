#!/usr/bin/env bash
# Yinova - Mac 环境一键部署（Node.js 18+、npm）
# 用法：复制到终端执行，或保存为 setup-env-mac.sh 后执行：bash setup-env-mac.sh

set -e

echo "=== Yinova 环境检查（Mac）==="

# 仅支持 Mac
if [[ "$(uname)" != "Darwin" ]]; then
  echo "本脚本仅支持 macOS。Linux 请安装 Node.js 18+ 后执行 install.sh。"
  exit 1
fi

# 检测 Node 18+
need_install=1
if command -v node &>/dev/null; then
  ver=$(node -v 2>/dev/null | sed 's/^v//')
  major=${ver%%.*}
  if [[ -n "$major" && "$major" -ge 18 ]]; then
    echo "✓ 已安装 Node.js $(node -v)，npm $(npm -v)"
    need_install=0
  fi
fi

if [[ "$need_install" -eq 0 ]]; then
  echo ""
  echo "环境已就绪。若尚未安装 Yinova，请执行："
  echo "  git clone https://github.com/goldct/yinova && cd yinova"
  echo "  chmod +x install.sh start-panel.sh && ./install.sh"
  echo "  ./start-panel.sh"
  echo ""
  exit 0
fi

# 需要安装：先装 Homebrew，再装 Node
echo "未检测到 Node.js 18+，将自动安装（通过 Homebrew）。"
echo ""

if ! command -v brew &>/dev/null; then
  echo "正在安装 Homebrew（过程中可能提示输入本机密码）…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # 常见 Mac 上 brew 路径
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

echo "正在安装 Node.js…"
brew install node

echo ""
echo "✓ 环境部署完成：Node $(node -v)，npm $(npm -v)"
echo ""
echo "请执行以下命令安装并启动 Yinova："
echo "  git clone https://github.com/goldct/yinova && cd yinova"
echo "  chmod +x install.sh start-panel.sh && ./install.sh"
echo "  ./start-panel.sh"
echo ""
