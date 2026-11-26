# Multiverse of Monsoon

A 10-day autoregressive forecast and shock-simulation prototype for India on the 32 x 36, 1-degree contract grid.

## Read this first: verification status
| Item | Status |
|---|---|
| Model trained on the kit data and scored with the kit's scoring functions | Done |
| Request handling, model, shocks (Pytest, 11 tests) | Passed |
| Official schema validator | Passed against a **Starlette stand-in** using the same `api/core.py` |
| `serve.py` and `dashboard_server/app.py` under real FastAPI | **Not run** (FastAPI was unavailable). Run the validator before submitting |
| Dashboard in headless Chromium | Passed through the stand-in; `frontend/dist` was built with esbuild and the Tailwind compiler |
| `npm install`, Vite build, Vitest, React type check | **Not run** |
| xarray/netCDF4 data reading | **Not run**; training here used the system libhdf5 fallback |
| PowerShell and shell scripts | **Not run** |
| Offline Docker run, 4-core / 6 GB limits | **Not run** |

## Quick start (Python 3.10+ expected)
```
pip install -r requirements/runtime.txt
python serve.py --port 8000
```
Check it (install the organisers' kit wheel and `requests` first):
```
python -m monsoon_r1.schema_validator http://localhost:8000
```
Dashboard (second terminal; needs no Node.js):
```
pip install -r requirements/train.txt          # only to read demo dates from the .nc file
export MONSOON_DATA=/path/india_climate_train.nc     # PowerShell: $env:MONSOON_DATA="C:\path\india_climate_train.nc"
python -m dashboard_server.app                       # open http://127.0.0.1:8080
```
Without the dataset, load a JSON file containing `init_states` and `doy_sincos`.

## Model
`MonsoonNet-lite`, in **NumPy**. PyTorch was unavailable in the build environment, so this differs from the planned stack.
- Per cell: 5x5 neighbourhood of current anomalies, 3x3 day-to-day change, terrain, land mask, position and season (219 features).
- Two hidden layers of 128 units plus a linear skip; predicts a tanh-bounded next-day change.
- Anomalies against a 3-harmonic climatology; rain in log1p space.
- Trained one step first, then with rollouts of 2, 4, 8 and 12 days.
- No grid-wide operations: a change can move at most 2 cells per step.
- Safeguards chosen on validation data: rain output scale 1.3 and rain anomaly limit 1.9.

## Results: 2020-2021 held-out test (145 windows, one every 5 days)
Trained on 2005-2017. Choices were made on 2018-2019. The test years were scored once, after settings were frozen.
Full numbers: `evaluation/results_test_2020_2021.json`.

| Measure | Result |
|---|---|
| Mean per-window RMSE skill vs better of persistence/climatology (kit function; full-marks reference 0.12) | 0.117 |
| Day 4: improvement over persistence, by channel | 22% to 29% |
| Day 4: improvement over climatology, by channel | 1% to 16% (rain: 1%) |
| Heavy-rain CSI, day 1 / 4 / 8: model | 0.499 / 0.299 / 0.277 |
| Same, best of persistence and climatology | 0.445 / 0.278 / 0.281 |
| Anti-blur (kit function) | 9.86 / 10 |
| Shock behaviour, mean over 11 windows (kit function) | 11.9 / 15 |
| Zero shock identical on those windows | Yes |
| Invalid rollouts | 0 |

**These are not predicted competition scores.** The hidden windows are 2023-2024 and are described as five real windows
(the project summary lists specific event types). This test uses regularly spaced windows from 2020-2021.
The climatology baseline here is the kit's 15-day smoothed method fitted on 2005-2017; the organisers' version may differ.

### Known weaknesses
- Day 8 is close to climatology, and slightly worse for rain and v wind. Day-8 heavy-rain CSI is below climatology.
- Day-4 rain barely beats climatology.
- Monsoon-stall shock: the kit's outward-propagation check passed on **0 of 11** windows.
- Warm-ocean shock: propagation passed on 6 of 11 windows; stability on 9 of 11 (rain can differ by more than 5 std).
- Day-8 rain keeps only 37% of real spatial variance (kit target: at least 40%).
- The rain limit and scale are engineering adjustments, not physics.
- The shipped weights are the tested ones; they were not retrained on 2018-2021.

## Reproduce
```
pip install -r requirements/dev.txt
python training/train.py --data PATH.nc --out weights/new.npz --iters 16000 --rollout "2:600:3e-4,4:800:2e-4,8:900:1.2e-4,12:500:8e-5"
python evaluation/evaluate.py --data PATH.nc --weights weights/model.npz --years 2020 2021    # needs the kit wheel
python scripts/benchmark.py
pytest -q tests
```
Retraining on another machine may not give identical weights. Do not tune further on 2020-2021 and still call it a held-out test.

## Layout
`src/monsoon` model · `training` · `evaluation` · `api` + `serve.py` graded API · `dashboard_server` · `frontend` · `tests` · `weights` · `docs`

## Dashboard scope
Included: 10-day selector, six variables, grid maps, cell timeline, Truth vs Twin RMSE, two preset shocks and a custom
Gaussian shock, baseline/shocked/delta, live behaviour checks, inference timing.

Not built: regional aggregates, political India outline, Trust Panel, OOD warnings, replay, payload hash, Butterfly/Domino,
Atmosphere Explorer, Monsoon Pulse, ensemble, sensitivity, impact proxies, Radar, narrator, Reverse Simulator,
Memory & Recovery Lab, 3D. Plotly.js is not used (charts are SVG).

## Data attribution
Contains modified Copernicus Climate Change Service information (ERA5, Hersbach et al. 2020), accessed through Google
WeatherBench 2 (Rasp et al. 2024). ERA5 is licensed under CC BY 4.0. Event kit code: MIT.
The training NetCDF is not included in this repository.
