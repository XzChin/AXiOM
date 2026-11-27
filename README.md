# 🌧️ Multiverse of Monsoon — AI-Powered Climate Digital Twin of India

An AI-powered climate forecasting and simulation platform for the Indian subcontinent. Multiverse of Monsoon combines autoregressive weather prediction, shock-based scenario simulation, ensemble forecasting and model validation into an interactive climate digital twin.

<p align="center">
  <a href="https://axiom-digital-twin.onrender.com"><strong>🌐 Live Demo</strong></a> ·
  <a href="https://github.com/XzChin/AXiOM"><strong>GitHub Repository</strong></a>
</p>

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![React](https://img.shields.io/badge/Frontend-React-61DAFB)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6)
![NumPy](https://img.shields.io/badge/Inference-NumPy-013243)
![Deployment](https://img.shields.io/badge/Deployment-Render-46E3B7)
![Status](https://img.shields.io/badge/Status-Deployed-success)

---

## 🌍 Live Application

**Live URL:** https://axiom-digital-twin.onrender.com

The application is deployed as a unified service on Render.

The deployment includes:
- React + TypeScript frontend.
- FastAPI dashboard backend.
- Independent internal model inference API.
- Pre-trained NumPy model weights.
- Historical climate dataset, when available.
- Scientific analysis and simulation modules.

The dashboard backend serves the production frontend and exposes the application APIs through the same public origin.

---

## 🎯 Project Overview

Weather forecasting systems generally provide a single predicted future. However, real atmospheric systems are nonlinear and sensitive to initial conditions.

Multiverse of Monsoon explores a different approach: a climate digital twin that allows users to investigate not only what the model predicts, but also how the atmosphere may respond to different hypothetical disturbances.

The platform supports:

1. Autoregressive multi-day climate forecasting.
2. Atmospheric shock and perturbation simulations.
3. Mathematical validation of shock behaviour.
4. Ensemble-based uncertainty exploration.
5. Regional sensitivity analysis.
6. Reverse scenario simulation.
7. Disturbance recovery and atmospheric memory experiments.

The model operates on India's regional climate grid and predicts six atmospheric variables.

### Model Grid

| Property | Value |
|---|---|
| Geographic domain | Indian subcontinent |
| Grid resolution | 1 degree |
| Grid dimensions | 32 × 36 |
| Prognostic channels | 6 |
| Forecast horizon | Up to 10 days in the dashboard |
| Model implementation | Pure NumPy |
| Model identifier | `monsoonnet-lite-numpy-1.0` |

### Predicted Atmospheric Variables

| Channel | Variable | Description |
|---|---|---|
| 1 | `T2m` | 2-metre temperature |
| 2 | `tp` | Total precipitation |
| 3 | `u10` | 10-metre zonal wind |
| 4 | `v10` | 10-metre meridional wind |
| 5 | `msl` | Mean sea-level pressure |
| 6 | `tcwv` | Total column water vapour |

---

## 🏗️ System Architecture

```text
                    USER
                     |
                     v
          React + TypeScript Frontend
                     |
                     v
             Render Public URL
                     |
                     v
             Dashboard FastAPI
              (Public Port)
                     |
          +----------+-----------+
          |                      |
          v                      v
    Dashboard APIs         Static Frontend
          |
          +---------------------------+
          |                           |
          v                           v
    Model API Proxy             Analysis Engine
          |                     - Certificate
          v                     - Ensemble
    Model FastAPI               - Sensitivity
    (127.0.0.1:8000)            - Reverse
          |                     - Memory Lab
          v
    MonsoonNet-lite
          |
          v
    Pre-trained Weights
    - model.npz
    - model.json
    - stats.json

          Historical Dataset
          india_climate_train.nc
```

### Backend Components

**1. Model Inference API — `serve.py`**

The official FastAPI model server handles:
- Model initialization and weight loading.
- Input validation.
- Atmospheric perturbation application.
- Autoregressive inference.
- Forecast output generation.

**2. Dashboard Backend — `dashboard_server/`**

The dashboard backend provides:
- Historical climate data access.
- Forecast input preparation.
- Model API forwarding.
- Regional analysis.
- Shock behaviour certificates.
- Ensemble simulations.
- Sensitivity calculations.
- Reverse simulation.
- Memory and recovery experiments.

**3. Frontend — `frontend/`**

The frontend is implemented using React, TypeScript and Tailwind CSS.

It provides interactive forecast visualization, geographical grid exploration, scenario configuration, charts and scientific analysis dashboards.

---

## 🧠 Core Features

### 1. Timeline Prime — Climate Forecast Explorer

Explore the model's multi-day atmospheric forecasts.

Features:
- Interactive 10-day forecast timeline.
- Six atmospheric channel visualizations.
- India geographical grid visualization.
- Interactive grid-cell selection.
- Point-wise atmospheric trajectory inspection.
- Seven regional agro-climatic aggregations.
- Hindcast comparison against persistence.
- Forecast skill visualization.

### 2. Multiverse Shock Lab

Investigate how atmospheric disturbances affect the predicted future.

Available scenarios include:
- Warm Bay of Bengal.
- Monsoon stall.
- Zero/null perturbation.
- Custom localized Gaussian perturbations.

Features:
- Base forecast versus shocked forecast.
- Spatial difference visualization.
- Perturbation propagation.
- Atmospheric butterfly-effect exploration.
- Domino-style disturbance tracking.
- Spatial dispersion and affected-area analysis.

### 3. Shock Behaviour Certificate — Trust and Validation

A mathematical validation module that checks whether the model responds to atmospheric perturbations in physically and computationally consistent ways.

The eight checks include:

1. Zero-shock identity.
2. Day-one perturbation locality.
3. Outward spatial propagation.
4. Bounded response.
5. Finite outputs and non-negative rainfall.
6. Day-one source presence.
7. Approximate perturbation scaling.
8. Deterministic repeatability.

The certificate helps distinguish expected model behaviour from unstable or invalid responses.

### 4. Atmosphere Explorer and Monsoon Pulse

Explore derived atmospheric quantities and monsoon dynamics.

Derived visualization layers include:
- Surface wind speed.
- Sea-level pressure anomalies.
- Moisture transport flux.
- Orographic elevation contours.

The Monsoon Pulse diagnostic examines lower-tropospheric zonal wind behaviour across the Arabian Sea and Central India.

### 5. Consequence Engine — Proxy Screening

Explore potential regional consequences of predicted rainfall patterns.

Indicators include:
- Agricultural moisture deficit screening.
- Heavy-rainfall screening.
- Regional vulnerability comparisons.
- Exposure ranking across Indian agro-climatic zones.

**Important:** These are proxy screening indicators, not operational flood warnings, agricultural advisories or official disaster predictions.

### 6. Ensemble Futures and Sensitivity Atlas

Explore uncertainty and sensitivity in atmospheric predictions.

**Ensemble Futures**
- Initial-condition perturbation ensembles.
- Multiple forecast members.
- Forecast spread visualization.
- Comparison of alternative atmospheric futures.

**Sensitivity Atlas**
- Regional sensitivity analysis.
- Oceanic temperature perturbations.
- Wind anomaly experiments.
- Cross-basin sensitivity gradients.

### 7. Reverse Simulator and Memory Lab

**Reverse Simulator — What Would It Take?**

Investigate the initial perturbations required to produce a specified regional rainfall response.

**Memory and Recovery Lab**

Compare three atmospheric trajectories:

- Control.
- Shocked.
- Shocked and compensated.

The experiment explores disturbance relaxation, recovery behaviour and hysteresis.

---

## ⚙️ Model Architecture

The project uses **MonsoonNet-lite**, a compact NumPy-based autoregressive neural network.

### Architecture

```text
Atmospheric Input
       |
       v
Local 5 × 5 Receptive Field
       |
       v
219 Input Features
       |
       v
Dense Layer (128)
       |
       v
ReLU
       |
       v
Dense Layer (128)
       |
       v
ReLU
       |
       v
Dense Output (6)
       |
       v
Linear Skip Connection
       |
       v
Bounded Residual
       |
       v
Six Atmospheric Predictions
```

### Model Characteristics

- Pure NumPy inference.
- Local convolution-style receptive field.
- Autoregressive rollout.
- Seasonal climatology subtraction.
- Residual-based prediction.
- Bounded anomaly handling.
- Non-negative precipitation constraint.
- Deterministic inference.

The model uses a 5 × 5 spatial receptive field, corresponding to a radius of two grid cells.

### Model Artifacts

The trained model is stored in the repository:

| File | Purpose |
|---|---|
| `weights/model.npz` | Trained neural network parameters |
| `weights/model.json` | Model metadata and configuration |
| `weights/stats.json` | Normalization and statistical information |

The deployed application loads the existing trained weights. It does not retrain the model during deployment.

---

## 🌦️ Historical Climate Dataset

The application supports the historical climate dataset:

`data/india_climate_train.nc`

Dataset characteristics:

- NetCDF4/HDF5 format.
- 6,209 time steps.
- 6 atmospheric channels.
- 32 × 36 spatial grid.
- 2 static channels.

The dataset is Git LFS tracked.

The dashboard uses the historical dataset when it is available and correctly loaded.

When the dataset is unavailable, the application can provide five labelled synthetic meteorological archetypes:

1. Monsoon Onset.
2. Active Monsoon Heavy Rain.
3. Pre-Monsoon Heatwave.
4. Post-Monsoon Bay Cyclone.
5. Western Disturbance.

Synthetic scenarios are explicitly labelled as synthetic inputs and should not be confused with real historical observations.

---

## 🔌 API Reference

The application exposes two FastAPI services.

### Model Inference API

The model server runs internally on port `8000`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/health` | Model readiness check |
| POST | `/simulate` | Run atmospheric simulation |

**Health request**

```bash
curl -X POST http://localhost:8000/health \
  -H "Content-Type: application/json" \
  -d "{}"
```

**Simulation request**

```json
{
  "init_states": "three atmospheric input states",
  "doy_sincos": [0.5, 0.866],
  "steps": 10,
  "perturbation": null
}
```

The `init_states` field must contain an array with shape `(3, 6, 32, 36)`. The `doy_sincos` pair represents the day-of-year encoding. The optional perturbation has shape `(6, 32, 36)`.

The API also supports the documented Base64 array representation.

### Dashboard API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/meta` | Model metadata, statistics and grid information |
| GET | `/api/sample-windows` | Synthetic scenario inputs |
| GET | `/api/window?date=YYYY-MM-DD` | Historical input window and future truth |
| POST | `/api/model/health` | Proxy to model health endpoint |
| POST | `/api/model/simulate` | Proxy to model inference |
| POST | `/api/analysis/certificate` | Run shock behaviour certificate |
| POST | `/api/analysis/ensemble` | Run ensemble simulation |
| POST | `/api/analysis/sensitivity` | Run sensitivity analysis |
| POST | `/api/analysis/reverse` | Run reverse simulation |
| POST | `/api/analysis/memory` | Run memory and recovery experiment |

The dashboard and frontend use the same public origin, so the frontend can access these routes using relative `/api/...` paths.

---

## 💻 Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript |
| Styling | Tailwind CSS |
| Build Tool | Vite |
| Frontend Testing | Vitest |
| Backend | Python, FastAPI |
| Model Inference | NumPy |
| Data Processing | Xarray, NetCDF4 |
| Validation | Pydantic |
| ASGI Server | Uvicorn |
| Dataset | NetCDF4 / HDF5 |
| Version Control | Git, Git LFS |
| Hosting | Render |

---

## 🚀 Running Locally

### Prerequisites

- Python 3.12 recommended.
- Node.js and npm.
- Git.
- Git LFS.
- Access to the repository and its model/data files.

### 1. Clone the repository

```bash
git clone https://github.com/XzChin/AXiOM.git
cd AXiOM
```

For the deployment-ready branch:

```bash
git checkout experiment/shock-stability
```

Retrieve Git LFS files:

```bash
git lfs install
git lfs pull
```

### 2. Create a Python environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Install backend dependencies

```bash
pip install -r requirements/runtime.txt
```

For development and evaluation:

```bash
pip install -r requirements/dev.txt
```

### 4. Start the model API

Open Terminal 1:

```bash
python serve.py --port 8000
```

The model API will be available at:

`http://127.0.0.1:8000`

### 5. Configure historical data

Windows PowerShell:

```powershell
$env:MONSOON_DATA="data/india_climate_train.nc"
```

Linux/macOS:

```bash
export MONSOON_DATA=data/india_climate_train.nc
```

If the historical dataset is unavailable, leave `MONSOON_DATA` unset to use the labelled sample scenarios.

### 6. Start the dashboard backend

Open Terminal 2:

```bash
python -m dashboard_server.app
```

The dashboard backend will be available at:

`http://127.0.0.1:8080`

### 7. Start the frontend in development mode (optional)

Open Terminal 3:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
```

The Vite development server uses the configured API proxy. For the complete production-style application, use the dashboard backend, which serves the built frontend.

### 8. Build the frontend for production

```bash
npm ci --prefix frontend
npm run build --prefix frontend
```

The production frontend is generated in:

`frontend/dist/`

---

## ☁️ Deployment on Render

The project includes a Render Blueprint:

`render.yaml`

The production deployment is available at:

**https://axiom-digital-twin.onrender.com**

### Deployment configuration

| Setting | Value |
|---|---|
| Platform | Render |
| Runtime | Python |
| Region | Singapore |
| Plan | Free |
| Python | 3.12.10 |
| Model API | Internal port 8000 |
| Public dashboard | Render-provided `$PORT` |
| Blueprint | `render.yaml` |
| Startup script | `scripts/start-render.sh` |

### Build command

```bash
pip install -r requirements/runtime.txt && npm ci --prefix frontend && npm run build --prefix frontend
```

### Start command

```bash
bash scripts/start-render.sh
```

### Startup sequence

The startup script:

1. Configures the internal model API URL.
2. Checks whether the historical NetCDF4 dataset is available.
3. Starts the model inference server on `127.0.0.1:8000`.
4. Waits for the model health endpoint to return successfully.
5. Starts the public dashboard backend on Render's assigned port.
6. Serves the production frontend and dashboard APIs.

### Environment variables

| Variable | Value / Purpose |
|---|---|
| `PYTHON_VERSION` | `3.12.10` |
| `MODEL_URL` | `http://127.0.0.1:8000` |
| `MONSOON_DATA` | Set internally by the startup script if the real dataset is detected |
| `PORT` | Supplied by Render |

The current inference and dashboard architecture does not require an external AI provider API key for its NumPy model inference.

### Deployment verification

Check the following:

- Build completes successfully.
- `Real NetCDF4 dataset detected.` appears when the real dataset is present.
- `Model API is ready.` appears after model initialization.
- Dashboard responds with HTTP 200.
- `/api/meta` returns metadata.
- Simulation requests return actual model inference results.

**Deployment note:** Render's free tier has resource and availability limitations. The application may experience cold starts, and historical-data loading can take longer on a limited instance.

---

## 🧪 Testing and Evaluation

### Python tests

```bash
pytest
```

### Frontend tests

```bash
npm test --prefix frontend
```

### Frontend production build

```bash
npm run build --prefix frontend
```

### Official model API verification

```bash
python -m monsoon_r1.schema_validator http://localhost:8000
```

### Local evaluation

```bash
python evaluation/local_grader.py --help
```

The repository includes testing and evaluation infrastructure for model behaviour, schema validation, inference and frontend utilities.

---

## 📊 Evaluation and Validation

The project includes held-out evaluation and validation infrastructure.

Previously reported evaluation results in the project include:

| Metric | Reported Result |
|---|---:|
| Mean skill vs better of persistence/climatology | 0.117 |
| Day-4 improvement over persistence | +22% to +29% |
| Day-4 improvement over climatology | +1% to +16% |
| Heavy-rain CSI (Day 1 / 4 / 8) | 0.499 / 0.299 / 0.277 |
| Anti-blur spatial variance score | 9.86 / 10 |

These are project evaluation results, not guarantees of real-world forecast accuracy. Refer to the evaluation artifacts and technical documentation for the corresponding methodology and scope.

---

## ⚠️ Scientific Scope and Limitations

Multiverse of Monsoon is an experimental climate modelling and scenario exploration platform.

Important limitations:

- The model is not an operational weather forecasting authority.
- Scenario perturbations are controlled model experiments, not verified future weather events.
- Proxy consequence indicators are not official flood or agricultural warnings.
- Synthetic archetypes are not historical observations.
- Forecast uncertainty and sensitivity results depend on model assumptions and input conditions.
- A successful deployment does not independently validate scientific forecast skill.

The platform is intended for research, demonstration, experimentation and educational exploration.

---

## 📁 Repository Structure

```text
AXiOM/
│
├── api/
│   └── core.py
│
├── dashboard_server/
│   ├── app.py
│   ├── core.py
│   └── analysis.py
│
├── frontend/
│   ├── src/
│   ├── tests/
│   ├── dist/
│   ├── package.json
│   └── vite.config.ts
│
├── src/
│   └── monsoon/
│       └── model.py
│
├── training/
│   └── hdf5_reader.py
│
├── evaluation/
│   └── local_grader.py
│
├── tests/
│
├── weights/
│   ├── model.npz
│   ├── model.json
│   └── stats.json
│
├── data/
│   └── india_climate_train.nc
│
├── requirements/
│   ├── runtime.txt
│   ├── train.txt
│   └── dev.txt
│
├── scripts/
│   └── start-render.sh
│
├── render.yaml
├── serve.py
└── README.md
```

---

## 🔬 Research and Technical Documentation

For additional technical information, see:

- `AXiOM_Technical_Brief.pdf`
- `evaluation/`
- `training/`
- `docs/`

These contain further implementation, training and evaluation details.

---

## 👥 Contributors

Developed as part of the **Multiverse of Monsoon** climate modelling and simulation project.

Contributions include model development, ensemble and advanced simulation, trust and validation, dashboard integration, and deployment.

---

## 📜 Data Attribution and Licensing

The project uses modified Copernicus Climate Change Service information (ERA5), accessed through Google WeatherBench 2.

Relevant attribution:

- Hersbach et al. (2020), ERA5 reanalysis.
- Rasp et al. (2024), WeatherBench 2.

Climate data attribution and licensing should be followed according to the original data providers' terms, including CC BY 4.0 where applicable.

See the repository's `LICENSE` file for software licensing details.

---

<p align="center">
  <strong>Multiverse of Monsoon</strong><br/>
  Exploring India's atmospheric future through simulation, uncertainty and scientific validation.
</p>
