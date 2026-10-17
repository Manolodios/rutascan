@echo off
title RutaScan - Publicar en Internet
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publicar_internet.ps1"
echo.
pause
exit /b
