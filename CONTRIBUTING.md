# 贡献指南

本仓库是基于 [goldct/openswarm](https://github.com/goldct/openswarm) 的 SaaS 扩展，目前处于预发布阶段。[English](CONTRIBUTING.en.md)

## 获取代码与检查

Fork 本仓库后克隆你的 fork；直接检查当前仓库可执行：

```bash
git clone https://github.com/zuixi01/OpenSwarm-SaaS.git
cd OpenSwarm-SaaS
git switch -c fix/your-change
node scripts/check-repository.js
node --test scripts/check-repository.test.js
cd panel-web
npm ci --ignore-scripts
npm run check
npm run test:smoke
npm start
```

使用 Node.js 22.12+ 和 npm。CI 覆盖 Node.js 22、24。面板地址默认为 <http://localhost:3999>；停止时按 Ctrl+C。完整 OpenClaw runtime 需从仓库根目录执行 `bash install.sh`；SaaS 数据库与环境变量加载见 [README](README.zh.md)。

根目录的 repository 检查防止当前工作树重新混入运行数据或敏感文件，配套测试验证其规则；它不审查全部 Git 历史。`npm run check` 依次运行 JavaScript 语法检查、OpenAPI 文档结构检查和自动测试；OpenAPI 检查目前解析文档并核对四个必需路径，不是完整 API 契约验证。`npm run test:smoke` 在临时干净目录中验证面板启动、健康检查、首页与 token 认证。通过这些检查仍需验证改动涉及的实际行为。数据库、外部模型和多 runtime 场景需要单独环境；没有执行时请在 PR 中说明。

## 报告问题

先搜索 [当前仓库 Issues](https://github.com/zuixi01/OpenSwarm-SaaS/issues)。普通 bug 请提供复现步骤、预期与实际行为、操作系统、Node.js 版本及脱敏日志。不要附带 API Key、Cookie、token、数据库连接串或完整 `.env`。

安全漏洞请按 [安全策略](SECURITY.md) 私下报告，不要提交公开 Issue 或公开复现材料。

## 提交 Pull Request

保持修改聚焦，遵循所在文件现有风格。行为改变时补充相关文档，并按风险添加能验证边界或回归的测试。不要提交生成的 runtime、用户数据、日志或凭据。

PR 描述应说明问题、修改后的行为、实际运行的检查及未覆盖的场景。可使用 `fix:`、`feat:`、`docs:`、`test:` 等提交前缀。避免将不相关格式化或重构混入修复。

## 许可与协作

提交贡献前请确认你有权提供代码，且贡献可按本仓库的 [GPL-3.0-or-later](LICENSE) 许可分发；保留上游及第三方署名和许可证。对讨论对象保持尊重，针对事实和代码交流。
