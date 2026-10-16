@echo off
setlocal EnableExtensions
title RutaScan - Panel Nuevo
cd /d "%~dp0"
set "ROOT=%~dp0"
set "PY=%ROOT%.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo   ==========================================================
echo      RutaScan  -  Panel Nuevo
echo   ==========================================================
echo.

REM Si el panel nuevo todavia no esta construido, construirlo una vez
if not exist "%ROOT%web\app\index.html" (
  echo   Construyendo el panel nuevo por primera vez...
  echo   ^(puede tardar un par de minutos^)
  echo.
  pushd "%ROOT%dashboard"
  call npm.cmd run build:web
  popd
  echo.
)

REM Si el servidor ya esta corriendo, solo abrir el panel
powershell -NoProfile -Command "try{ (Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2) | Out-Null; exit 0 }catch{ exit 1 }"
if "%errorlevel%"=="0" goto ya_corre

echo   Iniciando el servidor... (tarda unos segundos)
echo   El navegador se va a abrir solo cuando este listo.
echo.

start "" /min powershell -NoProfile -Command "for($i=0;$i -lt 90;$i++){ Start-Sleep -Seconds 1; try{ $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2; if($r.status -eq 'ok'){ Start-Process 'http://127.0.0.1:8000/app/'; break } } catch {} }"

cd /d "%ROOT%backend"
set "DATABASE_URL=sqlite+pysqlite:///./rutascan_demo.db"
set "SEED_DEMO_DATA=true"
set "WEB_DIR=%ROOT%web"
set "PYTHONPATH=%ROOT%backend"

echo   ----------------------------------------------------------
echo    PARA CERRAR RutaScan: cierra esta ventana negra.
echo   ----------------------------------------------------------
echo.

"%PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

echo.
echo   El servidor se ha detenido.
pause
exit /b

:ya_corre
echo   RutaScan ya estaba abierto. Abriendo el panel nuevo...
start "" "http://127.0.0.1:8000/app/"
timeout /t 3 >nul
exit /b
