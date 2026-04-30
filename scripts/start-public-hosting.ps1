param(
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Find-Cloudflared {
    $candidates = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps",
        "C:\Program Files\cloudflared",
        "C:\Program Files\Cloudflare"
    )

    foreach ($base in $candidates) {
        if (-not (Test-Path $base)) { continue }

        $found = Get-ChildItem -Path $base -Recurse -Filter "cloudflared*.exe" -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            Select-Object -First 1

        if ($found) {
            return $found.FullName
        }
    }

    return $null
}

# Stop previous processes to avoid duplicated tunnels/ports
Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'php.exe' -and $_.CommandLine -match 'artisan serve' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Get-Process -Name cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force
}

if (-not $NoBuild) {
    npm run build | Out-Host
}

php artisan optimize:clear | Out-Host

$phpProcess = Start-Process -FilePath "php" -ArgumentList @("artisan", "serve", "--host=127.0.0.1", "--port=8000") -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

$cloudflaredExe = Find-Cloudflared
if (-not $cloudflaredExe) {
    throw "cloudflared não encontrado. Instale com: winget install --id Cloudflare.cloudflared -e"
}

$outLog = Join-Path $projectRoot "storage\logs\cloudflared.out.log"
$errLog = Join-Path $projectRoot "storage\logs\cloudflared.err.log"

if (Test-Path $outLog) { Remove-Item $outLog -Force }
if (Test-Path $errLog) { Remove-Item $errLog -Force }

$cfProcess = Start-Process -FilePath $cloudflaredExe -ArgumentList @("tunnel", "run") -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 8

$url = $null
$logSources = @()

if (Test-Path $outLog) {
    $logSources += (Get-Content $outLog)
}

if (Test-Path $errLog) {
    $logSources += (Get-Content $errLog)
}

if ($logSources.Count -gt 0) {
    $line = $logSources | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
    if ($line) {
        $match = [regex]::Match($line.ToString(), 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) { $url = $match.Value }
    }
}

Write-Host "PHP PID: $($phpProcess.Id)"
Write-Host "Cloudflared PID: $($cfProcess.Id)"
if ($url) {
    Write-Host "URL pública: $url"
} else {
    Write-Host "URL ainda não detectada. Rode: Get-Content .\storage\logs\cloudflared.err.log -Tail 80"
}
