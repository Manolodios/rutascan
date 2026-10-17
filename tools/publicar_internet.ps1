#requires -Version 5.1
<#
  RutaScan - Publicar en Internet (Cloudflare Tunnel, gratis)
  ------------------------------------------------------------------
  Deja la aplicacion accesible desde CUALQUIER parte (no solo la red
  WiFi de la casa) mediante un enlace HTTPS real de Cloudflare.

  - Si el servidor RutaScan no esta encendido, lo enciende.
  - Si el tunel ya esta encendido, reutiliza el mismo enlace.
  - Guarda el enlace en el Escritorio: "URL PUBLICA RutaScan.txt".

  Uso: doble clic en "PUBLICAR RutaScan en Internet.bat".
#>

$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $PSScriptRoot          # carpeta del proyecto
$cfDir  = Join-Path $env:LOCALAPPDATA 'RutaScan\tools'
$cf     = Join-Path $cfDir 'cloudflared.exe'
$log    = Join-Path $cfDir 'tunnel.log'
$desk   = [Environment]::GetFolderPath('Desktop')
$urlTxt = Join-Path $desk 'URL PUBLICA RutaScan.txt'
$downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

function Info { param([string]$m) Write-Host "   $m" }
function Ok   { param([string]$m) Write-Host "   [OK] $m" -ForegroundColor Green }
function Warn { param([string]$m) Write-Host "   [!] $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  =========================================================="
Write-Host "     RutaScan  -  Publicar en Internet (gratis)"
Write-Host "  =========================================================="
Write-Host ""

# --- 1) Conector de Cloudflare (se descarga solo la primera vez) ------------
New-Item -ItemType Directory -Force -Path $cfDir | Out-Null
if (-not (Test-Path $cf)) {
  Info "Descargando el conector de Cloudflare (una sola vez, ~53 MB)..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $tmp = "$cf.download"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $tmp -UseBasicParsing
  Move-Item -Force $tmp $cf
  Ok "Conector descargado."
}

# --- 2) Servidor RutaScan encendido? ----------------------------------------
function Test-Backend {
  try {
    $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 3
    return [bool]$h.status
  } catch { return $false }
}

$healthy = Test-Backend
if (-not $healthy) {
  Info "El servidor RutaScan no estaba encendido. Encendiendolo..."
  $py = Join-Path $root '.venv\Scripts\python.exe'
  if (-not (Test-Path $py)) { $py = 'python' }
  $backend = Join-Path $root 'backend'
  $env:DATABASE_URL = 'sqlite+pysqlite:///./rutascan_demo.db'
  $env:SEED_DEMO_DATA = 'true'
  $env:WEB_DIR = Join-Path $root 'web'
  Start-Process -FilePath $py `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000' `
    -WorkingDirectory $backend -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $cfDir 'backend.log') `
    -RedirectStandardError  (Join-Path $cfDir 'backend.err.log')
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Backend) { $healthy = $true; break }
  }
  if ($healthy) { Ok "Servidor encendido." }
  else { Warn "El servidor no respondio todavia. Abre ABRIR RutaScan.bat y vuelve a intentar." }
}

# --- 3) Tunel encendido? ----------------------------------------------------
function Get-TunnelUrl {
  if (-not (Test-Path $log)) { return $null }
  $hits = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue
  if (-not $hits) { return $null }
  return $hits[-1].Matches[-1].Value
}

$proc = Get-Process cloudflared -ErrorAction SilentlyContinue
$url  = $null

if ($proc) {
  $url = Get-TunnelUrl
  if ($url) { Ok "El tunel ya estaba encendido. Reutilizando el mismo enlace." }
}

if (-not $proc) {
  Info "Abriendo el tunel hacia internet (tarda unos segundos)..."
  if (Test-Path $log) { Remove-Item $log -Force }
  Start-Process -FilePath $cf `
    -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:8000', '--no-autoupdate', '--logfile', $log `
    -WindowStyle Hidden
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    $url = Get-TunnelUrl
    if ($url) { break }
  }
}

if (-not $url) {
  Warn "No se pudo obtener el enlace publico. Cierra esta ventana y vuelve a intentar."
  exit 1
}

# --- 4) Guardar el enlace en el Escritorio ----------------------------------
$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
$content = @"
RutaScan - ENLACE PUBLICO (funciona desde cualquier parte del mundo)
Creado: $stamp

  Panel (PC / tablet / navegador):   $url

  Celular (app RutaScan):
    1. Abre la app e inicia sesion.
    2. En la pantalla de inicio de sesion, toca "Servidor".
    3. Pega esta direccion:        $url
    4. Listo: ya no depende del WiFi de la casa.

Importante: este enlace funciona mientras ESTE PC este encendido y con
internet. Si el PC se apaga o se reinicia, vuelve a abrir
"PUBLICAR RutaScan en Internet.bat" y el enlace se renueva (queda guardado
aqui otra vez).
"@
Set-Content -Path $urlTxt -Value $content -Encoding UTF8

try { Set-Clipboard -Value $url } catch { }

Write-Host ""
Write-Host "   ----------------------------------------------------------"
Write-Host "    TU ENLACE PUBLICO ES:" -ForegroundColor Cyan
Write-Host ""
Write-Host "       $url" -ForegroundColor White
Write-Host ""
Write-Host "   ----------------------------------------------------------"
Write-Host "   Ya quedo copiado al portapapeles y guardado en el"
Write-Host "   Escritorio como:  URL PUBLICA RutaScan.txt"
Write-Host "   ----------------------------------------------------------"
Write-Host ""
