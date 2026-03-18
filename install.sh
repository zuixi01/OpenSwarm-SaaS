#!/usr/bin/env bash
# OpenSwarm - 首次安装
# 从 hex-template 生成 64 数字员工 + workers.conf

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR"
TEMPLATE="$ROOT/hex-template"

HEX_NAMES=(数据分析师 爬虫专家 专业客服 产品经理 前端工程师 架构师 小红书写作 小红书运营 视频剪辑大神 后端工程师 小程序开发工程师 文案助手 市场专员 金牌销售 拓客专员 电商客服 英语老师 数学老师 语文老师 物理老师 化学老师 地理老师 历史老师 生物老师 科学老师 投流运营专员 视频下载助手 股票分析大师 商务 
市场情报员 内容创作者 投资研究 财务审计员 战略策划师 AI训练师 安全审计 算法工程师 视觉设计师 法务合规官  供应链专员 DevOps工程师 用户体验研究员 知识管理师 售前咨询专员 售中跟进专员 售后处理专员 投诉升级专员 产品知识专家 物流协调专员 支付风控专员 客服质检专员 数据分析师（客服方向） 客服主管/组 商业战略顾问 财务规划顾问 职业规划顾问 技术架构顾问 品牌策划顾问 健康管理顾问  教育规划顾问 法律合规顾问 数字化转型顾问 心理情绪顾问 职场顾问)

echo "=== OpenSwarm 安装 ==="
echo "项目目录: $ROOT"

# 确保关键脚本可执行（clone 后可能丢失权限）
chmod +x "$ROOT/install.sh" "$ROOT/start-panel.sh" "$ROOT/start-panel.command" 2>/dev/null || true
chmod +x "$ROOT/start-worker.sh" "$ROOT/stop-worker.sh" 2>/dev/null || true
[[ -f "$ROOT/yin/start-yin.sh" ]] && chmod +x "$ROOT/yin/start-yin.sh" 2>/dev/null || true

# 移除根目录下的旧员工目录（现已改用 hexes/）
removed=0
for name in "${HEX_NAMES[@]}"; do
  [[ -d "$ROOT/$name" ]] && rm -rf "$ROOT/$name" && ((removed++))
done
[[ $removed -gt 0 ]] && echo "已移除 $removed 个旧员工目录"

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

# 生成统一 token（64 数字员工共用）
GATEWAY_TOKEN="${OPENSWARM_GATEWAY_TOKEN:-$(openssl rand -hex 20 2>/dev/null || echo "openswarm_local_$(date +%s)")}"

# 1. 生成 64 数字员工
for i in "${!HEX_NAMES[@]}"; do
  id=$((i + 1))
  name="${HEX_NAMES[$i]}"
  port=$((18790 + id))
  hex_dir="$ROOT/hexes/$name"

  mkdir -p "$hex_dir/workspace" "$hex_dir/agents/main"
  cp "$TEMPLATE/moltbot.json" "$hex_dir/"

  # 替换 placeholders
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|__OPENSWARM_ROOT__|$ROOT|g" "$hex_dir/moltbot.json"
    sed -i '' "s|__HEX_NAME__|$name|g" "$hex_dir/moltbot.json"
    sed -i '' "s|99999|$port|g" "$hex_dir/moltbot.json"
    sed -i '' "s|openswarm_local_replace_me|$GATEWAY_TOKEN|g" "$hex_dir/moltbot.json"
  else
    sed -i "s|__OPENSWARM_ROOT__|$ROOT|g" "$hex_dir/moltbot.json"
    sed -i "s|__HEX_NAME__|$name|g" "$hex_dir/moltbot.json"
    sed -i "s|99999|$port|g" "$hex_dir/moltbot.json"
    sed -i "s|openswarm_local_replace_me|$GATEWAY_TOKEN|g" "$hex_dir/moltbot.json"
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

# 3. 主控：若 moltbot.json 不存在，从 .example 自动生成
YIN_CONF="$ROOT/yin/moltbot.json"
YIN_EXAMPLE="$ROOT/yin/moltbot.json.example"
if [[ ! -f "$YIN_CONF" ]] && [[ -f "$YIN_EXAMPLE" ]]; then
  cp "$YIN_EXAMPLE" "$YIN_CONF"
  echo "已从 moltbot.json.example 生成 yin/moltbot.json"
fi
if [[ -f "$YIN_CONF" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|__OPENSWARM_ROOT__|$ROOT|g" "$YIN_CONF"
    sed -i '' "s|openswarm_local_replace_me|$GATEWAY_TOKEN|g" "$YIN_CONF"
    sed -i '' "s|replace_with_random_secret_token|$GATEWAY_TOKEN|g" "$YIN_CONF"
  else
    sed -i "s|__OPENSWARM_ROOT__|$ROOT|g" "$YIN_CONF"
    sed -i "s|openswarm_local_replace_me|$GATEWAY_TOKEN|g" "$YIN_CONF"
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
