#!/usr/bin/env bash
# Yinova - 首次安装
# 从 hex-template 生成 64 卦 + workers.conf

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR"
TEMPLATE="$ROOT/hex-template"

HEX_NAMES=(乾 坤 泰 否 谦 豫 随 蛊 临 观 屯 蒙 需 讼 师 比 小畜 履 同人 大有 噬嗑 贲 剥 复 无妄 大畜 颐 大过 坎 离 咸 恒 遯 大壮 晋 明夷 家人 睽 蹇 解 损 益 夬 姤 萃 升 困 井 革 鼎 震 艮 渐 归妹 丰 旅 巽 兑 涣 节 中孚 小过 既济 未济)

echo "=== Yinova 安装 ==="
echo "项目目录: $ROOT"

# 确保关键脚本可执行（clone 后可能丢失权限）
chmod +x "$ROOT/install.sh" "$ROOT/start-panel.sh" "$ROOT/start-panel.command" 2>/dev/null || true
chmod +x "$ROOT/start-worker.sh" "$ROOT/stop-worker.sh" 2>/dev/null || true
[[ -f "$ROOT/yin/start-yin.sh" ]] && chmod +x "$ROOT/yin/start-yin.sh" 2>/dev/null || true

# 移除根目录下的旧卦目录（现已改用 hexes/）
removed=0
for name in "${HEX_NAMES[@]}"; do
  [[ -d "$ROOT/$name" ]] && rm -rf "$ROOT/$name" && ((removed++))
done
[[ $removed -gt 0 ]] && echo "已移除 $removed 个旧卦目录"

if [[ ! -d "$TEMPLATE" ]]; then
  echo "错误: hex-template 不存在" >&2
  exit 1
fi

