# Yinova 离线安装说明（Mac）

适合**无外网**或**不想用命令行**的用户，只需双击和填 Key。

---

## 第一步：环境检测（可选）

双击运行 **`check-env-mac.command`**，会提示本机缺什么：

- 缺 Node → 按下面第二步安装 Node
- 缺 openclaw 构建 → 需要拿到 `openclaw-offline.zip` 解压到项目目录覆盖 `openclaw` 文件夹
- 全部 ✓ → 可直接做第三步

---

## 第二步：安装 Node.js（仅首次）

1. 在项目文件夹里找到 **`node-v24.14.0.pkg`**（或你收到的其他 `node-*.pkg`）
2. **双击**该文件
3. 按提示「继续」→「安装」，完成安装

---

## 第三步：离线初始化

1. 双击 **`install-offline-mac.command`**
2. 等待窗口里出现「离线安装完成」

---

## 第四步：启动面板

1. 双击 **`start-panel.command`**
2. 几秒后浏览器会自动打开；若没有，在浏览器地址栏输入：`http://localhost:3999`
3. 首次使用：在配置页选择模型厂商、填写 API Key，保存即可使用

---

## 获取离线包

- 离线安装包（含 Node 安装包、完整 openclaw、上述脚本）可通过 **Gitee 仓库 Release** 或联系作者获取。
- 在线用户请直接使用 [README 快速开始](README.md)：`git clone` → `./install.sh` → `./start-panel.sh`。
