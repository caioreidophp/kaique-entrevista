$ErrorActionPreference = 'SilentlyContinue'

Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'php.exe' -and $_.CommandLine -match 'artisan serve' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Get-Process -Name cloudflared | ForEach-Object {
    Stop-Process -Id $_.Id -Force
}

Write-Host "Hospedagem temporária parada (artisan + cloudflared)."
