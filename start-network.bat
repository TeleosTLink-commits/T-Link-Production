@echo off
echo ========================================
echo T-Link Network Deployment
echo ========================================
echo.
echo Your network IP: 10.0.0.41
echo Backend will run on: http://10.0.0.41:5000
echo Frontend will run on: http://10.0.0.41:3000
echo.
echo Other devices can access at:
echo   http://10.0.0.41:3000
echo.
echo ========================================
echo Starting servers...
echo ========================================
echo.

cd /d "%~dp0"
start cmd /k "cd backend && npm run dev"
timeout /t 5 /nobreak > nul
start cmd /k "cd frontend && npm run dev"

echo.
echo Servers are starting in separate windows...
echo Press any key to exit this window (servers will continue running)
pause > nul
