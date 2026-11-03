# OpenSwarm SaaS Beta Server Deploy Runbook

这份 runbook 适用于把当前代码部署成一套可对外测试的 SaaS beta 环境。

## 目标

完成后，你应该具备：

- 一个可登录的 SaaS 面板
- PostgreSQL 作为主数据源
- Google 登录
- 租户/成员/runtime 管理后台
- 基础健康检查与运维后台

## 1. 服务器准备

建议：

- Ubuntu 22.04 / 24.04
- 8 vCPU / 16 GB RAM
- 独立 PostgreSQL，或先同机部署
- 一个正式域名，例如 `app.example.com`

## 2. DNS 与 HTTPS

先把域名指向服务器公网 IP。

Google 登录正式可用前，需要：

- 一个公网可访问域名
- HTTPS

推荐：

- Nginx + Let's Encrypt

## 3. 代码与依赖

```bash
cd /opt
git clone <your-repo-url> openswarm
cd openswarm

# 安装 node / nginx / postgres 等基础依赖
bash ./deploy.sh \
  --domain app.example.com \
  --public-scheme https \
  --db-name openswarm \
  --db-user openswarm \
  --google-client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --google-client-secret "$GOOGLE_OAUTH_CLIENT_SECRET"
```

如果你不想一键跑，也可以手工：

```bash
cd /opt/openswarm/panel-web
npm install
node scripts/db-migrate-phase1.js
node scripts/db-migrate-phase2.js
node scripts/db-migrate-phase3.js
node scripts/phase1-seed-bootstrap.js
```

## 4. 环境文件

推荐从这里复制：

- [ops/production-500/panel.env.saas.template](../../ops/production-500/panel.env.saas.template)

部署到：

- `/etc/openswarm/panel.env`

至少确认这些值：

- `OPENSWARM_PUBLIC_BASE_URL`
- `DATABASE_URL`
- `OPENSWARM_AUTH_JWT_SECRET`
- `OPENSWARM_AUTH_REFRESH_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

## 5. Google Console

在 Google Cloud Console 里配置：

- Authorized JavaScript origins:
  - `https://app.example.com`
- Authorized redirect URIs:
  - `https://app.example.com/api/auth/google/callback`

完整说明：

- [docs/cloud-mvp/google-oauth-setup.md](google-oauth-setup.md)

## 6. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openswarm-panel
sudo systemctl restart openswarm-panel
sudo systemctl status openswarm-panel --no-pager
```

## 7. 验证

先验证基础：

```bash
curl -sS https://app.example.com/api/health
curl -I https://app.example.com/login.html
curl -I https://app.example.com/register.html
```

再验证登录：

1. 打开 `https://app.example.com/login.html`
2. 点击 `使用 Google 账号登录`
3. 完成授权
4. 登录后确认：
   - 首页正常
   - 项目页正常
   - `runtime-admin.html` 正常
   - 租户切换可见

## 8. Beta 上线前人工检查

逐项过这份清单：

- [docs/cloud-mvp/saas-release-checklist.md](saas-release-checklist.md)

重点检查：

- 登录/切租户
- 成员邀请
- runtime 启停
- 告警总览
- 节点调度
- 关键项目读写

## 9. 上线后第一周建议

- 每天看：
  - `journalctl -u openswarm-panel -f`
  - runtime-admin 的告警总览
- 先只放少量 beta 用户
- 暂时不要开完全自助注册宣传
- 先做手工客服支持和租户开通
