"""Backend Shock Engine: scenario generation and model-response diagnostics."""
from __future__ import annotations

import numpy as np

from dashboard_server import analysis

NC, NLAT, NLON = 6, 32, 36

CHANNELS = ["t2m", "tp", "u10", "v10", "msl", "tcwv"]

PRESETS = {
    "warm_ocean": {
        "label": "Warm Bay scenario",
        "description": "Localized near-surface air temperature and TCWV perturbation.",
        "provenance": "MODEL SCENARIO",
        "region": {"lat": [8.0, 20.0], "lon": [82.0, 94.0]},
        "not_sst": True,
    },
    "monsoon_stall": {
        "label": "Monsoon Stall scenario",
        "description": "Localized reduction of both 10 m wind components.",
        "provenance": "MODEL SCENARIO",
        "region": {"lat": [8.0, 20.0], "lon": [65.0, 75.0]},
        "not_sst": False,
    },
    "zero": {
        "label": "Zero / Null Shock",
        "description": "No perturbation; identity comparison.",
        "provenance": "CONTROL",
        "region": None,
        "not_sst": False,
    },
}


def _validate_state(state):
    arr = np.asarray(state, dtype=np.float32)
    if arr.shape != (3, NC, NLAT, NLON):
        raise ValueError("init_states must have shape (3, 6, 32, 36).")
    if not np.isfinite(arr).all():
        raise ValueError("init_states must contain only finite values.")
    return arr


def _validate_doy(doy):
    arr = np.asarray(doy, dtype=np.float64)
    if arr.shape != (2,) or not np.isfinite(arr).all():
        raise ValueError("doy_sincos must contain two finite values.")
    if not np.isclose(np.linalg.norm(arr), 1.0, atol=0.02):
        raise ValueError("doy_sincos must be a normalized sine/cosine pair.")
    return arr.tolist()


def build_preset(name, last_state):
    if name not in PRESETS:
        raise ValueError("Unknown shock preset.")
    last = np.asarray(last_state, dtype=np.float32)
    if last.shape != (NC, NLAT, NLON) or not np.isfinite(last).all():
        raise ValueError("last_state must have shape (6, 32, 36) and finite values.")

    delta = np.zeros((NC, NLAT, NLON), dtype=np.float32)
    lat = np.arange(6.5, 38.0, 1.0)[:, None]
    lon = np.arange(65.5, 101.0, 1.0)[None, :]

    if name == "warm_ocean":
        mask = (lat >= 8) & (lat <= 20) & (lon >= 82) & (lon <= 94)
        delta[0][mask] = 3.0
        delta[5][mask] = 0.15 * last[5][mask]

    elif name == "monsoon_stall":
        mask = (lat >= 8) & (lat <= 20) & (lon >= 65) & (lon <= 75)
        delta[2][mask] = -0.40 * last[2][mask]
        delta[3][mask] = -0.40 * last[3][mask]

    return delta


def build_custom(channel, center_lat, center_lon, radius, amplitude):
    return analysis._gaussian_shock(
        channel, center_lat, center_lon, radius, amplitude
    )


def butterfly_metrics(base, shocked, perturbation):
    base = np.asarray(base, dtype=np.float32)
    shocked = np.asarray(shocked, dtype=np.float32)
    perturbation = np.asarray(perturbation, dtype=np.float32)

    if base.shape != shocked.shape or base.ndim != 4:
        raise ValueError("Base and shocked rollouts must have matching [day, 6, 32, 36] shapes.")
    if base.shape[1:] != (NC, NLAT, NLON):
        raise ValueError("Rollouts must contain six channels on a 32x36 grid.")
    if perturbation.shape != (NC, NLAT, NLON):
        raise ValueError("Perturbation must have shape (6, 32, 36).")
    if not all(np.isfinite(x).all() for x in (base, shocked, perturbation)):
        raise ValueError("Butterfly inputs must contain only finite values.")

    std = analysis._stats_std()
    if std.shape != (NC,) or not np.isfinite(std).all() or np.any(std <= 0):
        raise ValueError("Model channel standard deviations are invalid.")

    source_weight = np.abs(perturbation).sum(axis=0)
    total_source = float(source_weight.sum())

    lat_grid = np.broadcast_to(np.arange(6.5, 38.0, 1.0)[:, None], (NLAT, NLON))
    lon_grid = np.broadcast_to(np.arange(65.5, 101.0, 1.0)[None, :], (NLAT, NLON))

    if total_source > 0:
        center_lat = float((lat_grid * source_weight).sum() / total_source)
        center_lon = float((lon_grid * source_weight).sum() / total_source)
    else:
        center_lat = center_lon = None

    rows = []
    for day in range(len(base)):
        diff = shocked[day] - base[day]
        z = diff / std[:, None, None]
        cell_energy = np.sum(z ** 2, axis=0)
        affected = cell_energy > 0.05
        energy = float(cell_energy[affected].sum())
        affected_count = int(affected.sum())

        if energy > 0 and center_lat is not None:
            distance = np.hypot(lat_grid - center_lat, lon_grid - center_lon)
            radius = float((distance[affected] * cell_energy[affected]).sum() / energy)
        else:
            radius = 0.0

        rows.append({
            "day": day + 1,
            "energy": energy,
            "maxZ": float(np.abs(z).max()),
            "affectedCells": affected_count,
            "coverageFrac": affected_count / (NLAT * NLON) * 100.0,
            "meanRadius": radius,
        })

    return rows


def run_shock(init_states, doy_sincos, scenario="warm_ocean",
              channel=None, center_lat=15.0, center_lon=88.0,
              radius=3.0, amplitude=2.5, steps=10):
    init = _validate_state(init_states)
    doy = _validate_doy(doy_sincos)

    if isinstance(steps, bool) or not isinstance(steps, int) or not 1 <= steps <= 30:
        raise ValueError("steps must be an integer from 1 to 30.")

    if scenario in PRESETS:
        delta = build_preset(scenario, init[-1])
        metadata = dict(PRESETS[scenario])
    elif scenario == "custom":
        if channel is None:
            raise ValueError("Custom scenario requires a channel.")
        delta = build_custom(channel, center_lat, center_lon, radius, amplitude)
        metadata = {
            "label": "Custom Gaussian scenario",
            "description": "Localized Gaussian perturbation.",
            "provenance": "USER CONFIGURED MODEL SCENARIO",
            "region": {"center_lat": center_lat, "center_lon": center_lon, "radius": radius},
            "not_sst": False,
        }
    else:
        raise ValueError("scenario must be warm_ocean, monsoon_stall, zero, or custom.")

    base, ms_base = analysis._call_simulate(init.tolist(), doy, steps, None)
    shocked, ms_shock = analysis._call_simulate(init.tolist(), doy, steps, delta.tolist())

    return {
        "scenario": scenario,
        "metadata": metadata,
        "perturbation": delta.tolist(),
        "baseline_rollout": base.tolist(),
        "shocked_rollout": shocked.tolist(),
        "butterfly_metrics": butterfly_metrics(base, shocked, delta),
        "inference_ms": ms_base + ms_shock,
        "provenance": {
            "rollouts": "MODEL",
            "perturbation": "MODEL SCENARIO",
            "difference_and_butterfly_metrics": "DERIVED",
            "causality_claim": False,
        },
        "note": "Model-conditioned sensitivity scenario; not evidence of physical atmospheric causality.",
    }
