@echo off
title RutaScan - Conectar el celular
setlocal EnableExtensions

REM ---------------------------------------------------------------------------
REM  Abre el puerto 8000 del firewall de Windows para que la app del celular
REM  pueda llegar a este PC por la red WiFi. Necesita permisos de administrador,
REM  por eso el script se reabre a si mismo pidiendo el permiso (acepte "Si").
REM ---------------------------------------------------------------------------

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo   Pidiendo permiso de administrador... ACEPTE la ventana que aparece.
  echo.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo   ==========================================================
echo      RutaScan  -  Conexion con el celular
echo   ==========================================================
echo.

netsh advfirewall firewall delete rule name="RutaScan (celular)" >nul 2>&1
netsh advfirewall firewall add rule name="RutaScan (celular)" dir=in action=allow protocol=TCP localport=8000 profile=private,domain >nul 2>&1

if %errorlevel%==0 (
  echo   [OK] Puerto 8000 abierto para la red local.
) else (
  echo   [ERROR] No se pudo abrir el puerto 8000.
)

echo.
echo   Direcciones de este PC (la app del celular usa una de estas):
echo.
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } | ForEach-Object { Write-Host ('        http://' + $_.IPAddress + ':8000        (' + $_.InterfaceAlias + ')') }"
echo.
echo   IMPORTANTE:
echo     - El celular y este PC deben estar en la MISMA red WiFi.
echo     - Deje RutaScan abierto en este PC mientras usa el celular.
echo.
pause
exit /b
