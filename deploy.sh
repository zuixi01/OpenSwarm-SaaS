#!/usr/bin/env bash
# OpenSwarm 云服务器一键部署脚本（Ubuntu/Debian/Alibaba Cloud Linux/RHEL-like）
# 用法示例：
#   bash ./deploy.sh --domain your-domain.com
# 可选参数：
#   --domain <域名>                 默认 localhost
#   --panel-port <端口>             默认 3999
#   --db-name <数据库名>            默认 openswarm
#   --db-user <数据库用户>          默认 openswarm
#   --db-password <数据库密码>      默认自动生成
#   --bootstrap-email <登录邮箱>    默认 admin@example.com
#   --bootstrap-password <登录密码> 默认自动生成
#   --jwt-secret <JWT密钥>          默认自动生成
#   --refresh-secret <刷新密钥>     默认自动生成
#   --public-base-url <公开地址>    默认根据 domain 推导
#   --public-scheme <http|https>   默认 localhost 用 http，域名用 https
#   --google-client-id <Google OAuth Client ID>
#   --google-client-secret <Google OAuth Client Secret>
#   --runtime-mode <local|k8s>      默认 local
#   --skip-install                  跳过系统依赖安装
#   --skip-openclaw-setup           跳过执行 ./install.sh
#   --no-nginx                      不配置 Nginx

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="$PROJECT_ROOT/panel-web"

DOMAIN="localhost"
PANEL_PORT="3999"
DB_NAME="openswarm"
DB_USER="openswarm"
DB_PASSWORD=""
BOOTSTRAP_EMAIL="admin@example.com"
BOOTSTRAP_PASSWORD=""
JWT_SECRET=""
REFRESH_SECRET=""
PUBLIC_BASE_URL=""
PUBLIC_SCHEME=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
RUNTIME_MODE="local"
SKIP_INSTALL="0"
SKIP_OPENCLAW_SETUP="0"
ENABLE_NGINX="1"

ENV_FILE="/etc/openswarm/panel.env"
SERVICE_FILE="/etc/systemd/system/openswarm-panel.service"
NGINX_SITE="/etc/nginx/sites-available/openswarm"
NGINX_LINK="/etc/nginx/sites-enabled/openswarm"

log() { printf '[deploy] %s\n' "$*"; }
err() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

detect_pkg_manager() {
  if command -v apt >/dev/null 2>&1; then
    echo "apt"
    return
  fi
  if command -v dnf >/dev/null 2>&1; then
    echo "dnf"
    return
  fi
  if command -v yum >/dev/null 2>&1; then
    echo "yum"
    return
  fi
  echo ""
}

install_system_packages() {
  local pm="$1"
  case "$pm" in
    apt)
      $SUDO apt update
      $SUDO apt install -y git curl build-essential nginx postgresql postgresql-contrib ca-certificates gnupg
      if ! command -v node >/dev/null 2>&1; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
        $SUDO apt install -y nodejs
      fi
      ;;
    dnf|yum)
      $SUDO "$pm" makecache -y
      $SUDO "$pm" install -y git curl gcc gcc-c++ make nginx postgresql postgresql-server postgresql-contrib ca-certificates gnupg2
      if ! command -v node >/dev/null 2>&1; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
        $SUDO "$pm" install -y nodejs
      fi
      if command -v postgresql-setup >/dev/null 2>&1 && [[ ! -f /var/lib/pgsql/data/PG_VERSION ]]; then
        $SUDO postgresql-setup --initdb
      fi
      $SUDO systemctl enable --now postgresql || true
      ;;
    *)
      err "不支持的包管理器，请手工安装依赖：git curl nginx postgresql nodejs"
      ;;
  esac
}

detect_nginx_layout() {
  if [[ -d /etc/nginx/sites-available && -d /etc/nginx/sites-enabled ]]; then
    NGINX_SITE="/etc/nginx/sites-available/openswarm"
    NGINX_LINK="/etc/nginx/sites-enabled/openswarm"
    return
  fi
  if [[ -d /etc/nginx/conf.d ]]; then
    NGINX_SITE="/etc/nginx/conf.d/openswarm.conf"
    NGINX_LINK=""
    return
  fi
}

