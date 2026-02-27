# Windows 使用说明（WSL）

Yinova 在 Windows 上通过 **WSL**（Windows Subsystem for Linux）运行，推荐使用 **Ubuntu on WSL**，与 Linux 体验一致。

## 一、前置条件

1. **安装 WSL（推荐 Ubuntu）**
   - 以管理员身份打开 PowerShell，执行：
   ```powershell
   wsl --install
   ```
   - 重启后按提示完成 **Ubuntu** 发行版安装（默认会安装 Ubuntu）
   - 详见：[微软 WSL 文档](https://docs.microsoft.com/zh-cn/windows/wsl/install)

2. **安装 Node.js 18+**
   - 在 WSL 终端中执行：
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
   - 或使用 nvm：`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`

## 二、安装与启动

1. **克隆项目**（在 WSL 终端中）
   ```bash
   cd ~
   git clone https://github.com/goldct/yinova && cd yinova
   # 国内用户: git clone https://gitee.com/goldct/yinova && cd yinova
   ```

2. **安装**
   ```bash
   chmod +x install.sh start-panel.sh
   ./install.sh
   ```

3. **启动**
   ```bash
   ./start-panel.sh
   ```
   或双击项目根目录下的 `start-panel.bat`（会调用 WSL 启动）

4. **打开浏览器**
   - 访问 http://localhost:3999

## 三、路径说明

- 项目建议放在 WSL 文件系统内（如 `~/yinova`），避免 Windows 路径带来的权限和性能问题
- 若放在 Windows 盘（如 `/mnt/c/Users/xxx/yinova`），部分功能可能受影响，建议用 `\\wsl$\Ubuntu\home\用户名\yinova` 访问

## 四、常见问题

- **端口被占用**：在 WSL 中 `lsof -i :3999` 查看，或配置页点击「检测端口占用」
- **Node 未找到**：确保在 WSL 终端中操作，且 `node -v` 能输出版本号
- **浏览器打不开**：手动在 Windows 浏览器输入 http://localhost:3999
- **点击「阴·启动」无反应 / 终端不弹出**：面板已支持 Windows 与 Linux/WSL。若在 Windows 上从 Git Bash 启动面板，点击阴会尝试用 `start bash` 打开新窗口；若仍无反应，请手动在终端执行 `bash yin/start-yin.sh` 启动阴网关。
