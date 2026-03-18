#!/bin/bash
# Mac 双击启动 OpenSwarm 面板，并自动打开浏览器
cd "$(dirname "$0")"

# 延迟 3 秒后打开浏览器（等面板就绪）
(sleep 3 && open "http://localhost:3999") &

./start-panel.sh
