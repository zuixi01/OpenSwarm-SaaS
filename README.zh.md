# Yinova

64 卦群控面板 · openclaw 多开 · 一键部署 · v1.3.1

> 通过 Web 面板统一管理 openclaw 多实例（阴主网关 + 64 卦子节点），支持主流 AI 模型提供商，填写 API Key 即可使用。

## 快速开始

```bash
# 1. 克隆并安装（GitHub 或 Gitee）
git clone https://github.com/goldct/yinova && cd yinova
# 国内用户可用: git clone https://gitee.com/goldct/yinova && cd yinova
chmod +x install.sh start-panel.sh
./install.sh

# 2. 启动面板
./start-panel.sh
# 或 Mac：双击 start-panel.command（自动打开浏览器）
```

3. 打开 http://localhost:3999

4. **首次使用**：自动跳转配置页 → 选择模型提供商 → 填写 API Key → 保存。阴与 64 卦均可直接使用，无需重启。

## 支持的模型提供商

面板动态加载 openclaw 内置模型目录，主流提供商均已覆盖。

## 支持环境

| 系统 | 说明 |
|------|------|
| **macOS** | ✅ 支持。终端执行脚本，或双击 `start-panel.command` |
| **Linux** | ✅ 支持。[Ubuntu](https://ubuntu.com/) 等发行版：`./install.sh`、`./start-panel.sh` |
| **Windows** | ✅ 支持（需 WSL，推荐 Ubuntu on WSL）。在 WSL 中执行 `./install.sh`、`./start-panel.sh`，或双击 `start-panel.bat`。详见 [docs/WINDOWS.md](docs/WINDOWS.md) |

依赖 **Node.js 18+**、**npm**。openclaw 由 `install.sh` 自动拉取。

## 结构

```
yinova/
├── openclaw/          # install 拉取
├── hex-template/      # 卦模板
├── hexes/             # install 生成，64 卦
├── yin/               # 总控（主网关 18789）
├── panel-web/         # Web 面板（端口 3999）
├── install.sh         # 首次安装
├── start-panel.sh     # 启动面板
├── start-panel.command # Mac 双击启动
└── start-panel.bat    # Windows 通过 WSL 启动
```

## 常见问题

- **阴连不上 / 返回网页而非 JSON**：1) 先点击「阴·启动」；2) 确认 `yin/moltbot.json` 中 `gateway.http.endpoints.chatCompletions.enabled = true`；3) 复制项目后重新执行 `./install.sh` 以修正路径（含 molbot.json 的 workspace）、token 和配置。
- **端口占用**：默认面板 3999、主网关 18789、卦 18791 起。配置页点击「检测端口占用」—若端口被占用，面板会自动查找空闲端口并更新 config.json、workers.conf、moltbot.json，无需手动编辑。
- **No API key**：配置页选择提供商、填写 API Key 并保存。
- **模型列表为空**：确保 `./install.sh` 已执行完成。
- **GitHub 克隆/拉取失败**（如 `Error in the HTTP2 framing layer`）：改用 Gitee：`git clone https://gitee.com/goldct/yinova`，或 `git remote set-url origin https://gitee.com/goldct/yinova.git` 后 `git pull`。国内网络下 Gitee 更稳定。

## 功能特性

- 统一管理、一键部署、自动配置
- 实时监控、项目管理、项目模板、智能协调
- 技能库管理、技能模板、阳自动配置
- 部署：Docker、健康检查、可选面板鉴权

## 阳 · 技能组装

点击太极阳眼，按项目为卦配置技能。卦执行任务时自动挂载所选技能。详见 [技能来源](docs/SKILL_SOURCES.zh.md)。

## 链接

- [阴控制台](docs/YIN_CONSOLE.md) · [阳配置](docs/YANG.md) · [API 调用](docs/API.md) · [部署运维](docs/DEPLOY.md) · [Windows/WSL](docs/WINDOWS.md) · [安全实践](docs/SECURITY_BEST_PRACTICES.md) · [技术路线](docs/TECH_ROADMAP.md)
- [使用手册](docs/USER_GUIDE.zh.md)
- [项目架构](docs/ARCHITECTURE.zh.md)
- [English README](README.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [更新日志](CHANGELOG.md)
- [免责声明](DISCLAIMER.md)

## 版权与许可

Yinova 采用 **GPL v3** 许可。基于本项目的衍生作品需遵守 GPL v3 并保留原作者署名。

如需在闭源产品、SaaS 或商业场景中使用而不受 GPL 约束，可联系获取**商业许可**：

- 邮箱：2304671698@qq.com
- 微信：hundunai001（扫下方二维码添加）

![Yinova 开源 · 微信](docs/wechat-qr.png)

详见 [LICENSE](LICENSE)
