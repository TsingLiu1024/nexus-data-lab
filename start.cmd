@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install Node.js and try again.
  pause
  exit /b 1
)
node scripts\start.mjs
set "nexus_exit_code=%errorlevel%"
if not "%nexus_exit_code%"=="0" pause
exit /b %nexus_exit_code%