configure_postgres_auth() {
  local pg_hba=""
  local pg_conf=""

  for candidate in \
    /var/lib/pgsql/data/pg_hba.conf \
    /var/lib/pgsql/13/data/pg_hba.conf
  do
    if [[ -f "$candidate" ]]; then
      pg_hba="$candidate"
      break
    fi
  done

  for candidate in \
    /var/lib/pgsql/data/postgresql.conf \
    /var/lib/pgsql/13/data/postgresql.conf
  do
    if [[ -f "$candidate" ]]; then
      pg_conf="$candidate"
      break
    fi
  done

  [[ -n "$pg_hba" ]] || err "未找到 pg_hba.conf，无法自动配置 PostgreSQL 本地认证"
  [[ -n "$pg_conf" ]] || err "未找到 postgresql.conf，无法自动配置 PostgreSQL 监听地址"

  local tmp_hba
  tmp_hba="$(mktemp)"
  awk '
    BEGIN { local_done=0; ipv4_done=0; ipv6_done=0 }
    /^[[:space:]]*local[[:space:]]+all[[:space:]]+all[[:space:]]+(peer|ident|trust|scram-sha-256|md5)[[:space:]]*$/ {
      if (!local_done) {
        print "local   all             all                                     md5"
        local_done=1
      }
      next
    }
    /^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1\/32[[:space:]]+(peer|ident|trust|scram-sha-256|md5)[[:space:]]*$/ {
      if (!ipv4_done) {
        print "host    all             all             127.0.0.1/32            md5"
        ipv4_done=1
      }
      next
    }
    /^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+::1\/128[[:space:]]+(peer|ident|trust|scram-sha-256|md5)[[:space:]]*$/ {
      if (!ipv6_done) {
        print "host    all             all             ::1/128                 md5"
        ipv6_done=1
      }
      next
    }
    { print }
    END {
      if (!local_done) print "local   all             all                                     md5"
      if (!ipv4_done) print "host    all             all             127.0.0.1/32            md5"
      if (!ipv6_done) print "host    all             all             ::1/128                 md5"
    }
  ' "$pg_hba" > "$tmp_hba"
  $SUDO cp "$tmp_hba" "$pg_hba"
  rm -f "$tmp_hba"

  if grep -q "^[#[:space:]]*listen_addresses[[:space:]]*=" "$pg_conf"; then
    $SUDO sed -i "s/^[#[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '127.0.0.1,localhost'/" "$pg_conf"
  else
    echo "listen_addresses = '127.0.0.1,localhost'" | $SUDO tee -a "$pg_conf" >/dev/null
  fi

  $SUDO systemctl restart postgresql
}

rand_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    head -c $(( "$1" * 2 )) /dev/urandom | xxd -p -c 256
  fi
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || err "缺少命令: $1"
}

is_root() {
  [[ "$(id -u)" -eq 0 ]]
}

SUDO=""
if ! is_root; then
  need_cmd sudo
  SUDO="sudo"
fi

run_as_postgres() {
  if is_root; then
    su - postgres -c "$1"
  else
    sudo -u postgres bash -lc "$1"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --panel-port) PANEL_PORT="${2:-}"; shift 2 ;;
    --db-name) DB_NAME="${2:-}"; shift 2 ;;
    --db-user) DB_USER="${2:-}"; shift 2 ;;
    --db-password) DB_PASSWORD="${2:-}"; shift 2 ;;
    --bootstrap-email) BOOTSTRAP_EMAIL="${2:-}"; shift 2 ;;
    --bootstrap-password) BOOTSTRAP_PASSWORD="${2:-}"; shift 2 ;;
    --jwt-secret) JWT_SECRET="${2:-}"; shift 2 ;;
    --refresh-secret) REFRESH_SECRET="${2:-}"; shift 2 ;;
    --public-base-url) PUBLIC_BASE_URL="${2:-}"; shift 2 ;;
    --public-scheme) PUBLIC_SCHEME="${2:-}"; shift 2 ;;
    --google-client-id) GOOGLE_CLIENT_ID="${2:-}"; shift 2 ;;
    --google-client-secret) GOOGLE_CLIENT_SECRET="${2:-}"; shift 2 ;;
    --runtime-mode) RUNTIME_MODE="${2:-}"; shift 2 ;;
    --skip-install) SKIP_INSTALL="1"; shift ;;
    --skip-openclaw-setup) SKIP_OPENCLAW_SETUP="1"; shift ;;
    --no-nginx) ENABLE_NGINX="0"; shift ;;
    *) err "未知参数: $1" ;;
  esac
