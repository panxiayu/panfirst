@echo off
echo ==================== 部署到Linux ====================
echo.
echo 1. 拉取最新代码
ssh -p 2222 openclaw@192.168.110.22 "cd /home/openclaw/apps/server && git pull origin master"
echo.
echo 2. 安装依赖
ssh -p 2222 openclaw@192.168.110.22 "cd /home/openclaw/apps/server && npm install"
echo.
echo 3. 重启服务
ssh -p 2222 openclaw@192.168.110.22 "cd /home/openclaw/apps/server && pm2 restart exam-system 2>/dev/null || pm2 start src/index.js --name exam-system"
echo.
echo 4. 检查服务状态
ssh -p 2222 openclaw@192.168.110.22 "pm2 list"
echo.
echo ==================== 完成 ====================
pause
