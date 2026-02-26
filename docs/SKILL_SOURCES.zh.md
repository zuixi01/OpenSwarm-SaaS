# Yinova 技能来源与使用

## 一、技能库

Yinova 推荐技能列表位于 `skills/skills.json`，技能内容在 `skills/{skillId}/` 目录下。

| 技能 ID | 名称 | 来源 | 说明 |
|---------|------|------|------|
| summarize | Summarize | Yinova 内置 | 智能文本摘要 |
| github | GitHub | ClawHub | GitHub 集成，需 `clawhub install github` |
| wacli | Wacli | ClawHub | 命令行自动化 |
| byte-rover | ByteRover | ClawHub | 多用途任务处理 |
| agent-browser | Agent Browser | ClawHub | 浏览器自动化 |
| gog | Gog | ClawHub | Google Workspace 集成 |
| filesystem | Filesystem | MCP | 本地文件读写 |

## 二、使用方式

1. **阳 · 技能组装**：点击太极阳眼，进入 `yang.html`，选择项目，为每个卦勾选需要的技能，保存。
2. **执行任务时**：当通过「派发执行任务」或「执行任务模式」向卦发 agent 任务时，系统会根据 `project.hexSkills` 自动将所选技能挂载到该卦的 `workspace/skills/`，卦执行时即可使用。
3. **项目级**：同一卦在不同项目可有不同技能组合，配置存于 `project.hexSkills`。

## 三、技能来源与协议

- **Yinova 内置**（如 summarize）：随项目分发，遵循 Yinova 的 GPL v3。
- **ClawHub 技能**：来自 [ClawHub](https://clawhub.ai)，各技能有独立协议，多为 MIT/Apache。使用前可 `clawhub install <skill-id>` 安装到 `~/.openclaw/skills`，Yinova 内置了简化版 SKILL.md 供快速使用。
- **MCP 技能**（如 filesystem）：来自 [Model Context Protocol](https://modelcontextprotocol.io)，使用 `npx @modelcontextprotocol/server-filesystem` 等。

## 四、扩展技能

1. 在 `skills/skills.json` 的 `skills` 数组中添加新项。
2. 在 `skills/{skillId}/` 下创建 `SKILL.md`，格式参考现有技能。
3. 阳页面刷新后即可在勾选列表中看到新技能。
