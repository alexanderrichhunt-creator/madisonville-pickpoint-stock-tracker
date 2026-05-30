@echo off
title Encode Google Service Account Key for Render
cd /d "%~dp0"

echo.
echo  Paste the path to your downloaded Google service account JSON file.
echo  Example: C:\Users\alexa\Downloads\my-project-abc123.json
echo.
set /p KEYPATH="JSON file path: "

if not exist "%KEYPATH%" (
  echo.
  echo ERROR: File not found: %KEYPATH%
  pause
  exit /b 1
)

echo.
echo Copy everything below this line into Render as GOOGLE_SERVICE_ACCOUNT_JSON:
echo ================================================================
powershell -NoProfile -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('%KEYPATH%'))"
echo ================================================================
echo.
echo Or paste the raw JSON file contents instead (often works on Render too).
echo.
pause
