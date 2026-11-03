# OpenSwarm SaaS

基于 [goldct/openswarm](https://github.com/goldct/openswarm) 的实验性 SaaS 扩展，围绕 OpenClaw 控制面板和 Agent runtime 构建。

[English](README.md) · [贡献指南](CONTRIBUTING.md) · [安全策略](SECURITY.md)

**当前阶段：pre-release（预发布）。** 本仓库在上游本地面板基础上增加用户认证、租户管理、PostgreSQL 持久化和租户 runtime 控制。这些功能仍在开发与验证中，目前不宣称达到生产成熟度或特定并发容量。

## 本地预览面板

需要 **Node.js 22.12+** 和 npm；CI 目标版本为 Node.js 22、24。macOS、Linux 可执行 Bash 脚本；Windows 可用 Node.js 预览面板，完整 runtime 建议使用 WSL。

```bash
git clone https://github.com/zuixi01/OpenSwarm-SaaS.git
cd OpenSwarm-SaaS/panel-web
npm ci --ignore-scripts
npm start
```

打开 <http://localhost:3999>，默认仅监听 `127.0.0.1`。这一步仅启动面板。执行 Agent 需要下方的完整 runtime 安装；SaaS 登录和持久化需要配置 PostgreSQL。调用模型需要自行提供服务商凭据，并可能产生模型服务费用。

远程或容器访问必须显式设置 `PANEL_WEB_HOST`（容器需 `0.0.0.0`），并通过 `OPENSWARM_PANEL_TOKEN` 或已配置的 SaaS 用户认证启用鉴权。面板可操作本地文件与进程，无鉴权预览仅用于本机。公网服务还需要 HTTPS 和经过审阅的网络边界。

## 安装完整本地 runtime

在仓库根目录，使用 macOS、Linux 或 WSL 中的 Bash：

```bash
bash install.sh
bash start-panel.sh
```

安装器会下载 OpenClaw、安装依赖并生成本地网关与 Agent 配置，需要能够访问 npm 和 GitHub。启动 Agent 前先在面板中配置模型服务商。运行前请阅读安装脚本；默认布局包含一个主网关及最多 64 个 Agent 定义。

## 配置 SaaS 认证与存储

准备自己控制的 PostgreSQL 数据库。将配置放在**仓库根目录的 `.env`**，变量说明见 [OAuth 配置指南](docs/cloud-mvp/google-oauth-setup.md) 和 [面板环境变量模板](panel-web/.env.example)。不要提交该文件。

迁移和启动前显式加载变量。以下 Bash 命令要求 `.env` 是你编写的、可由 shell 加载的配置：

```bash
# 在仓库根目录执行。
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

先在新建开发数据库验证迁移；已有部署应先备份并审阅迁移内容。Google OAuth 为可选项，回调地址和本地 HTTP 的 cookie 设置见 [配置指南](docs/cloud-mvp/google-oauth-setup.md)。

## 开发与验证

```bash
cd panel-web
npm ci --ignore-scripts
npm run check
npm run test:smoke
```

环境和检查范围见 [CONTRIBUTING.md](CONTRIBUTING.md)。自动检查不代表已验证 PostgreSQL 迁移、真实模型调用、全部 64 个 runtime、实际部署中的租户隔离，或 Git 历史中不存在秘密。公开或部署前请逐项完成 [发布检查清单](docs/RELEASE_CHECKLIST.md)。

## 目录说明

- `panel-web/`：Express 后端、浏览器界面、认证及租户服务。
- `yin/`、`hex-template/`：主网关工作区与 Agent 模板。
- `install.sh`、`start-panel.sh`：本地 runtime 安装与启动。
- `docs/cloud-mvp/`：持续演进的 SaaS 数据结构、API 和操作记录。
- `ops/production-500/`：部署示例；目录名称不代表已测得的容量。

[部署文档](docs/DEPLOY.md) 和 [历史更新日志](CHANGELOG.md) 包含上游内容；SaaS 实施记录可能包含计划事项。已验证范围以当前代码、检查结果和发布清单为准。

## 许可与来源

本项目衍生自 **goldct/openswarm**，保留原作者版权声明。仓库按 [LICENSE](LICENSE) 中的 **GPL-3.0-or-later** 发布。随附第三方组件保留各自许可与声明，包括 [Agent Reach](yin/workspace/skills/agent-reach/LICENSE)。

本 fork 不授予上游或第三方许可证之外的商业例外。历史上游版本号不代表 SaaS 扩展已有稳定版本。
