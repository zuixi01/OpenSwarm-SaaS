# 手动推送与发布教程

当 `git push` 因网络问题失败时，可按以下步骤手动操作。

---

## 一、推送代码到 GitHub

### 步骤 1：打开终端，进入项目目录

```bash
cd /Users/gold/Desktop/Yinova
```

**重要**：必须在 Yinova 目录下执行，否则会推错仓库。

### 步骤 2：确认当前状态

```bash
git status
git branch
git remote -v
```

- `git branch` 应显示 `* master`
- `git remote -v` 中 origin 应指向 `goldct/yinova`

### 步骤 3：推送

```bash
git push origin master
git push origin v1.3.1
```

若仍报 SSL 错误，可尝试：
- 关闭 VPN 后重试
- 换手机热点
- 改用 SSH：`git remote set-url origin git@github.com:goldct/yinova.git` 后再 push

---

## 二、手动创建 GitHub Release

若代码已推送，只需补充 Release 说明：

1. 打开：https://github.com/goldct/yinova/releases/new
2. **Choose a tag**：选择 `v1.3.1`（若已有）或输入 `v1.3.1` 新建
3. **Release title**：填 `Yinova v1.3.1`
4. **Describe this release**：粘贴以下内容

```
## Windows 与 Ubuntu

- **Windows 支持**：`start-panel.bat` 双击启动，`docs/WINDOWS.md` 使用说明
- **Ubuntu**：明确支持 Ubuntu 及主流 Linux 发行版
```

5. 点击 **Publish release**

---

## 三、手动创建 Gitee Release

1. 打开：https://gitee.com/goldct/yinova/releases/new
2. **标签版本**：选择或输入 `v1.3.1`
3. **发行版名称**：填 `Yinova v1.3.1`
4. **描述**：粘贴与 GitHub 相同的内容
5. 点击 **创建发行版**

---

## 四、检查是否推送成功

- **GitHub**：https://github.com/goldct/yinova/commits/master  
  若能看到最新提交 `v1.3.1: Windows/WSL 支持...`，说明 master 已推送成功。

- **Gitee**：https://gitee.com/goldct/yinova/commits/master  
  同上。

- **Release**：  
  - GitHub：https://github.com/goldct/yinova/releases  
  - Gitee：https://gitee.com/goldct/yinova/releases  

---

## 五、常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| 源引用规格 master 没有匹配 | 不在 Yinova 目录，或当前仓库没有 master 分支 | 先 `cd /Users/gold/Desktop/Yinova` |
| SSL_ERROR_SYSCALL | 网络/代理/VPN 问题 | 换网络、关 VPN、改用 SSH |
| Error in the HTTP2 framing layer | GitHub 网络/协议问题（国内常见） | 改用 Gitee：`git remote set-url origin https://gitee.com/goldct/yinova.git` 后 `git pull` |
| cd: string not in pwd: yinovagit | 复制时 `cd yinova` 与 `git pull` 连在一起 | 分开执行：先 `cd yinova` 回车，再 `git pull`；或整段复制时确保有换行 |
| 推送到 api-monitor-saas | 当前目录是别的项目 | 确认 `pwd` 显示 Yinova 路径 |
