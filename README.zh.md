# Yinova

64 卦群控面板 · openclaw 多开 · 一键部署 · v1.1

> 通过 Web 面板统一管理 openclaw 多实例（阴主网关 + 64 卦子节点），支持主流 AI 模型提供商，填写 API Key 即可使用。

## 快速开始

```bash
# 1. 克隆并安装
git clone https://github.com/goldct/yinova && cd yinova
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
| **Linux** | ✅ 支持。执行 `./install.sh`、`./start-panel.sh` |
| **Windows** | ⚠️ 需 WSL 或 Git Bash |

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
└── start-panel.command # Mac 双击启动
```

## 常见问题

- **阴连不上 / 返回网页而非 JSON**：1) 先点击「阴·启动」；2) 确认 `yin/moltbot.json` 中 `gateway.http.endpoints.chatCompletions.enabled = true`；3) 复制项目后重新执行 `./install.sh` 以修正路径（含 molbot.json 的 workspace）、token 和配置。
- **端口占用**：默认面板 3999、主网关 18789、卦 18791 起。配置页点击「检测端口占用」—若端口被占用，面板会自动查找空闲端口并更新 config.json、workers.conf、moltbot.json，无需手动编辑。
- **No API key**：配置页选择提供商、填写 API Key 并保存。
- **模型列表为空**：确保 `./install.sh` 已执行完成。

## 功能特性

- 统一管理、一键部署、自动配置
- 实时监控、项目管理、智能协调

## 链接

- [English README](README.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- [更新日志](CHANGELOG.md)
- [免责声明](DISCLAIMER.md)

## License

MIT License - 详见 [LICENSE](LICENSE)
