# 阿里云 ECS Beta 部署手册（47.110.157.215）

这份手册按你当前这台服务器定制：

- 机器：`ecs.c9i.2xlarge`
- CPU / 内存：`8 vCPU / 16 GiB`
- 系统：`Alibaba Cloud Linux 3`
- 公网 IP：`47.110.157.215`

## 先说结论

这台机器适合：

- OpenSwarm SaaS beta
- 封闭测试
- 小规模试运营

这台机器当前还建议你先做两个调整：

1. 系统盘从 `20G` 扩到 `80G+`
2. 带宽从 `5 Mbps` 提到 `10 Mbps+`

## Google 登录的限制

Google OAuth 正式可用需要：

- 一个正式域名
- HTTPS
- 回调地址写成域名，不建议裸 IP

所以这台机器可以先按 IP 完成基础部署和本地账号验证，但要打开 Google 登录，最好先准备：

- 例如：`app.yourdomain.com`

并把它解析到：

- `47.110.157.215`

## 安全组建议

在阿里云安全组里放行：

- `22/tcp`
- `80/tcp`
- `443/tcp`

不要对公网放行：

- `3999`
- PostgreSQL 端口

## 目录约定

推荐使用：

```bash
/opt/openswarm
/etc/openswarm/panel.env
/data/openswarm/runtime
```

## 首次部署

```bash
sudo mkdir -p /opt
sudo chown -R "$USER":"$USER" /opt
cd /opt
git clone <your-repo-url> openswarm
cd /opt/openswarm
```

如果你已经有代码，就直接进入项目目录。

## 用部署脚本安装

### 方案 A：先按 IP 跑 beta

这适合先做基础可用性验证，不开 Google 登录。

```bash
cd /opt/openswarm
bash ./deploy.sh \
  --domain 47.110.157.215 \
  --public-scheme http \
  --public-base-url http://47.110.157.215 \
  --db-name openswarm \
  --db-user openswarm \
  --runtime-mode local
```

### 方案 B：正式域名 + HTTPS + Google 登录

假设你的域名是 `app.yourdomain.com`：

```bash
cd /opt/openswarm
bash ./deploy.sh \
  --domain app.yourdomain.com \
  --public-scheme https \
  --public-base-url https://app.yourdomain.com \
  --db-name openswarm \
  --db-user openswarm \
  --runtime-mode local \
  --google-client-id "$GOOGLE_OAUTH_CLIENT_ID" \
  --google-client-secret "$GOOGLE_OAUTH_CLIENT_SECRET"
```

## 环境文件

推荐模板：

- [/Users/shenwei/Documents/source/yinova/ops/production-500/panel.env.saas.template](/Users/shenwei/Documents/source/yinova/ops/production-500/panel.env.saas.template)

如果你要按这台机器单独准备，可以用：

- [/Users/shenwei/Documents/source/yinova/ops/production-500/panel.env.aliyun-beta.template](/Users/shenwei/Documents/source/yinova/ops/production-500/panel.env.aliyun-beta.template)

## HTTPS

脚本会配置 Nginx 反代，但不会自动申请证书。

建议在域名准备好后执行：

```bash
sudo dnf install -y certbot python3-certbot-nginx || sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yourdomain.com
```

## 验证

```bash
curl -sS http://127.0.0.1:3999/api/health
curl -I http://47.110.157.215
sudo systemctl status openswarm-panel --no-pager
sudo systemctl status nginx --no-pager
```

## Google Console 回调地址

正式启用时填：

- `https://app.yourdomain.com/api/auth/google/callback`

详细说明：

- [/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/google-oauth-setup.md](/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/google-oauth-setup.md)

## 运维后台

部署后可直接查看：

- 面板首页：`/`
- 租户 runtime 后台：`/runtime-admin.html`

## 当前这台机器的建议上线顺序

1. 先按 IP 跑通基础部署
2. 验证健康检查、登录页、runtime-admin
3. 再绑定域名
4. 配 HTTPS
5. 再启用 Google 登录
