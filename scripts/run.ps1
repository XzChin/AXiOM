$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Virtual environment Python not found: $python"
}

Write-Host "Starting AXiOM model server..." -ForegroundColor Cyan
$model = Start-Process -FilePath $python `
    -ArgumentList @("serve.py", "--port", "8000") `
    -PassThru -NoNewWindow

try {
    Write-Host "Starting AXiOM dashboard..." -ForegroundColor Cyan
    & $python -m dashboard_server.app
}
finally {
    if ($model -and -not $model.HasExited) {
        Stop-Process -Id $model.Id -Force -ErrorAction SilentlyContinue
    }
}