# 0. 安装 openclaw 到项目（方案 B）：优先用 npm 安装（含预构建 dist/）
OPENCLAW_DIR="$ROOT/openclaw"
OPENCLAW_REPO="https://github.com/openclaw/openclaw.git"
NODE_MAJ=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJ=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
fi
openclaw_ok() {
  [[ -f "$OPENCLAW_DIR/openclaw.mjs" ]] && { [[ -f "$OPENCLAW_DIR/dist/entry.mjs" ]] || [[ -f "$OPENCLAW_DIR/dist/entry.js" ]]; }
}
configure_openclaw_package() {
  # 部分网络环境无法拉取 baileys 的 GitHub 依赖，改用 npm 的 libsignal 包。
  if [[ -f "$OPENCLAW_DIR/package.json" ]] && command -v node >/dev/null 2>&1; then
    node -e '
      const fs=require("fs");
      const p=process.argv[1];
      const j=JSON.parse(fs.readFileSync(p,"utf8"));
      j.overrides=j.overrides||{};
      if(!j.overrides.libsignal) j.overrides.libsignal="2.0.1";
      fs.writeFileSync(p,JSON.stringify(j,null,2));
    ' "$OPENCLAW_DIR/package.json" 2>/dev/null || true
  fi
}
install_openclaw_deps() {
  if [[ "$NODE_MAJ" -lt 20 ]]; then
    # Node 18 环境：跳过安装脚本与可选依赖，避免 Node 版本硬检查阻断安装。
    (cd "$OPENCLAW_DIR" && npm install --omit=dev --omit=optional --ignore-scripts --registry=https://registry.npmjs.org --silent 2>/dev/null) || true
  else
    (cd "$OPENCLAW_DIR" && npm install --omit=dev --registry=https://registry.npmjs.org --silent 2>/dev/null) || true
  fi
}
if openclaw_ok; then
  echo "✓ openclaw 已存在且完整，跳过安装"
else
  echo "安装 openclaw..."
  rm -rf "$OPENCLAW_DIR"
  mkdir -p "$OPENCLAW_DIR"
  if (cd "$ROOT" && npm pack openclaw@latest 2>/dev/null) && ls "$ROOT"/openclaw-*.tgz 1>/dev/null 2>&1; then
    tgz="$ROOT"/openclaw-*.tgz
    tar xzf $tgz -C "$OPENCLAW_DIR" --strip-components=1
    rm -f $tgz
    configure_openclaw_package
    install_openclaw_deps
    echo "✓ openclaw 已从 npm 安装"
  elif git clone --depth 1 "$OPENCLAW_REPO" "$OPENCLAW_DIR" 2>/dev/null; then
    configure_openclaw_package
    install_openclaw_deps
    if command -v pnpm >/dev/null 2>&1; then
      (cd "$OPENCLAW_DIR" && pnpm build 2>/dev/null) || true
    else
      (cd "$OPENCLAW_DIR" && npm run build 2>/dev/null) || true
    fi
    echo "✓ openclaw 已从 git 拉取"
  fi
  if ! openclaw_ok; then
    echo "⚠ openclaw 缺少 dist/。请手动: npm install -g openclaw，或从 npm 下载解压到 openclaw/" >&2
  fi
fi

# 生成统一 token（64 卦共用）
GATEWAY_TOKEN="${YINOVA_GATEWAY_TOKEN:-$(openssl rand -hex 20 2>/dev/null || echo "yinova_local_$(date +%s)")}"

# 1. 生成 64 卦
for i in "${!HEX_NAMES[@]}"; do
  id=$((i + 1))
  name="${HEX_NAMES[$i]}"
  port=$((18790 + id))
  hex_dir="$ROOT/hexes/$name"

  mkdir -p "$hex_dir/workspace" "$hex_dir/agents/main"
  cp "$TEMPLATE/moltbot.json" "$hex_dir/"

  # 替换 placeholders
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|__YINOVA_ROOT__|$ROOT|g" "$hex_dir/moltbot.json"
    sed -i '' "s|__HEX_NAME__|$name|g" "$hex_dir/moltbot.json"
    sed -i '' "s|99999|$port|g" "$hex_dir/moltbot.json"
    sed -i '' "s|yinova_local_replace_me|$GATEWAY_TOKEN|g" "$hex_dir/moltbot.json"
  else
    sed -i "s|__YINOVA_ROOT__|$ROOT|g" "$hex_dir/moltbot.json"
    sed -i "s|__HEX_NAME__|$name|g" "$hex_dir/moltbot.json"
    sed -i "s|99999|$port|g" "$hex_dir/moltbot.json"
    sed -i "s|yinova_local_replace_me|$GATEWAY_TOKEN|g" "$hex_dir/moltbot.json"
  fi
done

# 2. 生成 workers.conf
{
  echo "# 格式: worker_id|state_dir|port|token"
  for i in "${!HEX_NAMES[@]}"; do
    id=$((i + 1))
    name="${HEX_NAMES[$i]}"
    port=$((18790 + id))
    echo "${id}|hexes/${name}|${port}|${GATEWAY_TOKEN}"
  done
} > "$ROOT/workers.conf"
echo "已生成 workers.conf"

# 3. 阴：若 moltbot.json 不存在，从 .example 自动生成
YIN_CONF="$ROOT/yin/moltbot.json"
YIN_EXAMPLE="$ROOT/yin/moltbot.json.example"
if [[ ! -f "$YIN_CONF" ]] && [[ -f "$YIN_EXAMPLE" ]]; then
  cp "$YIN_EXAMPLE" "$YIN_CONF"
  echo "已从 moltbot.json.example 生成 yin/moltbot.json"
fi
if [[ -f "$YIN_CONF" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|__YINOVA_ROOT__|$ROOT|g" "$YIN_CONF"
    sed -i '' "s|yinova_local_replace_me|$GATEWAY_TOKEN|g" "$YIN_CONF"
    sed -i '' "s|replace_with_random_secret_token|$GATEWAY_TOKEN|g" "$YIN_CONF"
  else
    sed -i "s|__YINOVA_ROOT__|$ROOT|g" "$YIN_CONF"
    sed -i "s|yinova_local_replace_me|$GATEWAY_TOKEN|g" "$YIN_CONF"
    sed -i "s|replace_with_random_secret_token|$GATEWAY_TOKEN|g" "$YIN_CONF"
  fi
  # 修正 workspace 路径（复制项目后可能指向旧目录）
  YIN_WORKSPACE="$ROOT/yin/workspace"
  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs=require("fs");
      const confPath=process.argv[1];
      const wantWorkspace=process.argv[2];
      if(!confPath||!wantWorkspace) process.exit(0);
      let j;
      try { j=JSON.parse(fs.readFileSync(confPath,"utf8")); } catch(e){ process.exit(0); }
      const ws=j.agents&&j.agents.defaults&&j.agents.defaults.workspace;
      if(ws&&ws!==wantWorkspace) {
        j.agents.defaults.workspace=wantWorkspace;
        fs.writeFileSync(confPath,JSON.stringify(j,null,2),"utf8");
        console.log("已修正 yin workspace 路径");
      }
    ' "$YIN_CONF" "$YIN_WORKSPACE" 2>/dev/null || true
  fi
  echo "已配置 yin/moltbot.json"
fi

# 4. panel-web 依赖
if [[ -d "$ROOT/panel-web" ]]; then
  (cd "$ROOT/panel-web" && npm install --silent 2>/dev/null) || true
fi

echo ""
echo "=== 安装完成 ==="
echo ""
echo "启动方式（二选一）："
echo ""
echo "  Mac 用户（推荐）："
echo "    1. 在 Finder 中打开项目文件夹（下面将自动打开）"
echo "    2. 双击 start-panel.command"
echo "    3. 约 3 秒后会自动打开浏览器"
echo ""
echo "  终端用户："
echo "    执行: ./start-panel.sh"
echo "    然后打开: http://localhost:3999"
echo ""
echo "首次使用：在配置页填写 API Key 即可。"
echo ""
# Mac 上自动打开项目文件夹，方便用户找到 start-panel.command
[[ "$(uname)" == "Darwin" ]] && open "$ROOT" 2>/dev/null || true
