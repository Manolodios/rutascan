@echo off
setlocal EnableExtensions
title RutaScan - Instalador
cd /d "%~dp0"

echo.
echo   ==========================================================
echo      RutaScan  -  Instalar / reparar en Windows
echo   ==========================================================
echo.
echo   Deja el acceso directo en el Escritorio (icono de camion),
echo   la entrada en Inicio y la desinstalacion en Configuracion.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\instalar_escritorio.ps1"

echo.
pause
exit /b
