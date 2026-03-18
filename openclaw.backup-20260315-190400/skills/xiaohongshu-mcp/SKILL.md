# 小红书 MCP 技能

通过 MCP (Model Context Protocol) 协议直接访问和操作小红书数据，实现自动化内容运营。

## 功能概述

本技能让你能够通过 AI 助手直接：
- 发布图文和视频内容
- 搜索和浏览小红书内容
- 与用户互动（评论、点赞、收藏）
- 获取数据分析和用户洞察

## 安装部署

### 方式一：Docker 部署（推荐）

```bash
# 拉取镜像
docker pull xpzouying/xiaohongshu-mcp

# 使用 Docker Compose 启动
wget https://raw.githubusercontent.com/xpzouying/xiaohongshu-mcp/main/docker/docker-compose.yml
docker compose up -d
```

### 方式二：下载预编译二进制

从 [GitHub Releases](https://github.com/xpzouying/xiaohongshu-mcp/releases) 下载对应平台的二进制文件。

### 方式三：源码编译

需要 Go 环境：
```bash
go env -w GOPROXY=https://goproxy.cn,direct
go run .
```

## 服务地址

启动后，MCP 服务运行在：
```
http://localhost:18060/mcp
```

## 首次登录

必须先登录小红书账号：
```bash
./xiaohongshu-login-darwin-arm64
```

## MCP 工具列表

| 工具名 | 功能描述 |
|--------|----------|
| `check_login_status` | 检查登录状态 |
| `publish_content` | 发布图文内容 |
| `publish_with_video` | 发布视频内容 |
| `list_feeds` | 获取推荐列表 |
| `search_feeds` | 搜索内容 |
| `get_feed_detail` | 获取帖子详情 |
| `post_comment_to_feed` | 发表评论 |
| `reply_comment_in_feed` | 回复评论 |
| `like_feed` | 点赞/取消点赞 |
| `favorite_feed` | 收藏/取消收藏 |
| `user_profile` | 获取用户主页 |

## 小红书运营规则

- **标题**：不超过 20 个字
- **正文**：不超过 1000 个字
- **发帖量**：每天建议控制在 50 篇以内
- 图文内容的流量通常比视频和纯文字更好
- 同一账号不能在多个网页端同时登录

## 更多信息

- GitHub: https://github.com/xpzouying/xiaohongshu-mcp
