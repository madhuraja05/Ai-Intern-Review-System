@echo off
setlocal
echo ===================================================
echo Starting AI Intern Review & Task Automation System
echo ===================================================

:: Ensure node in path if installed in local programs
if exist "%LOCALAPPDATA%\Programs\nodejs" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)

echo Starting Backend Server on http://localhost:5000...
start "InternOps Backend" cmd /k "cd /d %~dp0server && node server.js"

timeout /t 2 /nobreak >nul

echo Starting Frontend on http://localhost:3000...
start "InternOps Frontend" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo Application running!
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:5000
echo ===================================================
pause
