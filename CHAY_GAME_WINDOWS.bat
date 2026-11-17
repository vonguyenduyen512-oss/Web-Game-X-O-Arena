@echo off
setlocal
cd /d "%~dp0"
if not exist "server\package.json" (
 echo Khong tim thay thu muc server. Hay giai nen day du ZIP.
 pause
 exit /b 1
)
if not exist "client\package.json" (
 echo Khong tim thay thu muc client. Hay giai nen day du ZIP.
 pause
 exit /b 1
)
where node >nul 2>&1 || (echo Chua cai Node.js. & pause & exit /b 1)
start "X-O Arena Backend" cmd /k "cd /d ""%~dp0server"" && if not exist node_modules call npm ci && npm start"
start "X-O Arena Frontend" cmd /k "cd /d ""%~dp0client"" && if not exist node_modules call npm ci && npm run dev"
echo Da mo hai cua so Backend va Frontend.
echo Mo http://localhost:5173/login sau khi Vite hien Ready.
pause
