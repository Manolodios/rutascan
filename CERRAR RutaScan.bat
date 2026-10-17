@echo off
title Cerrar RutaScan
echo.
echo   Cerrando RutaScan...
echo.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue"
echo   RutaScan cerrado. Ya puedes cerrar esta ventana.
timeout /t 4 >nul
exit /b
