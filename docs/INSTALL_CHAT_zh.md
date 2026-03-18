# OpenSwarm 群聊/转发用 — 中文

---

OpenSwarm 六十四员工控制台，一键安装、开箱即用。

**环境**：macOS / Linux / Windows(WSL)，Node.js 18+、npm

**安装（复制下面整段到终端执行，国内推荐 Gitee）：**

GitHub：
```
git clone https://github.com/goldct/openswarm && cd openswarm
chmod +x install.sh start-panel.sh
./install.sh
```

Gitee（国内，推荐）：
```
git clone https://gitee.com/goldct/openswarm && cd openswarm
chmod +x install.sh start-panel.sh
./install.sh
```

**已安装用户更新**（注意：`cd openswarm` 与 `git pull` 之间要有空格或换行，勿写成 `cd openswarmgit pull`）：
```
cd openswarm
git pull
cd panel-web && npm install && cd ..
./start-panel.sh
```

**启动（复制下面一行）：**

```
./start-panel.sh
```

浏览器打开 http://localhost:3999 ，首次会进配置页，选厂商、填 API Key 保存即可。Mac 也可双击 `start-panel.command` 启动。

**GitHub 拉取失败？**（如报错 `Error in the HTTP2 framing layer`）→ 改用 Gitee 克隆或拉取，国内网络更稳定。

---
