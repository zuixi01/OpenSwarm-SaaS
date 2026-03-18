# 贡献指南

感谢您对 OpenSwarm 项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请：

1. 检查 [Issues](https://github.com/goldct/openswarm/issues) 中是否已有相关问题
2. 如果没有，请创建新的 Issue，包含：
   - 清晰的问题描述
   - 复现步骤
   - 预期行为和实际行为
   - 环境信息（操作系统、Node.js 版本等）
   - 相关日志或截图

### 提交代码

1. **Fork 项目**
   ```bash
   git clone https://github.com/your-username/openswarm.git
   cd openswarm
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **开发**
   - 遵循项目的代码风格
   - 添加必要的注释
   - 确保代码可以正常运行

4. **测试**
   - 测试您的更改
   - 确保没有破坏现有功能

5. **提交**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   # 或
   git commit -m "fix: 修复问题描述"
   ```

6. **推送并创建 Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   然后在 GitHub 上创建 Pull Request

## 代码规范

### JavaScript/Node.js

- 使用 2 空格缩进
- 使用单引号（除非字符串中包含单引号）
- 添加必要的注释，特别是复杂逻辑
- 函数和变量使用有意义的名称

### 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整（不影响功能）
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

示例：
```
feat: 添加项目管理功能
fix: 修复端口检测问题
docs: 更新 README 安装说明
```

## 开发环境设置

1. **克隆项目**
   ```bash
   git clone https://github.com/goldct/openswarm.git
   cd openswarm
   ```

2. **安装依赖**
   ```bash
   ./install.sh
   cd panel-web
   npm install
   ```

3. **启动开发环境**
   ```bash
   ./start-panel.sh
   ```

4. **测试**
   ```bash
   # 如果添加了测试文件
   npm test
   ```

## 项目结构

```
openswarm/
├── panel-web/          # Web 面板后端和前端
│   ├── server.js       # Express 服务器
│   └── public/         # 前端页面
├── yin/                # Main gateway node
│   └── workspace/      # 工作目录和技能
├── hex-template/       # 员工模板
├── install.sh          # 安装脚本
└── README.md           # 项目说明
```

## Pull Request 流程

1. 确保您的代码可以正常运行
2. 确保代码符合项目规范
3. 更新相关文档（如果需要）
4. 创建 Pull Request，包含：
   - 清晰的标题和描述
   - 相关 Issue 编号（如果有）
   - 测试说明

## 问题反馈

如果您在贡献过程中遇到问题，可以：

- 在 Issues 中提问
- 查看现有文档
- 联系维护者

## 行为准则

请保持友好和尊重。我们致力于为所有人提供一个开放和欢迎的环境。

---

再次感谢您的贡献！🎉
