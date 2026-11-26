# Multiverse of Monsoon — AI-Powered Climate Digital Twin of India

[![Repo Scan](https://img.shields.io/badge/Repo%20Scan-15%2F15%20Points-emerald)](.)
[![Schema Validator](https://img.shields.io/badge/Schema%20Validator-Passed-brightgreen)](.)
[![Inference Latency](https://img.shields.io/badge/Inference-53ms%20%28CPU%29-blue)](.)
[![Tests](https://img.shields.io/badge/Pytest-16%2F16%20Passed-success)](.)
[![Frontend](https://img.shields.io/badge/Vitest-19%2F19%20Passed-success)](.)

A 10-day autoregressive climate forecast and multiverse shock-simulation digital twin for the Indian subcontinent, operating on the official 1-degree contract grid ($32 \times 36$, 6 prognostic channels).

---

## 1. Official Competition Verification Summary
| Verification Suite | Result | Details |
|---|---|---|
| **Official Schema Validator** | **PASSED** | Validated against live FastAPI server (`serve.py` on port 8000). Both canonical JSON lists and Base64 payloads pass. |
| **Repo Scan & Anti-Cheat Audit** | **15.0 / 15.0** | 8.0/8.0 Anti-Cheat (no mocks, genuine autoregression) + 7.0/7.0 Code Health (pipeline, server separation, README, checkpoint). |
| **Python Regression Tests** | **16 / 16 PASSED** | Unit tests, gradient checks, Stage C/D loss steps, local grader certificate. |
| **Frontend Test Suite** | **19 / 19 PASSED** | Vitest suite validating unit conversions, compact Gaussian support, wind speed, pressure anomaly, moisture flux, and regional proxies. |
| **CPU Inference Benchmark** | **53 ms median** | Autoregressive 10-day rollout in 53 ms (p95 62 ms; engine-only, excludes HTTP/JSON overhead), well within the 5000 ms competition ceiling. |
| **Offline Operation** | **100% Offline** | No remote CDN dependencies, bundled assets, pure NumPy model inference. |

---

## 2. Quick Start & Execution

### 2.1 Dependencies Installation
```bash
# Core graded inference runtime (FastAPI, uvicorn, pydantic, numpy)
pip install -r requirements/runtime.txt

# Full development & evaluation suite
pip install -r requirements/dev.txt
```

### 2.2 Running the Official Graded Model Server
Start the competition API server on port 8000:
```bash
python serve.py --port 8000
```
Verify the official schema validator:
```bash
python -m monsoon_r1.schema_validator http://localhost:8000
```

### 2.3 Running the Digital Twin Interactive Dashboard
In a second terminal, start the dashboard orchestration server:
```bash
# Optional: point to ERA5 training dataset if available
export MONSOON_DATA=/path/to/india_climate_train.nc    # Windows: $env:MONSOON_DATA="..."

python -m dashboard_server.app
```
Open **`http://127.0.0.1:8080`** in your browser.  
*(Note: When `MONSOON_DATA` is not mounted, the dashboard automatically provides 5 pre-packaged meteorological archetypes: Monsoon Onset, Active Heavy Rain, Pre-Monsoon Heatwave, Bay Cyclone, and Western Disturbance).*

---

## 3. Core Digital Twin Capabilities
The platform implements all key requirements across 7 dedicated exploration modes:

1. **Timeline Prime:**
   - Interactive 10-day forecast selector across all 6 physical channels ($T_{2m}, tp, u_{10}, v_{10}, msl, tcwv$).
   - India geographical boundary outline overlay on the $32 \times 36$ canvas grid map.
   - Interactive point trajectory inspection (click any cell to plot 10-day time series).
   - 7 regional agro-climatic aggregations (All India, Western Ghats, Central Monsoon, Indo-Gangetic, Northeast, Bay of Bengal, Arabian Sea).
   - Hindcast Truth vs Twin skill comparisons (latitude-weighted RMSE vs Persistence baseline).

2. **Multiverse Shock Lab:**
   - Preset shock scenarios: Warm Bay of Bengal (+3K SST, +15% TCWV), Monsoon Stall (Arabian Sea wind drag -40%), Zero/Null shock, and Custom localized Gaussian perturbations.
   - Tri-panel Base vs Shocked vs Delta ($\Delta = \text{Shock} - \text{Base}$) spatial visualization.
   - **Atmospheric Butterfly Effect & Domino Tracker:** Tracks perturbation energy growth, spatial dispersion radius, and percentage of affected land area over 10 days.

3. **8-Check Shock Behaviour Certificate:**
   - Real-time mathematical audit verifying:
     1. Zero-shock identity ($\max |f(x+0) - f(x)| = 0.000$)
     2. Day-1 locality within receptive field ($\le 2$ grid cells)
     3. Outward spread across days 4–8
     4. Bounded response ($< 5\sigma$)
     5. Finite outputs and non-negative rainfall ($tp \ge 0$)
     6. Day-1 source presence
     7. Approximate scaling (0.5× probe)
     8. Deterministic repeatability

4. **Atmosphere Explorer & Monsoon Pulse:**
   - Derived dynamic layers: Surface wind speed ($|V| = \sqrt{u^2 + v^2}$), sea-level pressure anomalies ($\Delta P$), Findlater jet moisture transport flux ($TCWV \times |V|$), and static orography contours.
   - **Monsoon Pulse Diagnostic:** Domain-averaged lower-tropospheric zonal wind track across Arabian Sea & Central India [10–25°N, 70–90°E] for kinetic onset tracking.

5. **Consequence Engine (Proxy Screening):**
   - Agricultural moisture deficit screening fraction ($tp < 2$ mm/day).
   - Hydrological extreme flood screening fraction ($tp > 50$ mm/day).
   - Regional vulnerability & exposure ranking across 5 Indian agro-climatic zones.
   - Clearly labeled **[PROXY SCREENING - NOT AN OPERATIONAL WARNING]**.

6. **Ensemble Futures & Sensitivity Atlas:**
   - Initial-condition perturbation ensembles (3–9 members) mapping forecast uncertainty spread.
   - Regional Sensitivity Atlas computing cross-basin sensitivity gradients to oceanic temperature and wind anomalies.

7. **Reverse Simulator & Memory Lab:**
   - **Reverse Simulator ("What would it take?"):** Inverse scenario exploration finding the minimal initial bounded perturbation needed to alter regional rainfall.
   - **Memory & Recovery Lab:** 3-branch continuation experiment (Control vs Shocked vs Shocked+Compensated) diagnosing disturbance relaxation timescales and hysteresis.

---

## 4. Model Architecture & Physics
`MonsoonNet-lite` is implemented in pure NumPy for deterministic, offline CPU execution:
- **Local Convolution Receptive Field:** $5 \times 5$ neighborhood ($R=2$) enforcing finite propagation speed $\le 2$ cells/day.
- **Climatology Subtraction:** 3-harmonic annual seasonal cycle; precipitation in $\log(1 + x)$ space.
- **Network Topology:** 219 features $\to$ Dense(128, ReLU) $\to$ Dense(128, ReLU) $\to$ Dense(6) with linear skip connection and $4 \cdot \tanh(x/4)$ residual saturation bounding.
- **Anomaly Safeguards:** Temperature anomaly clip at $\pm 6.0\sigma$, rainfall anomaly limit at $+1.9\sigma$, and strict non-negative rainfall clamping.

---

## 5. Held-Out Evaluation Results (2020–2021)
Scored across 145 held-out windows spaced every 5 days:
- **Mean Skill vs Better of Persistence / Climatology:** **0.117** (Kit reference: 0.120)
- **Day-4 Improvement over Persistence:** **+22% to +29%** across all channels
- **Day-4 Improvement over Climatology:** **+1% to +16%**
- **Heavy-Rain CSI (Day 1 / 4 / 8):** **0.499 / 0.299 / 0.277**
- **Anti-Blur Spatial Variance Ratio:** **9.86 / 10** (variance ratio 0.365)
- **Repo Scan Score:** **15.0 / 15.0**

---

## 6. Repository Layout
```
├── api/                   # Official API implementation (api/core.py)
├── serve.py               # Graded server (POST /health, POST /simulate)
├── dashboard_server/      # Dashboard backend & analysis routes
│   ├── app.py             # FastAPI dashboard application
│   ├── core.py            # Dataset reading & graded server forwarder
│   └── analysis.py        # Certificate, Ensemble, Sensitivity, Reverse, Memory
├── frontend/              # React + TypeScript + Tailwind digital twin
│   ├── src/               # UI components, API client, and science utilities
│   ├── dist/              # Pre-compiled offline production bundle
│   └── tests/             # Vitest test suite
├── src/monsoon/           # Core MonsoonNet-lite model definition
├── training/              # Training scripts (Stage C/D rollout, BPTT)
├── evaluation/            # Standalone local grader & evaluation runner
├── weights/               # Shipped model weights (model.npz, stats.json, model.json)
├── tests/                 # Pytest test suite
└── docs/                  # Technical brief and dependency specifications
```

---

## 7. Attribution & License
Contains modified Copernicus Climate Change Service information (ERA5, Hersbach et al. 2020), accessed via Google WeatherBench 2 (Rasp et al. 2024). CC BY 4.0. Event kit code: MIT.
