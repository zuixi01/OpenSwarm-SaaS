# Yinova 项目架构解读

## 一、整体结构

```
yinova/
├── openclaw/          # AI 框架（install 拉取，.gitignore）
├── hex-template/      # 卦模板
├── hexes/             # install 生成，64 卦目录（每卦 stateDir）
├── yin/               # 阴（主网关 18789）
├── panel-web/         # Web 面板（Express，端口 3999）
├── config.json        # 面板配置（API Key、端口等）
├── workers.conf       # 卦与端口映射
├── install.sh         # 首次安装
└── start-panel.sh    # 启动面板
```

## 二、核心模块

### 1. 阴（yin/）

- **角色**：平台总控网关
- **端口**：18789
- **启动**：`yin/start-yin.sh`（网关 + TUI）
- **配置**：`yin/moltbot.json`（含 gateway、chatCompletions 等）
- **状态目录**：`OPENCLAW_STATE_DIR=yin/`，session 存于 `yin/agents/main/sessions/`

### 2. 卦（hexes/）

- **角色**：64 个 openclaw 子节点，每卦独立进程
- **端口**：18791～18854（由 workers.conf 定义）
- **启动**：`start-worker.sh` 拉起 gateway，再 `node openclaw.mjs tui` 弹终端
- **配置**：每卦 `hexes/agents/{hexId}/moltbot.json`
- **产出路径**：`{stateDir}/workspace/output/{projectId}/`

### 3. 面板（panel-web/）

- **server.js**：Express 服务，提供 REST API
- **public/**：静态前端（index.html 主面板、projects.html 项目列表、project.html 项目详情）
- **data/**：聊天历史 `chat_{mode}_{projectId}.json`、项目记忆 `project_memory_{id}.json`

## 三、数据流

### 与阴对话

```
前端 → POST /api/yin/chat
     → server 构建 messages，POST 阴网关 http://127.0.0.1:18789/v1/chat/completions
     → 返回 taskId，前端轮询 GET /api/yin/task/:taskId
     → 完成后保存到 panel-web/data/chat_yin_{projectId}.json
```

### 与卦对话

```
前端 → POST /api/hex/chat
     → server 向各卦网关 POST /v1/chat/completions（或 HTTP 群聊）
     → 返回 taskId，前端轮询 GET /api/hex/task/:taskId
     → 完成后保存到 panel-web/data/chat_discuss_* 或 chat_single_*
```

### 卦 Agent 任务（工具执行）

```
前端 → POST /api/hex/agent-task
     → server WebSocket 连接卦网关，发送 agent 命令
     → 卦执行工具（读文件、写文件等），返回结果
     → 前端轮询 GET /api/hex/agent-task/:taskId
```

## 四、配置与端口

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 面板端口 | 3999 | config.json |
| 阴主网关 | 18789 | 固定 |
| 卦起始端口 | 18791 | workers.conf |
| API Key | - | config.json，同步到 yin/hex moltbot.json |

## 五、会话与存储

- **面板聊天**：`panel-web/data/chat_{mode}_{projectId}.json`，mode 为 discuss/single/yin
- **openclaw TUI**：各 agent 的 stateDir 下 sessions，格式由 openclaw 内部定义
- **当前**：面板对话与终端 TUI 独立，未共用同一 session（见使用手册「此处对话与终端独立」）
- **未来**：可考虑让面板与 TUI 读写同一 chat history，实现讨论后直接执行

## 六、API 概览

| 分类 | 接口示例 |
|------|----------|
| 配置 | GET/POST /api/config |
| 技能 | GET /api/skills |
| 项目 | GET/POST/PUT/DELETE /api/projects |
| 卦 | GET /api/robots, POST /api/open-tui/:robot, POST /api/stop/:robot |
| 阴对话 | POST /api/yin/chat, GET /api/yin/task/:taskId |
| 卦对话 | POST /api/hex/chat, GET /api/hex/task/:taskId |
| 卦 Agent | POST /api/hex/agent-task, GET /api/hex/agent-task/:taskId |
| 聊天历史 | GET/POST/DELETE /api/chat-history/:projectId/:mode |
| 项目记忆 | GET/POST/PUT/DELETE /api/project-memory/:id |

## 七、终端复用逻辑

- 启动阴/卦时，若 `.panel-window-{robot}` 文件存在且对应 Terminal 窗口仍在，则**激活该窗口**，不重复开窗
- 若窗口已关闭，删除陈旧 ID 文件后重新打开新终端

## 八、阳与技能组装

- **阳**：点击阳眼进入 `yang.html`，按项目为卦配置技能。
- **project.hexSkills**：`{ hexId: [skill1, skill2] }`，项目级存储。
- **挂载**：agent-task 执行前，根据 `project.hexSkills` 将 `skills/{skillId}/` 复制到卦的 `workspace/skills/`。

## 九、链接

- [使用手册](USER_GUIDE.zh.md)
- [技能来源](SKILL_SOURCES.zh.md)
- [README](../README.zh.md)
