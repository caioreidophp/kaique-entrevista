$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$tunnelName = 'kaique-entrevista'
$publicHost = 'app.kaiquetransportes.com.br'

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

$phpProcess = Start-Process -FilePath "php" -ArgumentList @("artisan", "serve", "--host=127.0.0.1", "--port=8000") -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

$cfProcess = Start-Process -FilePath $cloudflaredExe -ArgumentList @("tunnel", "run", $tunnelName) -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

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
Write-Host "Se o domínio ainda não abrir, aguarde propagação DNS e teste novamente em 5-15 minutos."
