# 部署与运维

## 一、环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PANEL_WEB_PORT` | 面板端口 | 3999 |
| `GATEWAY_MAIN` | 阴主网关地址 | ws://127.0.0.1:18789 |
| `OPENCLAW_DIR` | openclaw 目录 | 项目根/openclaw |
| `YINOVA_GATEWAY_TOKEN` | 安装时生成的网关 token（可选） | - |
| `YINOVA_RUN_TOKEN` | 全局 API 调用 token（可选） | - |
| `YINOVA_PANEL_TOKEN` | 面板访问鉴权 token（可选，设置后需登录） | - |

启动前可创建 `.env` 文件，`start-panel.sh` 会自动加载：

```bash
PANEL_WEB_PORT=4000
```

## 二、健康检查

```
GET /api/health
```

返回 `200` 且 `{ "ok": true, "service": "yinova-panel", "ts": ... }` 表示面板正常。可用于负载均衡、K8s 探针、监控。

## 三、备份与恢复

### 需备份的文件/目录

| 路径 | 说明 |
|------|------|
| `panel-web/data/projects.json` | 项目、卦技能、定时、触发、流程 |
| `config.json` | API Key、端口配置（根目录，gitignore） |
| `workers.conf` | 卦端口与 token（install 生成） |
| `yin/moltbot.json` | 阴配置、token（gitignore） |
| `hexes/*/` | 各卦状态（install 生成） |

### 备份示例

```bash
tar -czvf yinova-backup-$(date +%Y%m%d).tar.gz \
  panel-web/data/ config.json workers.conf yin/moltbot.json 2>/dev/null || true
```

### 恢复

1. 解压备份到项目根目录
2. 若路径变更，执行 `./install.sh` 修正 workspace 等路径
3. 重启面板

## 四、Docker 部署（仅面板）

适用于仅需 Web 面板、阴/卦在宿主机或其它方式启动的场景。

```bash
# 构建
docker build -t yinova-panel -f Dockerfile.panel .

# 运行（挂载数据目录）
docker run -d -p 3999:3999 \
  -v $(pwd)/panel-web/data:/app/panel-web/data \
  -v $(pwd)/config.json:/app/config.json \
  --name yinova-panel yinova-panel
```

或使用 docker-compose：

```bash
# 首次运行前：确保 panel-web/data 存在，config.json 可选（无则使用空配置）
mkdir -p panel-web/data
docker-compose up -d
```

`config.json` 挂载可选；若宿主机无此文件，可先 `echo '{}' > config.json` 或执行 `./install.sh` 生成。

## 五、日志

- 面板：控制台输出，可重定向 `./start-panel.sh >> panel.log 2>&1`
- 阴网关：`/tmp/yinova-main.log`（或 `os.tmpdir()`）
- 卦：各卦 TUI 终端输出

建议生产环境使用 PM2、systemd 等管理进程并配置日志轮转。

## 六、相关文档

- [技术路线](TECH_ROADMAP.md)
- [阴控制台](YIN_CONSOLE.md)
- [API 调用](API.md)
