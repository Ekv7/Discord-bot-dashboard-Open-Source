# Quick Tunnel (trycloudflare.com) - fuer Tests ohne eigene Domain.
# Voraussetzung: cloudflared installiert (siehe https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)
# Bot muss laufen: npm start (Dashboard auf 127.0.0.1:3847)
#
# Hinweis: Die URL aendert sich bei jedem Start -> Discord OAuth Redirect muss jedes Mal neu gesetzt werden.
# Fuer feste URL: config/cloudflared.example.yml + Named Tunnel in Cloudflare Zero Trust.

$ErrorActionPreference = "Stop"
$port = if ($env:DASHBOARD_PORT) { [int]$env:DASHBOARD_PORT } else { 3847 }
$url = "http://127.0.0.1:$port"
$projectRoot = Split-Path -Parent $PSScriptRoot
$latestUrlFile = Join-Path $projectRoot "data\quick-tunnel-url.txt"

$localCloudflared = Join-Path $PSScriptRoot "bin\cloudflared.exe"
$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredExe = if ($cloudflaredCmd) { $cloudflaredCmd.Source } elseif (Test-Path $localCloudflared) { $localCloudflared } else { $null }
if (-not $cloudflaredExe) {
    Write-Host "cloudflared nicht gefunden." -ForegroundColor Yellow
    Write-Host "Installiere global oder lege scripts\\bin\\cloudflared.exe ab." -ForegroundColor Cyan
    Write-Host "  winget install --id Cloudflare.cloudflared" -ForegroundColor Cyan
    exit 1
}

Write-Host "Starte Tunnel -> $url" -ForegroundColor Green
Write-Host "Trage die angezeigte https-URL in Discord OAuth Redirects + DASHBOARD_OAUTH_REDIRECT_URI ein." -ForegroundColor Yellow

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
            Write-Host ""
        } catch {
            Write-Host "URL konnte nicht in Datei gespeichert werden: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & $cloudflaredExe tunnel --url $url 2>&1 | ForEach-Object { & $lineHandler ([string]$_) }
} finally {
    $ErrorActionPreference = $oldErrorActionPreference
}
