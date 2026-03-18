# 更新日志

## 1.3.1 (2026-02-27)

### Windows 与 Ubuntu

- **Windows 支持**：`start-panel.bat` 双击启动，`docs/WINDOWS.md` 使用说明
- **Ubuntu**：明确支持 Ubuntu 及主流 Linux 发行版

---

## 1.3 (2026-02-27)

### 阶段 7–9：文档、部署、安全

- **阴控制台文档**：`docs/YIN_CONSOLE.md`、`docs/YANG.md`、`docs/API.md`
- **部署运维**：`docs/DEPLOY.md`，环境变量、健康检查、备份、Docker
- **安全实践**：`docs/SECURITY_BEST_PRACTICES.md`，面板鉴权、API Token、密钥占位
- **健康检查**：`GET /api/health` 供负载均衡/监控
- **面板鉴权**：`OPENSWARM_PANEL_TOKEN` 可选，`/login.html` 登录
- **阳页阴网关提示**：未启动时显示红色提示条

### 阶段 10：技能与稳定性

- **技能库管理**：`skills.html` 增删改查，`PUT /api/skills`
- **技能模板**：`/api/skills/templates`，阳页「应用模板」
- **员工任务重试**：agent-task 失败最多重试 3 次，间隔 2s
- **阴网关离线提示**：首页、阳页显示提示条

### 阶段 11：模板与体验

- **项目模板**：`/api/project-templates`，新建项目时可选
- **快捷键**：Ctrl/Cmd+Enter 发送，Esc 关闭弹窗
- **Docker**：`Dockerfile.panel`、`docker-compose.yml`
- **技术路线**：`docs/TECH_ROADMAP.md` 完整路线图

---

## 1.2 (2026-02-25)

### 体验

- **项目页「本项目员工象·启停」**：一键启动 / 一键停止按钮单独成行，更易发现
- **阴的身份定义**：yin/workspace/IDENTITY.md、SOUL.md、MEMORY.md 纳入仓库，全新克隆后阴即带预设身份
- **安装完成提示**：步骤更清晰；Mac 上安装结束后自动打开项目文件夹，便于找到 start-panel.command
- **start-panel.sh**：Mac 上启动后约 3 秒自动打开浏览器

---

## 1.1 (2026-02-24)

### 目录与脚本重命名（阴 → yin）

- 目录 `阴` 重命名为 `yin`
- `启动面板.sh` → `start-panel.sh`，`启动面板.command` → `start-panel.command`
- `阴/启动阴.sh` → `yin/start-yin.sh`
- 更新 server.js、install.sh、panel-full.sh、.gitignore、文档中的路径引用

### 端口自动配置

- 配置页「检测端口占用」：若端口被占用，自动查找空闲端口并更新 config.json、workers.conf、yin/moltbot.json、员工 moltbot.json
- 前端提示「已检测到占用，已自动配置空闲端口」

### 文档与 i18n

- README、CONTRIBUTING、SECURITY、CHANGELOG：英文为主，提供 README.zh.md、CONTRIBUTING.en.md 等双语版本
- 从仓库移除内部文档：GITHUB_OPENSOURCE_CHECKLIST.md、GITHUB_UPLOAD_EXPLAINED.md、PRE_RELEASE_*.md、OPENSOURCE_CHECKLIST.md

### 测试

- smoke-test.sh：验证 install + 面板启动
- 扩展测试：install、/api/config、/api/system、/api/config/check-ports

---

## 1.0 (OpenSwarm 1.0)

- 中英文切换（i18n）
- 员工名英文显示
- 系统负载移至 header 右侧、可折叠
- 上架准备

## 0.1.0 (2026-02-18)

首个开源版本。

---

[English Changelog](CHANGELOG.md)
