# API 调用说明

OpenSwarm 面板提供 REST API，供外部系统触发项目内员工执行。

## 一、端点

```
POST /api/projects/:id/run
```

- **Base URL**：`http://localhost:3999`（或你的面板地址）
- **鉴权**：需在请求头携带 API Token

## 二、鉴权方式

任选其一：

1. `Authorization: Bearer $OPENSWARM_RUN_TOKEN
2. `X-API-Key: <token>`

Token 在项目页「阴 · 控制台」→ API 区块 → 点击「生成 Token」获取。

## 三、请求体

支持三种调用方式：

### 3.1 指定员工执行（hexId + message）

```json
{
  "hexId": "qian",
  "message": "执行指令内容"
}
```

### 3.2 按流程执行（workflowId）

```json
{
  "workflowId": "w1"
}
```

### 3.3 按触发规则执行（triggerId）

```json
{
  "triggerId": "t1"
}
```

## 四、示例

先在当前终端设置 `OPENSWARM_RUN_TOKEN` 为你配置的调用 token；不要把真实 token 写入文档或提交记录。

```bash
curl -X POST "http://localhost:3999/api/projects/YOUR_PROJECT_ID/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENSWARM_RUN_TOKEN" \
  -d '{"hexId":"qian","message":"检查今日数据并生成报告"}'
```

## 五、响应

- **成功**：`200`，`{ "ok": true, "type": "agent"|"workflow"|"trigger", ... }`
- **鉴权失败**：`401`，`{ "error": "鉴权失败，需提供有效的 Authorization 或 X-API-Key" }`
- **参数错误**：`400`，`{ "error": "..." }`

## 六、相关文档

- [阴控制台说明](YIN_CONSOLE.md)
- [阳配置说明](YANG.md)
