# OpenSwarm SaaS Google OAuth 配置

Google 登录为可选功能，依赖当前 SaaS 认证链与 PostgreSQL。先在开发环境验证注册、登录和数据库迁移，再配置对外服务。

## 1. 创建 OAuth Client

在 [Google Cloud Console](https://console.cloud.google.com/) 的 APIs & Services → Credentials 中创建 OAuth client ID，应用类型选择 **Web application**。按 Google 当前要求配置 consent screen 与测试用户。

配置 JavaScript origin 和回调地址。开发环境示例：

- Origin：`http://localhost:3999`
- Redirect URI：`http://localhost:3999/api/auth/google/callback`

生产环境将两者替换为实际 HTTPS 域名，例如：

- Origin：`https://your-domain.example.com`
- Redirect URI：`https://your-domain.example.com/api/auth/google/callback`

回调地址需与环境变量完全一致。

## 2. 配置根目录环境文件

将以下占位配置写入**仓库根目录的 `.env`**，不要放入 `panel-web/.env`，不要提交实际凭据：

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/openswarm
DATABASE_SSLMODE=disable
OPENSWARM_REQUIRE_USER_AUTH=1
OPENSWARM_AUTH_JWT_SECRET=replace-with-an-independent-random-secret
OPENSWARM_AUTH_REFRESH_SECRET=replace-with-another-independent-random-secret
OPENSWARM_AUTH_COOKIE_SECURE=0
OPENSWARM_PUBLIC_BASE_URL=http://localhost:3999
GOOGLE_OAUTH_CLIENT_ID=replace-with-your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=replace-with-your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3999/api/auth/google/callback
```

此处 `COOKIE_SECURE=0` 仅适用于本地 HTTP。公网 HTTPS 部署必须设为 `1`；数据库连接和 TLS 设置按自己的数据库要求配置。分别生成 JWT 与 refresh 密钥，并替换所有占位值。

## 3. 加载变量、迁移并启动

从仓库根目录，在 Bash 中显式加载你编写的 shell-compatible `.env`。配置值含特殊字符时应正确引用。迁移前先使用新的开发数据库：

```bash
set -a
source .env
set +a
cd panel-web
npm ci --ignore-scripts
npm run db:migrate
npm run db:migrate:phase1
npm run db:migrate:phase2
npm run db:migrate:phase3
npm start
```

直接运行 `node` 或 `npm` 不会自动把任意 `.env` 文件注入当前进程。不同迁移脚本的加载方式目前不统一，因此统一使用上面的显式加载步骤。PowerShell 或服务管理器应将同样变量传入进程环境。

## 4. 验证账号与回调

入口为 `/login.html` 和 `/register.html`。后端路由为：

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`

当前逻辑先按 Google subject 查找身份，未绑定时按邮箱匹配；不存在用户时创建用户、租户与 owner 成员，再签发 access/refresh token。用独立测试账号验证首次登录、再次登录、已有账号绑定、退出和失效回调；不要把文档说明当作已完成验收。

公网部署前核对 HTTPS、真实域名、`COOKIE_SECURE=1`、Google 客户端配置和日志脱敏。生产 OAuth client 不保留无用的本地回调。完整发布范围见 [发布检查清单](../RELEASE_CHECKLIST.md)。
