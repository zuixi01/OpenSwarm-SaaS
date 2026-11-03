# 部署与运维

当前为预发布项目。本页按仓库中的 [Dockerfile.panel](../Dockerfile.panel) 和 [docker-compose.yml](../docker-compose.yml) 说明参考流程；**本次整理未执行 Docker build、Compose 启动或 PostgreSQL 集成验收**。正式部署前需在独立环境完成 [发布检查清单](RELEASE_CHECKLIST.md)。

## 本地启动与配置

使用 Node.js 22.12+，从仓库根目录加载你编写的 shell-compatible `.env` 后启动：

```bash
set -a
source .env
set +a
cd panel-web
npm ci --ignore-scripts
npm start
```

也可从仓库根目录运行 `bash start-panel.sh`；该脚本加载根 `.env`。默认仅监听 `127.0.0.1:3999`。面板能操作本地文件与进程，远程访问必须显式设置 `PANEL_WEB_HOST`，并启用 `OPENSWARM_PANEL_TOKEN` 或 SaaS 用户认证。对外服务还需 HTTPS 和网络访问限制。

**已有本地安装先备份。** 面板启动会同步既有 worker 配置；启动前应备份 `config.json`、`workers.conf`、`yin/moltbot.json`、相关 Agent 配置与数据。不要把一次启动当作只读检查，也不要用重新安装代替恢复验证。

## Compose 参考部署：面板与 PostgreSQL

该示例运行 PostgreSQL 16 与 Node.js 22 Alpine 面板容器，宿主端口仅映射为 `127.0.0.1:3999`。容器内部通过 `PANEL_WEB_HOST=0.0.0.0` 接收映射请求，SaaS 用户认证强制开启。

镜像**不包含 OpenClaw、Bash 或完整 Agent runtime**，无法通过该镜像直接完成本地安装脚本或全部 Agent 启停。模型执行和 runtime 集成需要另外准备并验证；仅启动面板与数据库不表示这些能力可用。

### 配置根目录 .env

Compose 从仓库根目录 `.env` 读取变量；以下字段必须填写实际值，模板占位值不可用于对外服务：

| 变量 | 要求 |
|------|------|
| `POSTGRES_PASSWORD` | 为 Compose 创建的 `openswarm` 数据库账号设置独立随机口令 |
| `DATABASE_URL` | 指向 Compose 服务名 `postgres`，数据库和用户均为 `openswarm` |
| `OPENSWARM_AUTH_JWT_SECRET` | 独立随机密钥 |
| `OPENSWARM_AUTH_REFRESH_SECRET` | 另一把独立随机密钥，不复用 JWT 密钥 |

`DATABASE_URL` 的结构为：

```text
postgres://openswarm:URL_ENCODED_PASSWORD@postgres:5432/openswarm
```

连接串中的口令必须是 `POSTGRES_PASSWORD` 的 URL 编码形式，特别是包含 `@`、`:`、`/`、`#` 等字符时。容器中的 `localhost` 指向容器自身，不要用它代替 `postgres`。该本地 Compose 数据库没有配置 TLS；如需设置，使用 `DATABASE_SSLMODE=disable`。外部数据库应按其 TLS 要求单独配置。

`.env` 会作为 panel 的环境文件加载，不得提交到 Git 或粘贴到公开日志。使用已有 PostgreSQL 数据卷时，修改 `POSTGRES_PASSWORD` 不会自动轮换数据库内既有账号的口令；连接串必须与真实账号状态一致。

### 构建、迁移、启动

以下命令在仓库根目录执行，需要 Docker Compose v2。它们是待验证的操作示例，本次未实际运行：

```bash
mkdir -p panel-web/data
docker compose build
docker compose up -d --wait postgres
docker compose run --rm --no-deps panel npm --prefix panel-web run db:migrate
docker compose run --rm --no-deps panel npm --prefix panel-web run db:migrate:phase1
docker compose run --rm --no-deps panel npm --prefix panel-web run db:migrate:phase2
docker compose run --rm --no-deps panel npm --prefix panel-web run db:migrate:phase3
docker compose up -d panel
```

等待 PostgreSQL 健康后再执行迁移；任何一步失败均应先排查原因，不能继续把面板启动当作迁移成功。首次应使用新的开发数据库验证；已有数据库先备份并审阅 SQL。

面板启动后从宿主机访问 <http://localhost:3999>。公网访问应由配置 HTTPS 的反向代理转发到宿主回环端口，保留用户认证；不要直接放宽端口映射作为公网方案。Google 登录的额外配置见 [OAuth 指南](cloud-mvp/google-oauth-setup.md)。

## 持久化、备份与恢复

当前 Compose 的持久化范围为：

| 数据 | 当前保存位置 | 注意事项 |
|------|--------------|----------|
| PostgreSQL | `postgres_data` 命名卷 | 需要单独的数据库备份与恢复验证 |
| 面板 data | 宿主 `panel-web/data` bind mount | 含运行数据，备份时注意用户信息与凭据 |
| 根 `config.json` | panel 容器可写层 | **当前不持久化**；重建或替换容器可能丢失 |

如需保留面板写入的 `config.json`，先在宿主机准备一个有效 JSON **普通文件**，已有配置先备份；不要对不存在的路径直接使用短格式文件挂载，以免创建同名目录。该文件可能包含 API Key，应限制访问且不要提交。

可自行创建 `compose.config.yaml`，使用显式文件 bind：

```yaml
services:
  panel:
    volumes:
      - type: bind
        source: ./config.json
        target: /app/config.json
        bind:
          create_host_path: false
```

之后运行涉及 panel 的 Compose 命令时同时加载该覆盖文件，例如：

```bash
docker compose -f docker-compose.yml -f compose.config.yaml up -d panel
```

恢复前核对应用版本、数据库 schema、目录权限与凭据。先在隔离环境验证恢复，再恢复对外访问。不要删除数据库卷来处理迁移失败。

本地完整 runtime 还需备份 `workers.conf`、`yin/`、`hexes/` 中实际配置与状态；这些目录通常包含秘密或用户数据，不能作为开源附件发布。

## 健康检查与容量边界

`GET /api/health` 用于确认面板进程可响应，Compose 的 healthcheck 也仅请求这一接口。成功返回不表示 PostgreSQL schema 已迁移、认证链可用、模型可调用或 runtime 就绪；这些必须分别验收。

[ops/production-500](../ops/production-500/README.md) 为历史部署参考目录，名称不代表已验证支持 500 人在线。仓库仍有进程内状态与本地文件状态，未经实际负载测试及状态一致性验证，不能据此宣称并发容量或多实例扩容能力。

日志应轮转并脱敏，数据库、面板配置与 runtime 分别纳入备份。发布和回滚前记录实际提交、配置变更、迁移结果及恢复验证，不把本页的参考步骤当作已执行记录。
