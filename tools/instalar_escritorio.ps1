<#
  RutaScan - instalador / reparador de la app de escritorio en Windows.

  Deja la app en %LOCALAPPDATA%\Programs\RutaScan, crea los accesos directos
  (Escritorio y menu Inicio) con el icono del camion y registra la entrada de
  desinstalacion en Configuracion > Aplicaciones.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\instalar_escritorio.ps1
    ... -Recompilar   (vuelve a empaquetar la app con electron-packager)

  Es idempotente: se puede ejecutar las veces que haga falta para reparar.
#>
param(
  [string]$Project = (Split-Path -Parent $PSScriptRoot),
  [string]$InstallDir = "$env:LOCALAPPDATA\Programs\RutaScan",
  [switch]$Recompilar
)

$ErrorActionPreference = 'Stop'

function Ok($m) { Write-Host "  [ok] $m" -ForegroundColor Green }
function Info($m) { Write-Host "  $m" -ForegroundColor Gray }
function Step($m) { Write-Host ""; Write-Host "  > $m" -ForegroundColor Cyan }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "     RutaScan  -  instalador de la app de escritorio" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan

$exe = Join-Path $InstallDir 'RutaScan.exe'
$icon = Join-Path $Project 'desktop\build\icon.ico'
$built = Join-Path $Project 'desktop\dist\RutaScan-win32-x64'

# --- 1. app empaquetada ---------------------------------------------------
Step "Aplicacion instalada"
if ($Recompilar -or -not (Test-Path $exe)) {
  Info "Empaquetando la app (puede tardar un minuto)..."
  Push-Location (Join-Path $Project 'desktop')
  try {
    if (-not (Test-Path 'node_modules')) { & npm.cmd install | Out-Null }
    & npm.cmd run pack | Out-Null
  } finally { Pop-Location }

  if (-not (Test-Path (Join-Path $built 'RutaScan.exe'))) {
    throw "No se pudo empaquetar la app: falta $built\RutaScan.exe"
  }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  Copy-Item (Join-Path $built '*') $InstallDir -Recurse -Force
  Ok "app copiada a $InstallDir"
} else {
  # refresca el codigo de la app (main.js) sin volver a empaquetar
  $srcApp = Join-Path $built 'resources\app'
  $dstApp = Join-Path $InstallDir 'resources\app'
  if (Test-Path $srcApp) {
    Copy-Item (Join-Path $srcApp '*') $dstApp -Recurse -Force
    Ok "codigo de la app actualizado"
  }
  # refresca el ejecutable (trae el icono incrustado) si el paquete es mas nuevo
  $srcExe = Join-Path $built 'RutaScan.exe'
  $dstExe = Join-Path $InstallDir 'RutaScan.exe'
  if ((Test-Path $srcExe) -and (Test-Path $dstExe) -and
      ((Get-Item $srcExe).LastWriteTime -gt (Get-Item $dstExe).LastWriteTime)) {
    Get-Process RutaScan -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    Copy-Item $srcExe $dstExe -Force
    Ok "ejecutable actualizado (icono incrustado)"
  }
}

# --- 2. icono ------------------------------------------------------------
Step "Icono"
if (Test-Path $icon) {
  Copy-Item $icon (Join-Path $InstallDir 'RutaScan.ico') -Force
  Ok "icono del camion copiado junto a la aplicacion"
} else {
  Info "AVISO: no se encontro $icon"
}

# --- 3. accesos directos -------------------------------------------------
Step "Accesos directos"
$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'RutaScan.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'RutaScan.lnk')
)
foreach ($lnk in $shortcuts) {
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath = $exe
  $s.WorkingDirectory = $InstallDir
  $s.IconLocation = "$InstallDir\RutaScan.ico,0"
  $s.Description = 'RutaScan - panel de rastreo de carga'
  $s.Save()
  Ok $lnk
}

# --- 4. desinstalacion desde Windows -------------------------------------
Step "Desinstalacion (Configuracion > Aplicaciones)"
$uninstaller = Join-Path $Project 'tools\desinstalar_escritorio.ps1'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\RutaScan'
New-Item -Path $key -Force | Out-Null
$sizeKb = [int](((Get-ChildItem $InstallDir -Recurse -File -ErrorAction SilentlyContinue |
  Measure-Object Length -Sum).Sum) / 1KB)
Set-ItemProperty -Path $key -Name 'DisplayName'     -Value 'RutaScan'
Set-ItemProperty -Path $key -Name 'DisplayVersion'  -Value '1.0.0'
Set-ItemProperty -Path $key -Name 'Publisher'       -Value 'RutaScan'
Set-ItemProperty -Path $key -Name 'DisplayIcon'     -Value "$InstallDir\RutaScan.exe,0"
Set-ItemProperty -Path $key -Name 'InstallLocation' -Value $InstallDir
Set-ItemProperty -Path $key -Name 'UninstallString' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstaller`""
Set-ItemProperty -Path $key -Name 'EstimatedSize'   -Value $sizeKb -Type DWord
Set-ItemProperty -Path $key -Name 'InstallDate'     -Value (Get-Date -Format 'yyyyMMdd')
Set-ItemProperty -Path $key -Name 'URLInfoAbout'    -Value 'https://rutascan.onrender.com'
Set-ItemProperty -Path $key -Name 'NoModify'        -Value 1 -Type DWord
Set-ItemProperty -Path $key -Name 'NoRepair'        -Value 1 -Type DWord
Ok "aparece en Configuracion > Aplicaciones (con tamano y desinstalador)"

Write-Host ""
Write-Host "  LISTO: en el Escritorio esta el acceso directo 'RutaScan' (icono de camion)." -ForegroundColor Green
Write-Host ""
