# OpenSwarm SaaS Release Checklist

## P0 必须完成

### 基础认证

- [ ] `DATABASE_URL` 已配置并可连接
- [ ] `OPENSWARM_REQUIRE_USER_AUTH=1`
- [ ] `OPENSWARM_AUTH_JWT_SECRET` 已配置
- [ ] `OPENSWARM_AUTH_REFRESH_SECRET` 已配置
- [ ] `OPENSWARM_AUTH_COOKIE_SECURE=1`
- [ ] Google 登录已配置并可回调

### 数据真相源

- [ ] `projects / hex-definition / autonomy` 运行时走 DB 真相源
- [ ] `chat history / project memory` 已完成 DB 优先迁移
- [ ] 已执行 phase1/phase2/phase3 数据库迁移
- [ ] 现网租户文件已导入数据库

### 租户隔离

- [ ] 租户成员权限校验生效
- [ ] 项目数据无法跨租户读取
- [ ] 项目文件无法跨租户下载
- [ ] tenant runtime 独立启动/停止/健康检查可用

### 运行与恢复

- [ ] 面板健康检查可用
- [ ] runtime-admin 可查看租户 runtime
- [ ] runtime 回收策略已开启
- [ ] worker / main runtime 可自动重启或人工恢复

### 安全

- [ ] 所有生产密钥仅通过环境变量注入
- [ ] 不在仓库内保留生产密钥
- [ ] 登录、切租户、成员变更、runtime 启停有审计日志
- [ ] `next` 跳转已限制为站内相对路径

## P1 强烈建议上线前完成

### 用户与租户后台

- [ ] 成员邀请流程可用
- [ ] 邀请用户激活流程明确
- [ ] 租户切换 UI 可直接使用
- [ ] 角色管理 UI 可用

### 运维后台

- [ ] 告警总览可见
- [ ] 节点调度可见
- [ ] 节点容量/故障信息可见
- [ ] 审计日志 UI 可检索

### 配额与计费

- [ ] quota 后台可调
- [ ] budget / daily limit 告警可见
- [ ] 超额限制策略明确
- [ ] 欠费停用策略明确

## P2 上线后尽快补

- [ ] 邮件验证码/邀请邮件
- [ ] 密码找回
- [ ] 登录限流与风控
- [ ] 对象存储替换本地产出目录
- [ ] 日志聚合与外部告警通知
- [ ] 多节点 runtime 调度与迁移
- [ ] 自助开通租户
- [ ] 套餐购买与升级

## 当前代码对应入口

- 面板：`panel-web/server.js`
- SaaS 登录：`panel-web/routes/phase1-auth.js`
- 运行后台：`panel-web/routes/runtime-admin.js`
- 租户 runtime：`panel-web/routes/tenant-runtime.js`
- Google 登录说明：`docs/cloud-mvp/google-oauth-setup.md`
