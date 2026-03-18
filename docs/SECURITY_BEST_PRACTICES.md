# 安全与权限最佳实践

## 一、面板访问鉴权

设置环境变量 `OPENSWARM_PANEL_TOKEN` 后，面板将要求鉴权：

```bash
export OPENSWARM_PANEL_TOKEN="your-secret-token"
./start-panel.sh
```

- 浏览器访问时会被重定向到 `/login.html`，输入令牌后登录
- API 调用需携带 `X-Panel-Token: your-secret-token` 或 `Authorization: Bearer your-secret-token`
- `/api/health` 不受鉴权限制（供监控探针使用）

## 二、项目 API Token

项目级 API Token（阴控制台 → API → 生成 Token）用于 `POST /api/projects/:id/run`：

- 每个项目独立 Token，建议定期更换
- 调用时使用 `Authorization: Bearer <token>` 或 `X-API-Key: <token>`

## 三、敏感配置

### 3.1 密钥占位符

在阴控制台「配置」中，可将敏感值设为占位符，由员工执行时从环境注入：

| 配置 key | 说明 |
|----------|------|
| `API_KEY` | 留空或 `***`，实际值由员工进程的 env 注入 |
| `SECRET` | 同上 |

员工的 `moltbot.json` 或启动脚本可配置 `env` 注入，避免在面板中明文存储。

### 3.2 文件权限

- `config.json`、`yin/moltbot.json` 含 API Key，应限制读写权限：`chmod 600 config.json`
- `panel-web/data/projects.json` 含项目配置，建议同权限保护

## 四、生产部署建议

1. 使用 HTTPS（反向代理如 nginx）
2. 设置 `OPENSWARM_PANEL_TOKEN` 并定期轮换
3. 不将 `config.json`、`yin/moltbot.json` 纳入版本库（已在 .gitignore）
4. 备份时对敏感文件加密存储

## 五、相关文档

- [部署运维](DEPLOY.md)
- [API 调用](API.md)
