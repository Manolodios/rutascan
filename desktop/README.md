# RutaScan · App de escritorio (Electron)

Programa de Windows que abre el panel en una **ventana propia** (sin navegador),
arranca el backend automáticamente y lo apaga al cerrar.

## Qué hace

1. Comprueba si el backend ya responde en `http://127.0.0.1:8000/health`.
   Si no responde, lo arranca con el `.venv` del proyecto.
2. Muestra la pantalla de carga y luego abre el panel web en
   `http://127.0.0.1:8000/`.
3. Acepta `--remote-debugging-port=9222` (útil para verificar qué URL cargó).

Los enlaces internos (secciones del panel) se abren en la misma ventana; las
etiquetas QR generadas se abren en una ventana pequeña y los enlaces externos
(por ejemplo el mapa) en el navegador del sistema.

## Rutas

| Qué | Ruta |
| --- | --- |
| Proyecto | se detecta automáticamente (carpeta que contiene `backend/` y `.venv/`) |
| Variable para forzarlo | `RUTASCAN_PROJECT` |
| Lo guarda el instalador | `%LOCALAPPDATA%\RutaScan\project.txt` |
| Python | `<proyecto>\.venv\Scripts\python.exe` |
| Panel servido | `<proyecto>\web` (`WEB_DIR`) — lo genera `dashboard`: `npm run build:web` |

> El proyecto **no debe moverse de carpeta**: la ruta está fijada por defecto en
> `main.js`. Si se mueve, defina `RUTASCAN_PROJECT` o actualice la constante.

## Comandos

```bash
cd desktop
npm install          # solo la primera vez
npm start            # abre la app en modo desarrollo
npm run pack         # genera dist/RutaScan-win32-x64
```

## Instalar / actualizar en el PC

**Lo más fácil:** doble clic en `INSTALAR RutaScan.bat` (raíz del proyecto), o:

```powershell
# instala/repara accesos directos, icono y entrada de desinstalacion
powershell -NoProfile -ExecutionPolicy Bypass -File tools\instalar_escritorio.ps1

# ademas vuelve a empaquetar la app (electron-packager) con el icono nuevo
powershell -NoProfile -ExecutionPolicy Bypass -File tools\instalar_escritorio.ps1 -Recompilar
```

El programa queda en `%LOCALAPPDATA%\Programs\RutaScan`, con acceso directo en el
**Escritorio** y en el **menú Inicio** (ícono de camión,
`desktop/build/icon.ico` — multi-tamaño 16…256 px) y con entrada en
**Configuración → Aplicaciones** para desinstalarlo
(`DESINSTALAR RutaScan.bat` / `tools\desinstalar_escritorio.ps1`). El script es
idempotente: se puede repetir para reparar.

Para actualizarlo a mano después de cambiar `main.js` (o el panel):

```powershell
# 1) cierre la app si esta abierta
Get-Process RutaScan -ErrorAction SilentlyContinue | Stop-Process -Force

# 2) recompile el panel (si cambio algo en dashboard/)
cd ..\dashboard
npm run build:web

# 3) reempaquete la app
cd ..\desktop
npm run pack

# 4) copie los archivos de la app sobre la instalacion
$src = ".\dist\RutaScan-win32-x64\resources\app"
$dst = "$env:LOCALAPPDATA\Programs\RutaScan\resources\app"
Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
```

Si además cambió `package.json` o la versión de Electron, copie toda la carpeta
`dist\RutaScan-win32-x64\*` sobre `%LOCALAPPDATA%\Programs\RutaScan\` en lugar
de solo `resources\app`.

## Verificar qué abre

```powershell
$exe = "$env:LOCALAPPDATA\Programs\RutaScan\RutaScan.exe"
Start-Process $exe -ArgumentList "--remote-debugging-port=9222"
Start-Sleep 8
(Invoke-RestMethod http://127.0.0.1:9222/json).url    # debe ser .../
Get-Process RutaScan | Stop-Process -Force
```
