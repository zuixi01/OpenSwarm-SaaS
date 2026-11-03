# OpenSwarm SaaS 面板

Express 后端与浏览器界面，默认端口为 `3999`。当前处于预发布阶段。

在本目录使用 Node.js 22.12+：

```bash
npm ci --ignore-scripts
npm run check
npm run test:smoke
npm start
```

打开 <http://localhost:3999>，默认仅监听 `127.0.0.1`。这一步仅启动面板，完整 Agent runtime 安装见 [根目录 README](../README.zh.md)。

远程或容器访问需显式设置 `PANEL_WEB_HOST`（容器设为 `0.0.0.0`），并启用 `OPENSWARM_PANEL_TOKEN` 或 SaaS 用户认证。无鉴权预览仅用于本机；对外服务需配置 HTTPS 与网络访问限制。

## SaaS 认证与存储

环境配置统一放在**仓库根目录的 `.env`**，模板变量见 [panel-web/.env.example](.env.example)。直接执行 Node.js 或迁移脚本前，从仓库根目录显式加载：

```bash
set -a
source .env
set +a
cd panel-web
npm run db:migrate
npm run db:migrate:phase1
npm run db:migrate:phase2
npm run db:migrate:phase3
npm start
```

以上为 Bash 命令；在其他 shell 中需将相同变量加入当前进程环境。不要将配置文件或真实凭据提交到仓库。

- [Google OAuth 配置](../docs/cloud-mvp/google-oauth-setup.md)
- [开源与发布检查清单](../docs/RELEASE_CHECKLIST.md)
- [SaaS 功能检查记录](../docs/cloud-mvp/saas-release-checklist.md)
- [部署模板](../ops/production-500/README.md)：参考配置，容量尚需实际压测验证。
