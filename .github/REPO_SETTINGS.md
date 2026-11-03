# 仓库公开前的 GitHub 设置

本文件记录维护者待执行事项，不表示这些设置已经生效。修改仓库可见性、发布 Release 和变更安全设置应由有权限的维护者审阅后执行。

仓库：<https://github.com/zuixi01/OpenSwarm-SaaS>

## 公开前

1. 完成 [发布检查清单](../docs/RELEASE_CHECKLIST.md)，尤其是历史秘密审查与上游许可保留。
2. 在 Settings → Code security 中启用 **Private vulnerability reporting**，并验证用户可从 Security 页面私下报告漏洞。若当前可见性不提供该设置，在公开时立即启用并验证；未验证前不要对外发布使用公告。
3. 确认 Issues 和 Pull requests 可用于普通问题与贡献；核对模板中的链接指向本仓库。
4. About 描述建议为：`Experimental multi-tenant SaaS extension of OpenSwarm, with an OpenClaw control panel and agent runtimes.`
5. Topic 可按实际功能填写：`openclaw`、`multi-agent`、`saas`、`self-hosted`。不要使用未经验证的生产成熟度或容量描述。

## 首次 Release

在 [本仓库 Releases](https://github.com/zuixi01/OpenSwarm-SaaS/releases) 创建与实际提交对应的新标签，并勾选 **Set as a pre-release**。不要复用上游历史版本号表示本 fork 已有稳定版。

发布说明应列出本次实际变更、支持环境、验证结果、未验证范围和升级注意事项。只有完成验收的内容才能写成已支持功能。GitHub 仓库公开与发布 Release 是独立操作，本文档不自动执行它们。
