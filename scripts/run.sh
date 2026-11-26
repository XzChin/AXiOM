#!/usr/bin/env sh
# Starts the model server (8000) and dashboard (8080). Optional: export MONSOON_DATA=/path/to/india_climate_train.nc
cd "$(dirname "$0")/.." || exit 1
python serve.py --port 8000 &
trap 'kill $!' EXIT INT TERM
python -m dashboard_server.app
