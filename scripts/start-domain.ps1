# Startet Bot + Named Tunnel über config/cloudflared.yml
# Voraussetzung: cloudflared-domain-setup.ps1 wurde einmal ausgeführt.
#
# Nutzung:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\start-domain.ps1"

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$configPath = Join-Path $projectRoot "config\cloudflared.yml"
if (-not (Test-Path $configPath)) {
    Write-Host "config/cloudflared.yml fehlt." -ForegroundColor Red
    Write-Host "Führe zuerst aus: npm run domain:setup" -ForegroundColor Yellow
    exit 1
}

$localCloudflared = Join-Path $PSScriptRoot "bin\cloudflared.exe"
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } elseif (Test-Path $localCloudflared) { $localCloudflared } else { $null }
if (-not $cloudflaredExe) {
    Write-Host "cloudflared nicht gefunden." -ForegroundColor Yellow
    Write-Host "Installiere global oder lege scripts\bin\cloudflared.exe ab." -ForegroundColor Cyan
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    exit 1
}

$port = if ($env:DASHBOARD_PORT) { [int]$env:DASHBOARD_PORT } else { 3847 }
$listenHost = "127.0.0.1"

Write-Host "Starte Bot in neuem Fenster..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$projectRoot`" && npm start"

Write-Host "Warte auf Dashboard (${listenHost}:${port})..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
        $conn = Get-NetTCPConnection -LocalAddress $listenHost -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            $ready = $true
            break
        }
    } catch {
        # ignore
    }
}
if (-not $ready) {
    Write-Host "Dashboard-Port ${listenHost}:${port} wurde nicht gefunden. Prüfe das Bot-Fenster." -ForegroundColor Red
    exit 1
}

Write-Host "Starte Named Tunnel mit config/cloudflared.yml ..." -ForegroundColor Green
& $cloudflaredExe tunnel --config $configPath run
