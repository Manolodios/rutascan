@echo off
title RutaScan - Mantener despierta la pagina
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\mantener_despierto.ps1" %*
echo.
pause
exit /b
