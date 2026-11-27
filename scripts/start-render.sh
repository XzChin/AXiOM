#!/usr/bin/env bash
set -e

export MODEL_URL="${MODEL_URL:-http://127.0.0.1:8000}"

# Use historical data only if the actual HDF5 file is present.
if [ -f "data/india_climate_train.nc" ] && python -c 'import pathlib,sys; sys.exit(0 if pathlib.Path("data/india_climate_train.nc").read_bytes()[:8] == bytes.fromhex("894844460d0a1a0a") else 1)'; then
    export MONSOON_DATA="data/india_climate_train.nc"
    echo "Real NetCDF4 dataset detected."
else
    unset MONSOON_DATA
    echo "WARNING: Dataset unavailable; dashboard will use its labelled sample scenarios."
fi

# Start the existing model API internally.
python -m uvicorn serve:app --host 127.0.0.1 --port 8000 &
MODEL_PID=$!

cleanup() {
    kill "$MODEL_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for model initialization before starting the public dashboard.
python - <<'PY'
import time
import urllib.request

for attempt in range(90):
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8000/health",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=2) as response:
            if response.status == 200:
                print("Model API is ready.")
                break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Model API failed to become ready.")
PY

python -m uvicorn dashboard_server.app:app --host 0.0.0.0 --port "${PORT:-10000}"