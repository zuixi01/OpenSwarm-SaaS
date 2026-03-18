# 发布前检查清单（GitHub / Gitee）

## 一、已完成

- [x] CHANGELOG.md / CHANGELOG.zh.md 更新至 v1.3
- [x] README.md / README.zh.md 版本号与特性更新
- [x] .gitignore 调整：docs 用户文档可提交
- [x] 文档链接：阴控制台、阳、API、部署、安全、技术路线

## 二、发布前自检

1. **本地测试**
   - `./install.sh` 无报错
   - `./start-panel.sh` 启动成功
   - 配置页填写 API Key 保存
   - 创建项目、选员工、与员工对话
   - 技能库管理、项目模板、阳应用模板

2. **Git 提交**
   ```bash
   git status
   git add .
   git commit -m "v1.3: 文档、部署、安全、技能库、项目模板、员工任务重试"
   git tag v1.3
   ```

3. **推送**
   ```bash
   git push origin master
   git push origin v1.3
   # Gitee 镜像
   git push gitee master
   git push gitee v1.3
   ```

4. **Release 说明**（可选）
   - GitHub: https://github.com/goldct/openswarm/releases/new?tag=v1.3
   - 标题：OpenSwarm v1.3
   - 描述：复制 CHANGELOG.md 中 1.3 部分

## 三、文档与链接

| 文档 | 路径 |
|------|------|
| 阴控制台 | docs/YIN_CONSOLE.md |
| 阳配置 | docs/YANG.md |
| API 调用 | docs/API.md |
| 部署运维 | docs/DEPLOY.md |
| 安全实践 | docs/SECURITY_BEST_PRACTICES.md |
| 技术路线 | docs/TECH_ROADMAP.md |
