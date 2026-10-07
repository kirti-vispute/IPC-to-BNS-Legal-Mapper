@echo off
title NLP Project Frontend
cd /d "%~dp0"
set "FRONTEND_PORT=3000"
set "BACKEND_PORT=3001"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found in PATH.
  pause
  exit /b 1
)

echo Start Run Backend.cmd in another Command Prompt first.
node scripts\frontend_proxy.mjs
if errorlevel 1 (
  echo.
  echo The frontend preview stopped with an error.
  pause
)
