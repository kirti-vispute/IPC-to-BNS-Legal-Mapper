@echo off
title NLP Project Server
cd /d "%~dp0"
set "PORT=3001"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm were not found in PATH.
  pause
  exit /b 1
)

echo Starting the project at http://localhost:%PORT%/
npm start
if errorlevel 1 (
  echo.
  echo The project stopped with an error.
  pause
)
