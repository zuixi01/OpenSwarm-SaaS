#!/bin/bash
# 双击启动 OpenSwarm 面板（可把本文件复制到桌面，方便点击启动）
cd "/Users/gold/Desktop/OpenSwarm"
(sleep 3 && open "http://localhost:3999") &
./start-panel.sh
read -n 1 -s -r -p "按任意键关闭本窗口..."
