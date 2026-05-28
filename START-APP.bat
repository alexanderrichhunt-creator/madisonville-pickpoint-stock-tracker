@echo off
title Madisonville PickPoint Stock Tracker
cd /d "%~dp0"

echo.
echo  ============================================
echo   Madisonville PickPoint Stock Tracker
echo  ============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed.
  echo.
  echo Please install Node.js from https://nodejs.org
  echo Choose the LTS version, install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies... this may take 1-2 minutes.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
  echo.
  echo Dependencies installed successfully!
  echo.
)

echo Starting the app...
echo.
echo  Open your browser to:  http://localhost:3000
echo.
echo  Press Ctrl+C to stop the server.
echo.

start "" "http://localhost:3000"
call npm run dev

pause
