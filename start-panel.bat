@echo off
chcp 65001 >nul
REM Yinova - Windows 启动脚本（通过 WSL 运行）
REM 双击此文件，在 WSL 中启动面板

set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for /f "delims=" %%i in ('wslpath -u "%SCRIPT_DIR%" 2^>nul') do set WSL_PATH=%%i
if "%WSL_PATH%"=="" (
  echo 无法转换路径，请确保已安装 WSL。
  echo 请手动在 WSL 终端中执行：
  echo   cd 项目目录
  echo   ./start-panel.sh
  pause
  exit /b 1
)

wsl -e bash -c "cd '%WSL_PATH%' && ./start-panel.sh"
if errorlevel 1 (
  echo.
  echo 若提示找不到 wsl，请先安装：wsl --install
  echo 若已安装，请手动在 WSL 终端中执行：
  echo   cd %WSL_PATH%
  echo   ./start-panel.sh
  pause
)
