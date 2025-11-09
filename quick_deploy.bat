@echo off
chcp 65001 > nul
echo.
echo ============================================================
echo   Monitor App - Quick Deploy Script
echo ============================================================
echo.
echo This script will:
echo   1. Connect to your server
echo   2. Run the automated setup
echo   3. Trigger the first deployment
echo.
echo Server: 147.93.184.62
echo Password: Alejo2026
echo.
pause

echo.
echo ============================================================
echo   Step 1: Running server setup script...
echo ============================================================
echo.
echo You will be asked for the password: Alejo2026
echo.

ssh root@147.93.184.62 "curl -sSL https://raw.githubusercontent.com/victalejo/monitor-app/main/complete-setup.sh | bash"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Setup failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Step 2: Triggering first deployment...
echo ============================================================
echo.

cd v:\monitor-app
echo # Server configured and ready ^> README.md
git add README.md
git commit -m "Trigger first deployment - server configured"
git push origin main

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to push to GitHub.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   SUCCESS! Deployment triggered
echo ============================================================
echo.
echo Monitor the deployment at:
echo https://github.com/victalejo/monitor-app/actions
echo.
echo Wait 3-5 minutes, then test:
echo curl https://monitoreo.victalejo.dev/health
echo.
pause
