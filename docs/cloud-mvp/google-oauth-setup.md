# Google OAuth Setup For OpenSwarm SaaS

这份说明用于把 Google 登录接到当前 `panel-web` 的 SaaS 认证链。

## 1. 在 Google Cloud Console 创建 OAuth Client

进入 Google Cloud Console：

- `APIs & Services`
- `Credentials`
- `Create Credentials`
- `OAuth client ID`

选择：

- `Application type`: `Web application`

建议名称：

- `OpenSwarm SaaS Web`

## 2. Authorized JavaScript origins

填写你的 SaaS 域名，例如：

- `https://your-domain.example.com`

本地测试可加：

- `http://localhost:3999`

## 3. Authorized redirect URIs

必须包含后端回调地址：

- `https://your-domain.example.com/api/auth/google/callback`

本地测试可加：

- `http://localhost:3999/api/auth/google/callback`

## 4. 配置环境变量

在 `panel-web/.env` 或部署环境里配置：

```env
DATABASE_URL=postgres://user:pass@host:5432/openswarm
DATABASE_SSLMODE=require

OPENSWARM_REQUIRE_USER_AUTH=1
OPENSWARM_AUTH_JWT_SECRET=replace-with-strong-secret
OPENSWARM_AUTH_REFRESH_SECRET=replace-with-another-strong-secret
OPENSWARM_AUTH_COOKIE_SECURE=1
OPENSWARM_PUBLIC_BASE_URL=https://your-domain.example.com

GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_OAUTH_REDIRECT_URI=https://your-domain.example.com/api/auth/google/callback
```

## 5. 首次登录行为

Google 登录成功后，系统按下面逻辑处理：

1. 先查 `user_identities(provider=google, provider_subject=sub)`
2. 若未绑定，再按邮箱匹配现有 `users`
3. 若邮箱也不存在，则自动创建：
   - `users`
   - `tenants`
   - `tenant_members(owner)`
4. 然后签发当前租户的 access/refresh token

## 6. 数据库要求

Google 登录依赖：

- `users`
- `tenants`
- `tenant_members`
- `auth_refresh_tokens`
- `audit_logs`
- `user_identities`

如果你是全新环境，先执行：

```bash
cd /Users/shenwei/Documents/source/yinova/panel-web
node scripts/db-migrate-phase1.js
node scripts/db-migrate-phase2.js
node scripts/db-migrate-phase3.js
```

## 7. 页面入口

Google 登录入口已经接到：

- `/login.html`
- `/register.html`

后端入口：

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`

## 8. 生产建议

- 开启 HTTPS
- 设置 `OPENSWARM_AUTH_COOKIE_SECURE=1`
- 不要把 `GOOGLE_OAUTH_CLIENT_SECRET` 写进前端
- 将 `OPENSWARM_PUBLIC_BASE_URL` 与 Google Console 配置保持一致
- 生产环境不要允许 `localhost` 回调继续保留
