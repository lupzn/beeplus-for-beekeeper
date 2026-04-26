@echo off
REM Captures full-screen screenshot WITH cursor visible
REM Edit -Delay 5 to change countdown
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0capture-with-cursor.ps1" -Delay 5
pause
