<#
  RutaScan - desinstalador de la app de escritorio.

  Quita:
    - la aplicacion instalada (%LOCALAPPDATA%\Programs\RutaScan)
    - los accesos directos (Escritorio y menu Inicio)
    - la entrada de Configuracion > Aplicaciones
    - las herramientas descargadas (%LOCALAPPDATA%\RutaScan: cloudflared, registros)

  NO toca el proyecto: codigo, base de datos demo (rutascan_demo.db),
  archivos subidos ni el entorno de Python.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\desinstalar_escritorio.ps1
    ... -Silencioso   (sin preguntar)
#>
param(
  [string]$Project = (Split-Path -Parent $PSScriptRoot),
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\RutaScan",
  [switch]$Silencioso
)

$ErrorActionPreference = 'Continue'

function Ok($m) { Write-Host "  [ok] $m" -ForegroundColor Green }
function Info($m) { Write-Host "  $m" -ForegroundColor Gray }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Yellow
Write-Host "     RutaScan  -  desinstalador" -ForegroundColor Yellow
Write-Host "  ============================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Se va a quitar la aplicacion de Windows." -ForegroundColor White
Write-Host "  El proyecto (codigo, datos demo, archivos subidos) NO se toca." -ForegroundColor Gray
Write-Host ""

if (-not $Silencioso) {
  $respuesta = Read-Host "  Escriba SI para continuar"
  if ($respuesta -notmatch '^(si|s)$') { Write-Host "  Cancelado. No se cambio nada." -ForegroundColor Gray; exit 0 }
}

# --- 1. cerrar la aplicacion (y su backend) -----------------------------
$proc = Get-Process RutaScan -ErrorAction SilentlyContinue
if ($proc) {
  $proc | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Ok "aplicacion cerrada"
} else {
  Info "la aplicacion no estaba abierta"
}

# --- 2. accesos directos -------------------------------------------------
foreach ($lnk in @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'RutaScan.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'RutaScan.lnk')
  )) {
  if (Test-Path $lnk) { Remove-Item $lnk -Force -ErrorAction SilentlyContinue; Ok "borrado $lnk" }
}

# --- 3. entrada de Configuracion > Aplicaciones --------------------------
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\RutaScan'
if (Test-Path $key) { Remove-Item $key -Recurse -Force -ErrorAction SilentlyContinue; Ok "borrada la entrada de Aplicaciones" }

# --- 4. aplicacion instalada --------------------------------------------
if (Test-Path $InstallDir) {
  Remove-Item $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path $InstallDir) {
    Write-Host "  ATENCION: quedaron archivos en $InstallDir (cierre todo y borrela a mano)." -ForegroundColor Red
  } else {
    Ok "borrada la aplicacion: $InstallDir"
  }
} else {
  Info "la aplicacion no estaba instalada"
}

# --- 5. herramientas y registros ----------------------------------------
$tools = Join-Path $env:LOCALAPPDATA 'RutaScan'
if (Test-Path $tools) {
  Remove-Item $tools -Recurse -Force -ErrorAction SilentlyContinue
  Ok "borradas las herramientas: $tools"
}

Write-Host ""
Write-Host "  RutaScan quedo desinstalado." -ForegroundColor Green
Write-Host "  Su proyecto sigue intacto en: $Project" -ForegroundColor Gray
Write-Host "  (los archivos del Escritorio: 'QR RutaScan.png', 'RutaScan-Celular.apk')" -ForegroundColor Gray
Write-Host ""
