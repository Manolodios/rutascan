<#
  RutaScan - capturas de pantalla del panel (para el README).

  Usa Microsoft Edge en modo oculto y el protocolo de depuracion de Chrome
  (CDP) para: iniciar sesion con el usuario de demostracion, recorrer las
  secciones del panel y guardar una imagen PNG de cada una en docs/capturas.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File tools\capturas.ps1
    ... -Base https://rutascan.onrender.com -Cedula 1020456789 -Pin 1234

  Requiere: Microsoft Edge instalado (viene con Windows 10/11).
#>
param(
  [string]$Base = 'https://rutascan.onrender.com',
  [string]$Cedula = '1020456789',
  [string]$Pin = '1234',
  [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'docs\capturas'),
  [int]$Width = 1600,
  [int]$Height = 1000
)

$ErrorActionPreference = 'Stop'

$edge = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'No encontre Microsoft Edge en este equipo.' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$port = 9333
$profile = Join-Path $env:TEMP ('rutascan-capturas-' + [guid]::NewGuid().ToString('N'))

Write-Host ''
Write-Host '  RutaScan - capturas del panel' -ForegroundColor Cyan
Write-Host "  destino: $OutDir" -ForegroundColor Gray

$proc = Start-Process $edge -PassThru -ArgumentList @(
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--disable-extensions', '--no-default-browser-check', '--force-device-scale-factor=1',
  "--remote-debugging-port=$port", "--user-data-dir=$profile",
  "--window-size=$Width,$Height", "$Base/"
)

try {
  # --- esperar a que Edge abra el puerto de depuracion -------------------
  $target = $null
  for ($i = 0; $i -lt 60 -and -not $target; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $list = Invoke-RestMethod "http://127.0.0.1:$port/json/list" -TimeoutSec 3
      $target = $list | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
    } catch {}
  }
  if (-not $target) { throw 'Edge no respondio en el puerto de depuracion.' }

  # --- cliente websocket muy simple para hablar CDP ----------------------
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $null = $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

  $script:msgId = 0
  function Send-Cdp([string]$method, $params) {
    $script:msgId++
    $obj = @{ id = $script:msgId; method = $method }
    if ($params) { $obj.params = $params }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Depth 12 -Compress))
    $null = $ws.SendAsync(
      [System.ArraySegment[byte]]::new($bytes),
      [System.Net.WebSockets.WebSocketMessageType]::Text, $true,
      [Threading.CancellationToken]::None
    ).GetAwaiter().GetResult()
    return [int]$script:msgId
  }

  function Receive-Cdp([int]$id, [int]$timeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    $sb = [Text.StringBuilder]::new()
    while ((Get-Date) -lt $deadline) {
      $buf = New-Object byte[] 65536
      $task = $ws.ReceiveAsync(
        [System.ArraySegment[byte]]::new($buf),
        [Threading.CancellationToken]::None
      )
      if (-not $task.Wait(2000)) { continue }
      $res = $task.Result
      [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $res.Count))
      if (-not $res.EndOfMessage) { continue }
      $text = $sb.ToString()
      [void]$sb.Clear()
      if (-not $text) { continue }
      $msg = $text | ConvertFrom-Json
      if ($msg.id -eq $id) { return $msg }
    }
    throw "Tiempo de espera agotado (CDP id=$id)."
  }

  function Invoke-Js([string]$expression) {
    $id = Send-Cdp 'Runtime.evaluate' @{ expression = $expression; awaitPromise = $true; returnByValue = $true }
    $r = Receive-Cdp $id
    if ($r.result.exceptionDetails) {
      Write-Host ("  error de JS: " + ($r.result.exceptionDetails | ConvertTo-Json -Depth 6 -Compress)) -ForegroundColor Red
    }
    return $r.result.result.value
  }

  function Save-Shot([string]$name) {
    $id = Send-Cdp 'Page.captureScreenshot' @{ format = 'png' }
    $r = Receive-Cdp $id
    $file = Join-Path $OutDir "$name.png"
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($r.result.data))
    Write-Host ("  [ok] {0}.png  ({1} KB)" -f $name, [math]::Round((Get-Item $file).Length / 1KB)) -ForegroundColor Green
  }

  Send-Cdp 'Page.enable' $null | Out-Null
  Send-Cdp 'Runtime.enable' $null | Out-Null
  Start-Sleep -Seconds 4
  Write-Host ("  pagina: " + (Invoke-Js '[location.href, document.readyState, document.title].join(" | ")')) -ForegroundColor Gray

  # --- iniciar sesion y guardar la sesion del panel ----------------------
  $login = "(async()=>{const r=await fetch('$Base/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cedula:'$Cedula',pin:'$Pin'})});const t=await r.text();if(!r.ok)return 'ERROR '+r.status+' '+t.slice(0,200);localStorage.setItem('rutascan.session.v1',t);return 'OK'})()"
  $result = $null
  for ($i = 1; $i -le 10; $i++) {
    try { $result = Invoke-Js $login } catch { $result = "excepcion: $($_.Exception.Message)" }
    if ($result -eq 'OK') { break }
    Write-Host "  esperando al servidor... ($i) -> $result" -ForegroundColor Yellow
    Start-Sleep -Seconds 8
  }
  if ($result -ne 'OK') { throw "No pude iniciar sesion: $result" }
  Write-Host '  sesion iniciada' -ForegroundColor Gray

  # --- recorrer las secciones -------------------------------------------
  Invoke-Js 'location.hash="#/"; location.reload(); 1' | Out-Null
  Start-Sleep -Seconds 12
  Save-Shot '01-panel'

  $sections = @(
    @{ hash = '#/mapa'; file = '02-mapa-en-vivo'; wait = 14 },
    @{ hash = '#/rutas'; file = '03-rutas'; wait = 8 },
    @{ hash = '#/camiones'; file = '04-camiones'; wait = 7 },
    @{ hash = '#/reportes'; file = '05-reportes'; wait = 7 },
    @{ hash = '#/seguridad'; file = '06-seguridad'; wait = 7 },
    @{ hash = '#/licencia'; file = '07-licencia'; wait = 7 }
  )
  foreach ($s in $sections) {
    Invoke-Js ("location.hash='" + $s.hash + "'; 1") | Out-Null
    Start-Sleep -Seconds $s.wait
    Save-Shot $s.file
  }

  # --- pantalla de inicio de sesion -------------------------------------
  Invoke-Js 'localStorage.removeItem("rutascan.session.v1"); location.hash="#/"; location.reload(); 1' | Out-Null
  Start-Sleep -Seconds 12
  Save-Shot '00-inicio-de-sesion'

  $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'listo', [Threading.CancellationToken]::None).GetAwaiter().GetResult()
} finally {
  if ($proc -and -not $proc.HasExited) { $proc | Stop-Process -Force }
  Start-Sleep -Milliseconds 500
  Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host ''
}
