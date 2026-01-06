@echo off
echo ============================================
echo T-Link Backend Server Diagnostic
echo ============================================
echo.

cd /d "%~dp0backend"

echo Checking Node.js version...
node --version
echo.

echo Checking TypeScript compilation...
npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: TypeScript compilation failed!
    pause
    exit /b 1
)
echo TypeScript compilation successful!
echo.

echo Testing database connection...
node -e "require('dotenv').config(); const { Pool } = require('pg'); const pool = new Pool({host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD}); pool.query('SELECT NOW()').then(r => {console.log('DB Connected! Time:', r.rows[0].now); process.exit(0);}).catch(e => {console.error('DB Error:', e.message); process.exit(1);});"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Database connection failed!
    echo.
    echo Check your .env file for correct database credentials:
    echo   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
    pause
    exit /b 1
)
echo.

echo Checking if port 5000 is available...
netstat -ano | findstr ":5000" | findstr "LISTENING"
if %ERRORLEVEL% EQU 0 (
    echo WARNING: Port 5000 is already in use!
    echo.
    netstat -ano | findstr ":5000" | findstr "LISTENING"
    echo.
    echo Attempting to kill the process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
    timeout /t 2 /nobreak > nul
)
echo.

echo ============================================
echo Starting Backend Server...
echo ============================================
echo.
echo Server will start on: http://0.0.0.0:5000
echo Network access: http://10.0.0.41:5000
echo.
echo Press Ctrl+C to stop the server
echo ============================================
echo.

npx nodemon --exec npx ts-node src/server.ts

echo.
echo Server stopped.
pause
