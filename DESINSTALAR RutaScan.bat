@echo off
setlocal EnableExtensions
title RutaScan - Desinstalador
cd /d "%~dp0"

echo.
echo   ==========================================================
echo      RutaScan  -  Quitar de Windows
echo   ==========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\desinstalar_escritorio.ps1"

echo.
pause
exit /b