done

[[ -d "$PANEL_DIR" ]] || err "未找到目录: $PANEL_DIR"
[[ "$RUNTIME_MODE" == "local" || "$RUNTIME_MODE" == "k8s" ]] || err "--runtime-mode 仅支持 local|k8s"
[[ "$PANEL_PORT" =~ ^[0-9]+$ ]] || err "--panel-port 必须是数字"
[[ "$DB_NAME" =~ ^[a-zA-Z0-9_]+$ ]] || err "--db-name 仅支持字母数字下划线"
[[ "$DB_USER" =~ ^[a-zA-Z0-9_]+$ ]] || err "--db-user 仅支持字母数字下划线"

if [[ -z "$DB_PASSWORD" ]]; then DB_PASSWORD="$(rand_hex 16)"; fi
if [[ -z "$BOOTSTRAP_PASSWORD" ]]; then BOOTSTRAP_PASSWORD="$(rand_hex 12)"; fi
if [[ -z "$JWT_SECRET" ]]; then JWT_SECRET="$(rand_hex 32)"; fi
if [[ -z "$REFRESH_SECRET" ]]; then REFRESH_SECRET="$(rand_hex 32)"; fi
if [[ -z "$PUBLIC_SCHEME" ]]; then
  if [[ "$DOMAIN" == "localhost" ]]; then
    PUBLIC_SCHEME="http"
  else
    PUBLIC_SCHEME="https"
  fi
fi
[[ "$PUBLIC_SCHEME" == "http" || "$PUBLIC_SCHEME" == "https" ]] || err "--public-scheme 仅支持 http|https"
if [[ -z "$PUBLIC_BASE_URL" ]]; then
  if [[ "$DOMAIN" == "localhost" ]]; then
    PUBLIC_BASE_URL="http://localhost:${PANEL_PORT}"
  else
    PUBLIC_BASE_URL="${PUBLIC_SCHEME}://${DOMAIN}"
  fi
fi
GOOGLE_REDIRECT_URI="${PUBLIC_BASE_URL%/}/api/auth/google/callback"
COOKIE_SECURE="0"
if [[ "$PUBLIC_SCHEME" == "https" ]]; then COOKIE_SECURE="1"; fi

if [[ "$SKIP_INSTALL" != "1" ]]; then
  PKG_MANAGER="$(detect_pkg_manager)"
  [[ -n "$PKG_MANAGER" ]] || err "未检测到 apt/dnf/yum，请手工安装系统依赖后重试"
  log "安装系统依赖（git/curl/nginx/postgresql/nodejs），包管理器: ${PKG_MANAGER}"
  install_system_packages "$PKG_MANAGER"
fi

need_cmd node
need_cmd npm
need_cmd psql

if [[ "$SKIP_OPENCLAW_SETUP" != "1" ]]; then
  [[ -f "$PROJECT_ROOT/install.sh" ]] || err "未找到 install.sh: $PROJECT_ROOT/install.sh"
  log "执行 install.sh（先安装 openclaw 并初始化 yin/hexes/workers）..."
  (cd "$PROJECT_ROOT" && bash ./install.sh)
fi

log "安装 panel-web 依赖..."
cd "$PANEL_DIR"
npm install

log "初始化 PostgreSQL 用户与数据库..."
DB_PASS_ESCAPED="${DB_PASSWORD//\'/\'\'}"
run_as_postgres "psql <<'SQL'
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS_ESCAPED}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS_ESCAPED}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL
"

log "配置 PostgreSQL 本地密码认证..."
configure_postgres_auth

SERVICE_USER="${SUDO_USER:-$USER}"
$SUDO mkdir -p /etc/openswarm

