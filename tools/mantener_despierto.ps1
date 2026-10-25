#requires -Version 5.1
<#
  RutaScan - Mantener despierta la pagina de Internet
  ------------------------------------------------------------------
  Render (plan gratis) duerme el servicio 15 minutos despues de la ultima
  visita. El primer acceso tras dormir tarda ~30-60 segundos (se ve
  "Application loading"). Este script lo evita.

  Dos caminos, cada uno sirve por su cuenta y pueden convivir:

    1) GitHub (ya viene listo): el archivo .github/workflows/keep-alive.yml
       toca la pagina cada 13 minutos desde los servidores de GitHub.
       Funciona aunque esta PC este apagada. No hay que hacer nada.

    2) Esta PC (respaldo): instala una tarea de Windows que toca la pagina
       cada 13 minutos mientras la PC este encendida. Sirve para las rachas
       en que GitHub se atrasa.

  Uso:
    MANTENER DESPIERTO.bat              instala el respaldo de esta PC
    MANTENER DESPIERTO.bat -Probar      una sola visita, para comprobar
    MANTENER DESPIERTO.bat -Quitar      quita el respaldo de esta PC

  (Sin acentos a proposito: Windows PowerShell 5.1 lee los .ps1 sin BOM como
  texto ANSI y destrozaria las tildes.)
#>

[CmdletBinding()]
param(
  [switch]$Instalar,
  [switch]$Quitar,
  [switch]$Probar,
  [switch]$Ping
)

$ErrorActionPreference = 'Stop'

$webUrl   = 'https://rutascan.onrender.com'
$taskName = 'RutaScan - Mantener despierta la pagina'
$logDir   = Join-Path $env:LOCALAPPDATA 'RutaScan\tools'
$logFile  = Join-Path $logDir 'mantener-despierto.log'
$minutos  = 13   # Render duerme a los 15; 13 deja margen

function Info { param([string]$m) Write-Host "   $m" }
function Ok   { param([string]$m) Write-Host "   [OK] $m" -ForegroundColor Green }
function Warn { param([string]$m) Write-Host "   [!] $m" -ForegroundColor Yellow }

function Write-Log {
  param([string]$Mensaje)
  try {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $Mensaje
    Add-Content -Path $logFile -Value $linea -Encoding UTF8
    # rotation sencilla: si pasa de 1 MB, deja las ultimas 300 lineas
    if ((Get-Item $logFile).Length -gt 1MB) {
      $ultimas = Get-Content $logFile -Tail 300
      Set-Content -Path $logFile -Value $ultimas -Encoding UTF8
    }
  } catch { }
}

# Visita la pagina. Con -Verboso escribe en pantalla; si no, en el registro.
# Devuelve $true si las dos direcciones respondieron 200.
function Visit-Pagina {
  param([switch]$Verboso, [int]$Intentos = 3)
  $todoOk = $true
  foreach ($path in @('/health', '/')) {
    $url = "$webUrl$path"
    $okUrl = $false
    for ($i = 1; $i -le $Intentos; $i++) {
      $t0 = Get-Date
      try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 180
        $ms = [int]((Get-Date) - $t0).TotalMilliseconds
        $msg = 'OK      {0} -> HTTP {1} en {2} ms' -f $url, [int]$r.StatusCode, $ms
        if ($Verboso) { Ok $msg } else { Write-Log $msg }
        $okUrl = $true
        break
      }
      catch {
        $ms = [int]((Get-Date) - $t0).TotalMilliseconds
        $msg = 'FALLO   {0} (intento {1} de {2}, {3} ms): {4}' -f $url, $i, $Intentos, $ms, $_.Exception.Message
        if ($Verboso) { Warn $msg } else { Write-Log $msg }
        if ($i -lt $Intentos) {
          if ($Verboso) { Info 'Reintentando en 20 segundos...' }
          else { Start-Sleep -Seconds 20 }
        }
      }
    }
    if (-not $okUrl) { $todoOk = $false }
  }
  return $todoOk
}

