# OpenSwarm 技术路线图

> 阴 = 运行时 + 枢纽 | 阳 = 配置 Agent (ClawDBot) | 员工 = 执行单元

## 一、目标架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        阴 (Yin)                                  │
│  Gateway · Scheduler · Trigger Router · Config Store · Memory    │
│  API 大门 · 定时闹钟 · 触发路由 · 配置存储 · 记忆服务              │
└────────────────────────────┬────────────────────────────────────┘
                             │ 调度 / 触发 / 注入
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │  员工 A   │         │  员工 B   │         │  员工 C   │
    │ Skill   │         │ Skill   │         │ Skill   │
    │ Tool    │         │ Tool    │         │ Tool    │
    └─────────┘         └─────────┘         └─────────┘
         ▲                   ▲                   ▲
         └───────────────────┼───────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                        阳 (Yang)                                 │
│  ClawDBot Agent：根据项目描述自动配置 Skill/Schedule/Trigger/...  │
└─────────────────────────────────────────────────────────────────┘
```

## 二、能力清单

| 能力 | 阴（Yin） | 阳（Yang） | 员工（Hex） |
|------|-----------|------------|-----------|
| **Skill** | 运行时挂载、注入 | 自动推理配置 | 执行 |
| **Schedule** | 调度器执行 | 自动推理配置 | 被触发执行 |
| **Trigger** | 接收并路由 | 自动推理配置 | 被触发执行 |
| **Plugin/Tool** | 运行时加载 | 自动推理配置 | 执行 |
| **Workflow** | 编排引擎 | 自动推理配置 | 执行 |
| **Config** | 存储与注入 | 自动推理配置 | 读取 |
| **Memory** | 记忆服务 | 自动推理配置 | 读写 |
| **API** | 对外大门 | 配置权限 | 被调用 |

## 三、分阶段实现

---

### 阶段 0：现状梳理（已完成）

- [x] 阴：Gateway、TUI、worker 管理
- [x] 阳：技能组装 UI（手动勾选）
- [x] 员工：skill 挂载、任务执行
- [x] 项目：hexIds、hexSkills、tasks

---

### 阶段 1：Config 统一与阴可视化基础

**目标**：统一项目/员工配置存储，在项目页展示阴的基础能力

**1.1 数据模型扩展**

- `project.config`：项目级配置（env、密钥占位、自定义键值）
- `project.hexConfig`：`{ hexId: { key: value } }` 员工级配置
- 保留 `project.hexSkills`，与 config 分离

**1.2 阴可视化 - 项目页 Dashboard**

- 在 `project.html` 增加「阴 · 控制台」卡片
- 展示：当前项目配置、员工技能列表、员工配置概览
- 预留：Schedule、Trigger、API、Memory 占位区块（后续实现）

**1.3 API**

- `GET/PUT /api/projects/:id` 支持 `config`、`hexConfig`
- `GET /api/projects/:id/yin-status` 返回阴可展示的汇总数据

**产出**：项目页可看到「阴」的配置与能力概览

---

### 阶段 2：Schedule 定时 ✅

**目标**：阴支持定时任务，项目页可配置与查看

**2.1 数据模型**

- `project.schedules`：`[{ id, cron, name, hexId?, taskId?, enabled }]`

**2.2 阴服务**

- 在 `panel-web/server.js` 或独立 `scheduler.js` 内使用 `node-cron`
- 按 project.schedules 注册 cron，到期触发对应员工的 task

**2.3 阳 UI**

- 项目页「定时」区块：列表、新增、编辑、删除
- 支持 cron 表达式或简单预设（每日 9:00、每小时等）

**2.4 API**

- `PUT /api/projects/:id` 支持 `schedules`
- `POST /api/projects/:id/schedules/:scheduleId/trigger` 手动触发（测试用）

**产出**：项目可配置定时任务，阴按时触发员工执行

---

### 阶段 3：Trigger 触发 ✅

**目标**：阴支持 webhook、事件触发，项目页可配置

**3.1 数据模型**

- `project.triggers`：`[{ id, type: 'webhook'|'event', path?, event?, hexId?, taskId?, enabled }]`

**3.2 阴服务**

- 新增 `POST /api/webhooks/:projectId/:triggerId` 接收 webhook
- 触发时查找 project.triggers，匹配后 dispatch 到对应员工

**3.3 阳 UI**

- 项目页「触发」区块：webhook 列表、复制 URL、启用/禁用

**3.4 API**

- `PUT /api/projects/:id` 支持 `triggers`
- 生成 webhook URL 供外部调用

**产出**：外部系统可通过 webhook 触发项目内员工执行

---

### 阶段 4：阳 ClawDBot 配置 Agent ✅

**目标**：阳从手动 UI 升级为 OpenClaw agent，自动推理配置

**4.1 阳 Agent 部署**

- 方案 A：复用 Yin 的 OpenClaw，增加「阳」模式/入口
- 方案 B：独立 agent 实例，专门跑配置任务

**4.2 阳 Agent 技能**

- 读：项目描述、任务列表、员工列表、技能库、schedule/trigger 模板
- 写：调用 `PUT /api/projects/:id` 更新 hexSkills、schedules、triggers、config

**4.3 触发时机**

- 项目创建时：用户填写描述 → 调用阳 agent → 输出初始配置
- 项目编辑时：用户点击「阳 · 重新配置」→ 触发 agent 推理

**4.4 阳 UI 调整**

- 保留手动勾选作为「微调」入口
- 增加「阳 · 自动配置」按钮，调用 agent 后展示/对比差异

**产出**：用户描述需求，阳自动配置 skill/schedule/trigger，无需逐一手动选择

---

### 阶段 5：Workflow 流程 ✅

**目标**：支持任务链 A→B→C，阴负责编排

**5.1 数据模型**

- `project.workflows`：`[{ id, name, steps: [{ hexId, taskId, next? }] }]`

**5.2 阴服务**

- 员工任务完成时，检查是否在 workflow 的 steps 中
- 若有 next，自动触发下一员工的 task

**5.3 阳 UI**

- 项目页「流程」区块：简单 DAG 或链式展示

**产出**：项目可配置任务流，员工按顺序执行

---

### 阶段 6：Memory 与 API 扩展 ✅

**目标**：阴提供记忆服务、对外 API 大门

**6.1 Memory**

- 阴：提供简单 KV 或向量存储接口
- 员工：通过 skill 读/写 memory

**6.2 API**

- 阴：`/api/projects/:id/run` 对外暴露，支持 token 鉴权
- 项目页展示 API 端点、调用示例

**产出**：员工可持久化记忆，外部系统可调用阴 API 触发任务

---

## 四、实施顺序建议

| 阶段 | 名称 | 预估工作量 | 依赖 |
|------|------|------------|------|
| 1 | Config 统一 + 阴可视化 | 1–2 天 | 无 |
| 2 | Schedule 定时 | 1–2 天 | 阶段 1 |
| 3 | Trigger 触发 | 1–2 天 | 阶段 1 |
| 4 | 阳 ClawDBot | 2–3 天 | 阶段 1 |
| 5 | Workflow 流程 | 2 天 | 阶段 2、3 |
| 6 | Memory + API | 2–3 天 | 阶段 1 |

---

## 五、文件与模块规划

```
openswarm/
├── panel-web/
│   ├── server.js              # 扩展：scheduler、webhook、trigger 路由
│   ├── scheduler.js            # 新建：定时调度（可选独立）
│   ├── public/
│   │   ├── project.html       # 扩展：阴可视化 dashboard
│   │   ├── yang.html          # 保留手动微调，增加「阳自动配置」入口
│   │   └── ...
│   └── data/
│       └── projects.json      # 扩展：config, hexConfig, schedules, triggers, workflows
├── yang-agent/                # 新建：阳 ClawDBot 配置 agent（可选独立目录）
│   ├── moltbot.json
│   └── workspace/
│       └── skills/
│           └── yang-config/
│               └── SKILL.md   # 配置推理技能
├── skills/
│   └── skills.json            # 已有
└── docs/
    └── ROADMAP.md             # 本文档
```

---

## 六、下一步（阶段 1–6 已完成）

1. **修复与验证**：员工·技能加载失败时显示重试、阴网关未启动时阳配置提示 ✅
2. **Config 可编辑**：阴控制台配置卡片支持编辑键值对 ✅
3. **文档**：补充阴控制台、阳、API 使用说明 ✅

完整技术路线见 [TECH_ROADMAP.md](TECH_ROADMAP.md)。
