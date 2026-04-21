# Richtet einen Cloudflare Named Tunnel für eine feste Domain ein.
# Standard-Host: dash.mynexstudios.com
#
# Nutzung:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\cloudflared-domain-setup.ps1"
#   powershell -ExecutionPolicy Bypass -File ".\scripts\cloudflared-domain-setup.ps1" -Hostname "dash.deinedomain.de" -TunnelName "mynex-dashboard"
#
# Ergebnis:
# - config/cloudflared.yml wird erzeugt/aktualisiert
# - .env wird auf die feste HTTPS-Domain gesetzt
# - Hinweis für Discord Redirect wird angezeigt

param(
    [string]$Hostname = "dash.mynexstudios.com",
    [string]$TunnelName = "mynex-dashboard"
)

$ErrorActionPreference = "Stop"

function Find-CloudflaredExe {
    param([string]$scriptsDir)
    $localCloudflared = Join-Path $scriptsDir "bin\cloudflared.exe"
    $cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cloudflaredCmd) { return $cloudflaredCmd.Source }
    if (Test-Path $localCloudflared) { return $localCloudflared }
    return $null
}

function Set-OrAddEnvLine {
    param(
        [string]$Text,
        [string]$Key,
        [string]$Value
    )
    $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
    $line = "$Key=$Value"
    if ($Text -match $pattern) {
        return [regex]::Replace($Text, $pattern, $line)
    }
    return ($Text.TrimEnd() + "`r`n" + $line + "`r`n")
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$cloudflaredExe = Find-CloudflaredExe -scriptsDir $PSScriptRoot
if (-not $cloudflaredExe) {
    Write-Host "cloudflared nicht gefunden." -ForegroundColor Yellow
    Write-Host "Installiere global oder lege scripts\bin\cloudflared.exe ab." -ForegroundColor Cyan
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    exit 1
}

if ($Hostname -notmatch "^[a-z0-9.-]+$") {
    Write-Host "Ungültiger Hostname: $Hostname" -ForegroundColor Red
    exit 1
}

Write-Host "1/5 Cloudflare Login starten..." -ForegroundColor Green
$certPath = Join-Path $HOME ".cloudflared\cert.pem"
if (Test-Path $certPath) {
    Write-Host "Vorhandenes Cloudflare-Zertifikat gefunden, Login wird übersprungen:" -ForegroundColor Yellow
    Write-Host "  $certPath" -ForegroundColor DarkGray
} else {
    Write-Host "Im Browser die Zone autorisieren (einmalig)." -ForegroundColor Yellow
    & $cloudflaredExe tunnel login
}

Write-Host "2/5 Tunnel anlegen oder vorhandenen Tunnel nutzen..." -ForegroundColor Green
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $createOut = (& $cloudflaredExe tunnel create $TunnelName 2>&1 | Out-String)
} finally {
    $ErrorActionPreference = $oldErrorActionPreference
}
$uuidMatch = [regex]::Match($createOut, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
$tunnelUuid = if ($uuidMatch.Success) { $uuidMatch.Value } else { $null }

if (-not $tunnelUuid) {
    $oldErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $listOut = (& $cloudflaredExe tunnel list 2>&1 | Out-String)
    } finally {
        $ErrorActionPreference = $oldErrorActionPreference
    }
    $nameEsc = [regex]::Escape($TunnelName)
    $line = ($listOut -split "`r?`n" | Where-Object {
            $_ -match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s+' -and
            $_ -match "\s$nameEsc(\s+|$)"
        } | Select-Object -First 1)
    if ($line) {
        $lineUuid = [regex]::Match($line, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        if ($lineUuid.Success) { $tunnelUuid = $lineUuid.Value }
    }
}

if (-not $tunnelUuid) {
    Write-Host "Tunnel-ID konnte nicht ermittelt werden." -ForegroundColor Red
    Write-Host "Ausgabe cloudflared tunnel create/list prüfen." -ForegroundColor Yellow
    exit 1
}

Write-Host "3/5 DNS-Route setzen: $Hostname -> Tunnel $TunnelName" -ForegroundColor Green
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $cloudflaredExe tunnel route dns $TunnelName $Hostname | Out-Host
} finally {
    $ErrorActionPreference = $oldErrorActionPreference
}

$credentialsFile = Join-Path $HOME ".cloudflared\$tunnelUuid.json"
if (-not (Test-Path $credentialsFile)) {
    Write-Host "Credentials-Datei nicht gefunden: $credentialsFile" -ForegroundColor Red
    exit 1
}

Write-Host "4/5 config/cloudflared.yml erzeugen..." -ForegroundColor Green
$configDir = Join-Path $projectRoot "config"
if (-not (Test-Path $configDir)) {
    New-Item -Path $configDir -ItemType Directory -Force | Out-Null
}
$configPath = Join-Path $configDir "cloudflared.yml"
$port = if ($env:DASHBOARD_PORT) { [int]$env:DASHBOARD_PORT } else { 3847 }
$credEsc = ($credentialsFile -replace "\\", "/")
$cfg = @"
tunnel: $tunnelUuid
credentials-file: $credEsc

ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$port
  - service: http_status:404
"@
Set-Content -Path $configPath -Value $cfg -Encoding UTF8

Write-Host "5/5 .env auf feste Domain setzen..." -ForegroundColor Green
$envPath = Join-Path $projectRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host ".env nicht gefunden: $envPath" -ForegroundColor Red
    exit 1
}
$baseUrl = "https://$Hostname"
$redirectUrl = "$baseUrl/api/auth/callback"
$envText = Get-Content -Path $envPath -Raw
$envText = Set-OrAddEnvLine -Text $envText -Key "DASHBOARD_PUBLIC_URL" -Value $baseUrl
$envText = Set-OrAddEnvLine -Text $envText -Key "DASHBOARD_OAUTH_REDIRECT_URI" -Value $redirectUrl
$envText = Set-OrAddEnvLine -Text $envText -Key "DASHBOARD_HOST" -Value "127.0.0.1"
$envText = Set-OrAddEnvLine -Text $envText -Key "TRUST_PROXY" -Value "true"
# Vite bündelt diese URL ins Frontend — muss HTTPS + öffentliche Domain sein (sonst Mixed Content / Auth-Fehler).
$envText = Set-OrAddEnvLine -Text $envText -Key "VITE_DASHBOARD_API_BASE_URL" -Value $baseUrl
Set-Content -Path $envPath -Value $envText -Encoding UTF8

$domainFile = Join-Path $projectRoot "data\dashboard-domain-url.txt"
$domainDir = Split-Path -Parent $domainFile
if (-not (Test-Path $domainDir)) {
    New-Item -Path $domainDir -ItemType Directory -Force | Out-Null
}
Set-Content -Path $domainFile -Value $baseUrl -Encoding UTF8

Write-Host ""
Write-Host "Fertig." -ForegroundColor Green
Write-Host "Domain: $baseUrl" -ForegroundColor Cyan
Write-Host "Redirect: $redirectUrl" -ForegroundColor Cyan
Write-Host "Tunnel-Config: $configPath" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Wichtig: Discord Developer Portal -> OAuth2 -> Redirects auf diese Callback-URL setzen:" -ForegroundColor Yellow
Write-Host "  $redirectUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Wichtig: Dashboard neu bauen (VITE_* aus .env einbinden):" -ForegroundColor Yellow
Write-Host "  npm run build:dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "Start danach mit: npm run start:domain" -ForegroundColor Green
