# Startet Bot + Cloudflare Quick Tunnel robust in richtiger Reihenfolge.
# Nutzung:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\start-public.ps1"
#
# Ablauf:
# 1) Bot in neuem Fenster starten (npm start)
# 2) Warten bis Dashboard-Port offen ist
# 3) Quick Tunnel starten

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host "npm nicht gefunden. Bitte Node.js installieren." -ForegroundColor Red
    Read-Host "Enter zum Schließen"
    exit 1
}

$localCloudflared = Join-Path $PSScriptRoot "bin\cloudflared.exe"
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } elseif (Test-Path $localCloudflared) { $localCloudflared } else { $null }
if (-not $cloudflaredExe) {
    Write-Host "cloudflared nicht gefunden." -ForegroundColor Yellow
    Write-Host "Installiere global oder lege scripts\\bin\\cloudflared.exe ab." -ForegroundColor Cyan
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    Read-Host "Enter zum Schließen"
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
    Read-Host "Enter zum Schließen"
    exit 1
}

Write-Host "Dashboard ist erreichbar. Starte Cloudflare Tunnel..." -ForegroundColor Green
Write-Host "Hinweis: Diese URL bei Discord OAuth Redirect + .env eintragen, falls sie neu ist." -ForegroundColor Yellow
$latestUrlFile = Join-Path $projectRoot "data\quick-tunnel-url.txt"

$lineHandler = {
    param([string]$line)
    if ([string]::IsNullOrWhiteSpace($line)) { return }

    Write-Host $line

    $match = [regex]::Match($line, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) {
        $tunnelUrl = $match.Value
        try {
            $dir = Split-Path -Parent $latestUrlFile
            if (-not (Test-Path $dir)) {
                New-Item -Path $dir -ItemType Directory -Force | Out-Null
            }
            Set-Content -Path $latestUrlFile -Value $tunnelUrl -Encoding UTF8
            Write-Host ""
            Write-Host "Neue Quick-Tunnel URL gespeichert:" -ForegroundColor Green
            Write-Host "  $tunnelUrl" -ForegroundColor Cyan
            Write-Host "Datei: $latestUrlFile" -ForegroundColor DarkGray
            Write-Host "Optional: npm run quick:url:apply (setzt DASHBOARD_PUBLIC_URL + DASHBOARD_OAUTH_REDIRECT_URI in .env)" -ForegroundColor DarkGray
            Write-Host ""
        } catch {
            Write-Host "URL konnte nicht in Datei gespeichert werden: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $cloudflaredExe tunnel --url "http://${listenHost}:${port}" 2>&1 | ForEach-Object { & $lineHandler ([string]$_) }
} finally {
    $ErrorActionPreference = $oldErrorActionPreference
}

