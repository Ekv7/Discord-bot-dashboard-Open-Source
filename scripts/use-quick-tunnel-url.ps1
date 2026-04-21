# Setzt die zuletzt gespeicherte Cloudflare-Quick-Tunnel-URL in .env.
# Aktualisiert:
# - DASHBOARD_PUBLIC_URL
# - DASHBOARD_OAUTH_REDIRECT_URI (= <URL>/api/auth/callback)
# - DASHBOARD_HOST (lokal auf 127.0.0.1)
#
# Nutzung:
#   powershell -ExecutionPolicy Bypass -File ".\scripts\use-quick-tunnel-url.ps1"

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"
$urlFile = Join-Path $projectRoot "data\quick-tunnel-url.txt"

if (-not (Test-Path $envFile)) {
    Write-Host ".env nicht gefunden: $envFile" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $urlFile)) {
    Write-Host "Quick-Tunnel-Datei nicht gefunden: $urlFile" -ForegroundColor Red
    Write-Host "Starte zuerst: npm run start:public" -ForegroundColor Yellow
    exit 1
}

$baseUrl = (Get-Content -Path $urlFile -Raw).Trim()
if (-not $baseUrl) {
    Write-Host "Tunnel-URL ist leer in: $urlFile" -ForegroundColor Red
    exit 1
}
if ($baseUrl -notmatch '^https:\/\/[a-z0-9-]+\.trycloudflare\.com$') {
    Write-Host "Ungültige Quick-Tunnel-URL: $baseUrl" -ForegroundColor Red
    exit 1
}

$redirectUrl = "$baseUrl/api/auth/callback"
$content = Get-Content -Path $envFile -Raw

function Set-OrAddEnvLine {
    param(
        [string]$text,
        [string]$key,
        [string]$value
    )
    $pattern = "(?m)^$([regex]::Escape($key))=.*$"
    $line = "$key=$value"
    if ($text -match $pattern) {
        return [regex]::Replace($text, $pattern, $line)
    }
    return ($text.TrimEnd() + "`r`n" + $line + "`r`n")
}

$content = Set-OrAddEnvLine -text $content -key "DASHBOARD_PUBLIC_URL" -value $baseUrl
$content = Set-OrAddEnvLine -text $content -key "DASHBOARD_OAUTH_REDIRECT_URI" -value $redirectUrl
$content = Set-OrAddEnvLine -text $content -key "DASHBOARD_HOST" -value "127.0.0.1"
$content = Set-OrAddEnvLine -text $content -key "TRUST_PROXY" -value "true"
$content = Set-OrAddEnvLine -text $content -key "VITE_DASHBOARD_API_BASE_URL" -value $baseUrl

Set-Content -Path $envFile -Value $content -Encoding UTF8

Write-Host "Aktualisiert in .env:" -ForegroundColor Green
Write-Host "  DASHBOARD_PUBLIC_URL=$baseUrl" -ForegroundColor Cyan
Write-Host "  DASHBOARD_OAUTH_REDIRECT_URI=$redirectUrl" -ForegroundColor Cyan
Write-Host "  DASHBOARD_HOST=127.0.0.1" -ForegroundColor Cyan
Write-Host "  TRUST_PROXY=true" -ForegroundColor Cyan
Write-Host "  VITE_DASHBOARD_API_BASE_URL=$baseUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Wichtig: npm run build:dashboard ausführen, dann Bot neu starten." -ForegroundColor Yellow
Write-Host "Wichtig: Dieselbe Redirect-URL auch im Discord Developer Portal eintragen." -ForegroundColor Yellow
