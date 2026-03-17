$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$tunnelName = 'kaique-entrevista'
$publicHost = 'app.kaiquetransportes.com.br'
$logDir = Join-Path $projectRoot 'storage\logs'
$logStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$phpOutLog = Join-Path $logDir "public-hosting-php.$logStamp.out.log"
$phpErrLog = Join-Path $logDir "public-hosting-php.$logStamp.err.log"
$cloudflaredOutLog = Join-Path $logDir "public-hosting-cloudflared.$logStamp.out.log"
$cloudflaredErrLog = Join-Path $logDir "public-hosting-cloudflared.$logStamp.err.log"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

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

        if ($found) { return $found.FullName }
    }

    return $null
}

$cloudflaredExe = Find-Cloudflared
if (-not $cloudflaredExe) {
    throw "cloudflared não encontrado. Instale com: winget install --id Cloudflare.cloudflared -e"
}

$envKeys = @(
    'APP_ENV',
    'APP_DEBUG',
    'APP_FORCE_HTTPS',
    'APP_URL',
    'SESSION_SECURE_COOKIE',
    'SESSION_ENCRYPT',
    'SESSION_SAME_SITE',
    'SANCTUM_STATEFUL_DOMAINS'
)

$previousEnv = @{}
foreach ($key in $envKeys) {
    $previousEnv[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}

function Restore-PreviousEnvironment {
    foreach ($key in $envKeys) {
        $previous = $previousEnv[$key]

        if ([string]::IsNullOrEmpty($previous)) {
            Remove-Item "Env:$key" -ErrorAction SilentlyContinue
        } else {
            Set-Item "Env:$key" -Value $previous
        }
    }
}

$configPath = Join-Path $env:USERPROFILE ".cloudflared\config.yml"
if (-not (Test-Path $configPath)) {
    throw "Config do túnel não encontrada em $configPath"
}

Get-Process -Name cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force
}

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'php.exe' -and $_.CommandLine -match 'artisan serve' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

php artisan optimize:clear | Out-Host

try {
    $env:APP_ENV = 'production'
    $env:APP_DEBUG = 'false'
    $env:APP_FORCE_HTTPS = 'true'
    $env:APP_URL = "https://$publicHost"
    $env:SESSION_SECURE_COOKIE = 'true'
    $env:SESSION_ENCRYPT = 'true'
    $env:SESSION_SAME_SITE = 'lax'
    $env:SANCTUM_STATEFUL_DOMAINS = $publicHost

    $envSummary = @(
        "APP_ENV=$($env:APP_ENV)",
        "APP_DEBUG=$($env:APP_DEBUG)",
        "APP_FORCE_HTTPS=$($env:APP_FORCE_HTTPS)",
        "APP_URL=$($env:APP_URL)",
        "SESSION_SECURE_COOKIE=$($env:SESSION_SECURE_COOKIE)",
        "SESSION_ENCRYPT=$($env:SESSION_ENCRYPT)",
        "SANCTUM_STATEFUL_DOMAINS=$($env:SANCTUM_STATEFUL_DOMAINS)"
    )

    Write-Host "Public runtime env:"
    $envSummary | ForEach-Object { Write-Host " - $_" }

    $phpProcess = Start-Process -FilePath "php" -ArgumentList @("artisan", "serve", "--host=127.0.0.1", "--port=8000") -PassThru -WindowStyle Hidden -RedirectStandardOutput $phpOutLog -RedirectStandardError $phpErrLog
    Start-Sleep -Seconds 2

    $cfProcess = Start-Process -FilePath $cloudflaredExe -ArgumentList @("tunnel", "run", $tunnelName) -PassThru -WindowStyle Hidden -RedirectStandardOutput $cloudflaredOutLog -RedirectStandardError $cloudflaredErrLog

    Start-Sleep -Seconds 3

    if ($cfProcess.HasExited) {
        $cloudflaredOutput = ''
        if (Test-Path $cloudflaredErrLog) {
            $cloudflaredOutput = Get-Content $cloudflaredErrLog -Tail 40 | Out-String
        } elseif (Test-Path $cloudflaredOutLog) {
            $cloudflaredOutput = Get-Content $cloudflaredOutLog -Tail 40 | Out-String
        }

        throw "cloudflared encerrou ao iniciar. Últimas linhas:`n$cloudflaredOutput"
    }

    $localStatus = 'DOWN'
    try {
        $localStatus = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:8000" -TimeoutSec 10).StatusCode
    } catch {
        $localStatus = 'DOWN'
    }

    Write-Host "PHP PID: $($phpProcess.Id)"
    Write-Host "Cloudflared PID: $($cfProcess.Id)"
    Write-Host "Local status: $localStatus"
    Write-Host "URL fixa: https://$publicHost"
    Write-Host "Log PHP out: $phpOutLog"
    Write-Host "Log PHP err: $phpErrLog"
    Write-Host "Log cloudflared out: $cloudflaredOutLog"
    Write-Host "Log cloudflared err: $cloudflaredErrLog"
    Write-Host "Se o domínio ainda não abrir, aguarde propagação DNS e teste novamente em 5-15 minutos."
} finally {
    Restore-PreviousEnvironment
}
