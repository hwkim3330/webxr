@echo off
chcp 65001 >nul
cls

echo.
echo ╔════════════════════════════════════════════╗
echo ║   WebXR Stream - Release Builder          ║
echo ╚════════════════════════════════════════════╝
echo.

REM Create release directory
if not exist "release" mkdir release

echo 📦 Building Server Package...
echo.

REM Create server package
powershell -Command "Compress-Archive -Path server.js,sender.html,receiver.html,index.html,package.json,ecosystem.config.js,start-server.bat,start-server.sh,README.md -DestinationPath release\webxr-stream-server.zip -Force"

echo ✅ Server package created: release\webxr-stream-server.zip
echo.

echo 🔨 Building Electron App (Windows)...
cd sender-app
call npm install
call npm run build:win

echo.
echo ✅ Build Complete!
echo.
echo Release files:
dir ..\release /b
dir sender-app\dist /b
echo.
pause
