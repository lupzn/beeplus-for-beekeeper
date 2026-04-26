@echo off
REM Build Chrome-Web-Store-ready screenshots from screenshots/mocks/*.html
REM Double-click or run: build-screenshots.bat
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-screenshots.ps1"
pause
