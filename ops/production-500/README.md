# OpenSwarm production template (target: ~500 online users)

This package is designed for the current codebase behavior (single panel-web instance).

## Why single instance first

`panel-web/server.js` currently stores part of task state in process memory/maps and local files.
Running multiple panel instances behind LB can cause task polling inconsistency unless state is moved to Redis/DB.

## 1) Recommended baseline host

- App host: 8 vCPU / 16 GB RAM / NVMe 200 GB
- DB host: 4 vCPU / 8-16 GB RAM (PostgreSQL)
- OS: Ubuntu 22.04/24.04 LTS

## 2) Install dependencies

Ubuntu / Debian:

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib
# install node 22.x (example)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Alibaba Cloud Linux 3 / RHEL-like:

```bash
sudo dnf makecache -y
sudo dnf install -y nginx postgresql postgresql-server postgresql-contrib
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

## 3) Prepare app and env

```bash
# example path
sudo mkdir -p /opt
sudo chown -R "$USER":"$USER" /opt
cd /opt
git clone https://github.com/goldct/openswarm.git
cd openswarm
npm --prefix panel-web install

# app bootstrap
bash ./install.sh
```

Create env file from template:

```bash
sudo mkdir -p /etc/openswarm
sudo cp ops/production-500/panel.env.production.example /etc/openswarm/panel.env
sudo chmod 600 /etc/openswarm/panel.env
```

Then fill at least:

- `DATABASE_URL`
- `OPENSWARM_PUBLIC_BASE_URL`
- `OPENSWARM_AUTH_JWT_SECRET`
- `OPENSWARM_AUTH_REFRESH_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

Google OAuth detailed setup:

- [/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/google-oauth-setup.md](/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/google-oauth-setup.md)
- [/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/server-beta-deploy-runbook.md](/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/server-beta-deploy-runbook.md)
- [/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/alicloud-ecs-47.110.157.215-beta-deploy.md](/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/alicloud-ecs-47.110.157.215-beta-deploy.md)

## 4) Install systemd service

```bash
sudo useradd --system --home /opt/openswarm --shell /usr/sbin/nologin openswarm || true
sudo chown -R openswarm:openswarm /opt/openswarm

sudo cp ops/production-500/openswarm-panel.service /etc/systemd/system/openswarm-panel.service
sudo systemctl daemon-reload
sudo systemctl enable --now openswarm-panel
sudo systemctl status openswarm-panel --no-pager
```

## 5) Install nginx reverse proxy

```bash
sudo cp ops/production-500/nginx.openswarm.conf /etc/nginx/sites-available/openswarm
sudo ln -sf /etc/nginx/sites-available/openswarm /etc/nginx/sites-enabled/openswarm
sudo nginx -t
sudo systemctl reload nginx
```

## 6) Verify

```bash
curl -sS http://127.0.0.1:3999/api/health
curl -sS http://127.0.0.1/healthz
```

Also verify:

```bash
curl -I http://127.0.0.1:3999/login.html
curl -I http://127.0.0.1:3999/api/auth/google/start
```

## 7) Load test (before opening to users)

Use a non-heavy endpoint for baseline first:

```bash
npx -y autocannon -c 200 -d 30 -p 10 http://127.0.0.1/api/health
```

Then test real traffic paths gradually.

## Operational notes

- `index.html` uses periodic polling. 500 online users can generate sustained request pressure.
- `/api/robots` internally executes port checks; avoid over-polling or very short intervals.
- If you need horizontal scaling, first move in-memory task stores to Redis/DB.

## Release checklist

Before public beta or production release, follow:

- [/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/saas-release-checklist.md](/Users/shenwei/Documents/source/yinova/docs/cloud-mvp/saas-release-checklist.md)

## Logs

```bash
journalctl -u openswarm-panel -f
```
