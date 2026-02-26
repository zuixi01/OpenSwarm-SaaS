---
name: filesystem
description: "本地文件读写（MCP）。Read/write local files in workspace."
metadata: {"moltbot":{"emoji":"📁","requires":{"bins":[]},"install":["npx -y @modelcontextprotocol/server-filesystem <path>"]}}
---

# Filesystem Skill

Read and write files in the workspace directory.

**When to use**: User needs to create, read, or modify files in the project.

**How**: Use read/write tools. Paths are relative to workspace. Output files go to workspace/output/{projectId}/.