function Instalar-Respaldo {
  Info 'Instalando el respaldo de esta PC (tarea de Windows)...'

  $yo = $MyInvocation.PSCommandPath
  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
    '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Ping' -f $yo)

  # Duracion de 10 anos: Windows rechaza TimeSpan.MaxValue (se serializa
  # como P99999999DT... y queda fuera de rango), asi que se usa un valor
  # grande pero valido. 10 anos es, en la practica, indefinido.
  $disparo = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(2)) `
    -RepetitionInterval (New-TimeSpan -Minutes $minutos) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

  $ajustes = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

  # S4U corre aunque nadie haya iniciado sesion (mientras la PC este
  # encendida) y no pide contrasena. Si el sistema no lo permite, se vuelve
  # a intentar como tarea interactiva (solo con la sesion abierta).
  $exito = $false
  try {
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $accion -Trigger $disparo `
      -Settings $ajustes -Principal $principal -Force | Out-Null
    $exito = $true
  }
  catch {
    Warn ("S4U no disponible ({0}). Reintentando como tarea interactiva..." -f $_.Exception.Message)
  }
  if (-not $exito) {
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $accion -Trigger $disparo `
      -Settings $ajustes -Principal $principal -Force | Out-Null
    Warn 'Quedo como tarea interactiva: tocara la pagina con su sesion abierta.'
    Warn 'Fuera de su sesion (PC prendida pero sin entrar) ya no corre; para'
    Warn 'esas horas queda el respaldo de GitHub, que si funciona siempre.'
  }

  $t = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($t) {
    Ok ('Tarea creada: "{0}".' -f $taskName)
    Info ('Tocara la pagina cada {0} minutos mientras esta PC este encendida.' -f $minutos)
    Info 'Primera ejecucion automatica: dentro de unos 2 minutos.'
  }
  else {
    Warn 'No se pudo comprobar la tarea. Revise el Programador de tareas de Windows.'
  }
}

function Quitar-Respaldo {
  try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Ok 'Respaldo de esta PC eliminado. El de GitHub sigue funcionando igual.'
  }
  catch {
    Warn ('No habia nada que quitar: {0}' -f $_.Exception.Message)
  }
}

# --- modo silencioso: lo usa la tarea de Windows ---------------------------
if ($Ping) { [void](Visit-Pagina); return }

Write-Host ''
Write-Host '  =========================================================='
Write-Host '     RutaScan  -  Mantener despierta la pagina'
Write-Host '  =========================================================='
Write-Host ''

if ($PSBoundParameters.Count -eq 0) { $Instalar = $true }

if ($Quitar) {
  Quitar-Respaldo
}
elseif ($Probar) {
  Info ("Comprobando {0} ..." -f $webUrl)
  $ok = Visit-Pagina -Verboso
  Write-Host ''
  if ($ok) { Ok 'La pagina responde bien.' }
  else { Warn 'No respondio. Revise su conexion a internet y vuelve a intentar.' }
}
elseif ($Instalar) {
  Instalar-Respaldo
  Write-Host ''
  Info 'Comprobando que la pagina responde...'
  $null = Visit-Pagina -Verboso
  Write-Host ''
  Write-Host '   ----------------------------------------------------------'
  Write-Host '   Como queda:' -ForegroundColor Cyan
  Write-Host '     - GitHub toca la pagina cada 13 minutos (ya esta activo).'
  Write-Host '     - Esta PC tambien la tocara cada 13 minutos mientras'
  Write-Host '       este encendida (respaldo).'
  Write-Host '     - Para quitarlo de esta PC: MANTENER DESPIERTO.bat -Quitar'
  Write-Host '   ----------------------------------------------------------'
  Write-Host ''
  Info ('Registro de visitas: {0}' -f $logFile)
}

Write-Host ''
