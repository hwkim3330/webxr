@echo off
chcp 65001 >nul
cls

echo.
echo ╔════════════════════════════════════════════╗
echo ║   WebXR Stream - Server Launcher          ║
echo ╚════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo Please download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js found:
node --version
echo.

REM Check if npm packages are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Create logs directory if it doesn't exist
if not exist "logs" (
    mkdir logs
)

echo 🚀 Starting WebXR Stream Server...
echo.
echo Server will be available at:
echo   - http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo ════════════════════════════════════════════
echo.

node server.js
