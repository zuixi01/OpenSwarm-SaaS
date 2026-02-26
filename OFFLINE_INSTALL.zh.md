# Yinova 离线安装说明（Mac）

适合**无外网**或**不想用命令行**的用户，只需双击和填 Key。

---

## 使用前：把「环境配置包」放进 yinova 文件夹

如果你拿到的是 **「yinova安装环境配置」** 文件夹或压缩包，需要先把里面的文件放到 **yinova 项目根目录** 里再用：

1. **先有 yinova 项目**  
   若还没有：从 [GitHub](https://github.com/goldct/yinova) 或 [Gitee](https://gitee.com/goldct/yinova) 下载 yinova 源码（下载 ZIP 解压，或 git clone），得到名为 `yinova` 的文件夹。

2. **把环境配置包里的东西复制进去**  
   打开「yinova安装环境配置」文件夹，把下面这些**全部复制**到 **yinova 文件夹的根目录**（和 `install.sh`、`start-panel.sh` 同一层）：
   - `node-v24.14.0.pkg`（或任意 `node-*.pkg`）
   - `openclaw-offline.zip`
   - `install-offline-mac.command`
   - `check-env-mac.command`  
   （本说明文件 `OFFLINE_INSTALL.zh.md` 也可一并复制，方便查看。）

3. **解压 openclaw（若尚未解压）**  
   在 yinova 根目录下，用终端执行（或按后面「第一步」先做环境检测再执行）：
   ```bash
   cd ~/yinova
   rm -rf openclaw
   unzip openclaw-offline.zip -d .
   ```
   若 `openclaw-offline.zip` 在「下载」里，则：`unzip ~/Downloads/openclaw-offline.zip -d .`

做完以上，再按下面「第一步」开始。

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

- **「yinova安装环境配置」** 里只有：Node 安装包、openclaw-offline.zip、环境检测与离线安装脚本、本说明。**不含完整 yinova 源码**，需先有 yinova 项目（从 GitHub/Gitee 下载），再把本包里的文件复制进 yinova 根目录使用。
- 可通过 **Gitee 仓库 Release** 或联系作者获取该环境配置包。
- 在线用户请直接使用 [README 快速开始](README.md)：`git clone` → `./install.sh` → `./start-panel.sh`。
