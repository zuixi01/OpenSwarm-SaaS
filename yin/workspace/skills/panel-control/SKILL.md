---
name: panel-control
description: "Control the panel API to manage hexagrams (64 claws), projects, start/stop robots. Use when you need to create projects, select hexagrams for projects, start/stop hexagrams, or query robot/project status."
metadata: {"moltbot":{"emoji":"🎛️","requires":{"bins":[]},"install":[]}}
---

# Panel Control Skill

Control the panel API to manage hexagrams (64 claws), projects, and robot lifecycle. This skill enables autonomous decision-making for project creation, hexagram selection, and team coordination.

**重要：使用moltbot的`web.fetch`工具来调用面板API，不要使用curl命令。**

## 关键原则

**识别项目上下文**：
- 如果系统消息中提供了"当前项目上下文"，说明用户正在某个项目中与你对话
- **不要新建项目**，应该在这个现有项目中操作
- 只有在用户明确要求新建项目时，才创建新项目
- 如果用户要求选员工、启动员工等操作，应该在当前项目中操作

**执行操作后必须回复用户**：
- 当你通过面板API执行任何操作（创建项目、启动员工、选择员工等）后，**必须立即回复用户**
- 告诉用户你做了什么操作，操作结果如何
- 如果操作成功，简要说明成功信息；如果失败，说明失败原因
- **不要只执行操作而不回复**，用户需要通过你的回复了解操作状态

**示例**：
```
用户：选5个员工，让他们在群里每个人讲一个笑话
你：[执行操作]
1. 使用web.fetch调用 GET /api/robots 查看可用员工
2. 使用web.fetch调用 POST /api/projects 创建项目
3. 使用web.fetch调用 PUT /api/projects/<id> 选择5个员工
4. 使用web.fetch调用 POST /api/open-tui/<hex_id> 启动每个员工
[必须回复]：好的，我已经创建了项目"笑话比赛"，选择了5个员工，并启动了它们。现在他们可以在群里讲笑话了。
```

## Panel API Base URL

Default: `http://localhost:3999` (can be overridden with `PANEL_BASE_URL` environment variable)

## Robot Status

Get all robot status (main/lan/64 hexagrams):

**使用web.fetch工具：**
```
使用web.fetch工具调用 GET http://localhost:3999/api/robots
```

Response format:
```json
[
  {"id": "main", "name": "主控", "running": false},
  {"id": "qian", "name": "数据挖掘工程师", "port": 18791, "running": true},
  ...
]
```

## Project Management

### List Projects

**使用web.fetch工具：**
```
使用web.fetch工具调用 GET http://localhost:3999/api/projects
```

### Create Project

**使用web.fetch工具：**
```
使用web.fetch工具调用 POST http://localhost:3999/api/projects
请求体: {"name": "项目名称"}
Content-Type: application/json
```

### Get Project Details

**使用web.fetch工具：**
```
使用web.fetch工具调用 GET http://localhost:3999/api/projects/<project_id>
```

### Update Project (Select Hexagrams)

**使用web.fetch工具：**
```
使用web.fetch工具调用 PUT http://localhost:3999/api/projects/<project_id>
请求体: {"hexIds": ["qian", "kun", "tai"]}
Content-Type: application/json
```

### Delete Project

**使用web.fetch工具：**
```
使用web.fetch工具调用 DELETE http://localhost:3999/api/projects/<project_id>
```
注：id 为 `hex-definition` 的「员工的自定义」项目不可删除。

### Write Hex Definition (员工的自定义)

为指定员工写入其人设定义（写入该员工 workspace 下的 `我的定义.md`）。可用于在「员工的自定义」场景下由阴替员工更新定义。

**使用web.fetch工具：**
```
使用web.fetch工具调用 POST http://localhost:3999/api/agent-definition/<hex_id>
请求体: {"content": "员工的我的定义.md 的完整内容（Markdown）"}
Content-Type: application/json
```
示例：`POST http://localhost:3999/api/agent-definition/qian` 会写入数据挖掘工程师的 `workspace/我的定义.md`。

