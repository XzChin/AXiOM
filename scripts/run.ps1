# Starts the model server (8000) and dashboard (8080). Optional: $env:MONSOON_DATA="C:\path\india_climate_train.nc"
Set-Location (Join-Path $PSScriptRoot "..")
$model = Start-Process python -ArgumentList "serve.py","--port","8000" -PassThru -NoNewWindow
try { python -m dashboard_server.app } finally { Stop-Process -Id $model.Id }
