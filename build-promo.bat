@echo off
REM Generate Chrome Web Store promo tiles (440x280 + 1400x560)
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-promo.ps1"
pause