## Robot Control

### Start Robot

Start a robot (main/lan/hexagram id like "qian"):

**使用web.fetch工具：**
```
使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/<robot_id>
```

Examples:
- Start 数据挖掘工程师 (qian): `使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/qian`
- Start main: `使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/main`
- Start lan: `使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/lan`

### Stop Robot

Stop a robot:

**使用web.fetch工具：**
```
使用web.fetch工具调用 POST http://localhost:3999/api/stop/<robot_id>
```

Optional body with port:
```
使用web.fetch工具调用 POST http://localhost:3999/api/stop/<robot_id>
请求体: {"port": 18791}
Content-Type: application/json
```

## Hexagram Name Mapping

64 hexagrams map to robot IDs as follows:

| 员工名 | Robot ID | Port |
|------|----------|------|
| 乾 | qian | 18791 |
| 坤 | kun | 18792 |
| 泰 | tai | 18793 |
| 否 | pi | 18794 |
| 谦 | xun | 18795 |
| 豫 | yu | 18796 |
| 随 | sui | 18797 |
| 蛊 | gu | 18798 |
| 临 | lin | 18799 |
| 观 | guan | 18800 |
| ... | h11-h64 | 18801-18854 |

## Usage Examples

### Autonomous Project Creation

When a user requests a new project, you should:

1. **Query current status**:
   ```
   使用web.fetch工具调用 GET http://localhost:3999/api/robots
   然后分析返回的JSON，找出running为false的员工
   
   使用web.fetch工具调用 GET http://localhost:3999/api/projects
   查看现有项目列表
   ```

2. **Create project**:
   ```
   使用web.fetch工具调用 POST http://localhost:3999/api/projects
   请求体: {"name": "数据分析项目"}
   Content-Type: application/json
   ```

3. **Select hexagrams**:
   ```
   使用web.fetch工具调用 PUT http://localhost:3999/api/projects/p1
   请求体: {"hexIds": ["qian", "kun", "tai"]}
   Content-Type: application/json
   ```

4. **Start selected hexagrams**:
   ```
   使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/qian
   使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/kun
   使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/tai
   ```

### Team Coordination

Coordinate multiple hexagrams for a project:

```
1. 使用web.fetch工具调用 GET http://localhost:3999/api/robots
   分析返回的JSON，找出name为"乾"、"坤"、"泰"的员工

2. 逐个启动员工：
   使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/qian
   使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/kun
   使用web.fetch工具调用 POST http://localhost:3999/api/open-tui/tai
```

## Error Handling

- Check HTTP status codes: `200`/`201` = success, `404` = not found, `500` = server error
- Parse JSON responses from web.fetch工具的返回结果
- Handle connection errors gracefully (panel might not be running)
- If web.fetch returns an error, check if panel is running on port 3999

## Important Notes

- **必须使用web.fetch工具**，不要尝试执行curl命令
- Panel must be running on port 3999 (or configured `PANEL_BASE_URL`)
- All API calls are unauthenticated (local use)
- Robot IDs use lowercase pinyin for hexagram names (qian, kun, tai, etc.)
- Main and LAN use IDs "main" and "lan" respectively

## How to Use This Skill

When you need to control the panel API:

1. **Identify the task**: What do you need to do? (create project, start hexagram, etc.)
2. **Use web.fetch tool**: Call the appropriate API endpoint using the web.fetch tool
3. **Parse response**: Analyze the JSON response to understand the result
4. **Take next action**: Based on the response, decide what to do next

Example workflow:
- User: "创建一个数据分析项目，选择三个员工"
- You: 
  1. Use web.fetch to GET /api/projects (check existing projects)
  2. Use web.fetch to POST /api/projects with {"name": "数据分析项目"}
  3. Get the project ID from response
  4. Use web.fetch to PUT /api/projects/{id} with {"hexIds": ["qian", "kun", "tai"]}
  5. Use web.fetch to POST /api/open-tui/qian, /api/open-tui/kun, /api/open-tui/tai