log "写入环境文件: $ENV_FILE"
TMP_ENV="$(mktemp)"
cat > "$TMP_ENV" <<ENV
NODE_ENV=production
PANEL_WEB_PORT=${PANEL_PORT}
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}
DATABASE_SSLMODE=disable
OPENSWARM_PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
OPENSWARM_REQUIRE_USER_AUTH=1
OPENSWARM_AUTH_JWT_SECRET=${JWT_SECRET}
OPENSWARM_AUTH_REFRESH_SECRET=${REFRESH_SECRET}
OPENSWARM_AUTH_COOKIE_SECURE=${COOKIE_SECURE}
OPENSWARM_V1_JWT_SECRET=${JWT_SECRET}
OPENSWARM_V1_BOOTSTRAP_EMAIL=${BOOTSTRAP_EMAIL}
OPENSWARM_V1_BOOTSTRAP_PASSWORD=${BOOTSTRAP_PASSWORD}
GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_OAUTH_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_OAUTH_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
OPENSWARM_RUNTIME_MODE=${RUNTIME_MODE}
ENV
$SUDO cp "$TMP_ENV" "$ENV_FILE"
$SUDO chmod 600 "$ENV_FILE"
rm -f "$TMP_ENV"

log "执行数据库迁移与 OpenAPI 校验..."
export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
export OPENSWARM_REQUIRE_USER_AUTH="1"
export OPENSWARM_AUTH_JWT_SECRET="$JWT_SECRET"
export OPENSWARM_AUTH_REFRESH_SECRET="$REFRESH_SECRET"
export OPENSWARM_PUBLIC_BASE_URL="$PUBLIC_BASE_URL"
export GOOGLE_OAUTH_CLIENT_ID="$GOOGLE_CLIENT_ID"
export GOOGLE_OAUTH_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
export GOOGLE_OAUTH_REDIRECT_URI="$GOOGLE_REDIRECT_URI"
export OPENSWARM_V1_JWT_SECRET="$JWT_SECRET"
export OPENSWARM_V1_BOOTSTRAP_EMAIL="$BOOTSTRAP_EMAIL"
export OPENSWARM_V1_BOOTSTRAP_PASSWORD="$BOOTSTRAP_PASSWORD"
export OPENSWARM_RUNTIME_MODE="$RUNTIME_MODE"
npm run db:migrate:phase1
npm run db:migrate:phase2
npm run db:migrate:phase3
npm run seed:phase1
npm run openapi:check

log "写入 systemd 服务: $SERVICE_FILE"
TMP_SERVICE="$(mktemp)"
cat > "$TMP_SERVICE" <<SERVICE
[Unit]
Description=OpenSwarm Panel Web
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=${PANEL_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${PANEL_DIR}/server.js
Restart=always
RestartSec=3
KillMode=process
User=${SERVICE_USER}

[Install]
WantedBy=multi-user.target
SERVICE
$SUDO cp "$TMP_SERVICE" "$SERVICE_FILE"
rm -f "$TMP_SERVICE"

$SUDO systemctl daemon-reload
$SUDO systemctl enable --now openswarm-panel
$SUDO systemctl restart openswarm-panel
$SUDO systemctl --no-pager --full status openswarm-panel || true

if [[ "$ENABLE_NGINX" == "1" ]]; then
  log "配置 Nginx 反向代理..."
  detect_nginx_layout
  TMP_NGINX="$(mktemp)"
  cat > "$TMP_NGINX" <<NGINX
server {
  listen 80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:${PANEL_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
NGINX
  $SUDO cp "$TMP_NGINX" "$NGINX_SITE"
  rm -f "$TMP_NGINX"
  if [[ -n "$NGINX_LINK" ]]; then
    $SUDO mkdir -p "$(dirname "$NGINX_LINK")"
    $SUDO ln -sf "$NGINX_SITE" "$NGINX_LINK"
  fi
  $SUDO nginx -t
  $SUDO systemctl reload nginx
fi

log "部署完成。"
echo ""
echo "================ 部署信息 ================"
echo "Panel URL: ${PUBLIC_BASE_URL}"
echo "Health URL: ${PUBLIC_BASE_URL%/}/api/health"
echo "Bootstrap Email: ${BOOTSTRAP_EMAIL}"
echo "Bootstrap Password: ${BOOTSTRAP_PASSWORD}"
echo "Database: postgres://${DB_USER}:***@127.0.0.1:5432/${DB_NAME}"
echo "Runtime Mode: ${RUNTIME_MODE}"
echo "Public Base URL: ${PUBLIC_BASE_URL}"
echo "Cookie Secure: ${COOKIE_SECURE}"
if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
echo "Google OAuth Redirect URI: ${GOOGLE_REDIRECT_URI}"
else
echo "Google OAuth: not configured"
fi
echo "========================================="
echo ""
echo "建议立即备份这些密钥，并在生产环境替换为你自己的强密码。"
