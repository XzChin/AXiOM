"""Atmosphere Explorer: reproducible surface-atmosphere diagnostics."""
from __future__ import annotations

import numpy as np

from dashboard_server import core

NC, NLAT, NLON = 6, 32, 36
LAT = np.arange(6.5, 38.0, 1.0)
LON = np.arange(65.5, 101.0, 1.0)

CHANNELS = ["t2m", "tp", "u10", "v10", "msl", "tcwv"]


def _state(value, name="state"):
    arr = np.asarray(value, dtype=np.float32)
    if arr.shape != (NC, NLAT, NLON):
        raise ValueError(f"{name} must have shape (6, 32, 36).")
    if not np.isfinite(arr).all():
        raise ValueError(f"{name} must contain only finite values.")
    return arr


def _rollout(value, name):
    arr = np.asarray(value, dtype=np.float32)
    if arr.ndim != 4 or arr.shape[1:] != (NC, NLAT, NLON):
        raise ValueError(f"{name} must have shape (days, 6, 32, 36).")
    if not 1 <= len(arr) <= 30:
        raise ValueError(f"{name} must contain 1 to 30 days.")
    if not np.isfinite(arr).all():
        raise ValueError(f"{name} must contain only finite values.")
    return arr


def wind_speed(state):
    s = _state(state)
    return np.hypot(s[2], s[3]).astype(np.float32)


def pressure_anomaly(state):
    s = _state(state)
    return ((s[4] - float(np.mean(s[4]))) * 0.01).astype(np.float32)


def moisture_transport(state):
    s = _state(state)
    return (s[5] * np.hypot(s[2], s[3])).astype(np.float32)


def monsoon_pulse(rollout):
    arr = _rollout(rollout, "rollout")
    lat_mask = (LAT >= 10) & (LAT <= 25)
    lon_mask = (LON >= 70) & (LON <= 90)
    mask = lat_mask[:, None] & lon_mask[None, :]
    return arr[:, 2][:, mask].mean(axis=1).astype(float).tolist()


def _layers(state):
    return {
        "wind_speed": wind_speed(state).tolist(),
        "pressure_anomaly": pressure_anomaly(state).tolist(),
        "moisture_transport_proxy": moisture_transport(state).tolist(),
    }


def run_explorer(state, rollout=None, shocked_state=None, shocked_rollout=None):
    baseline = _state(state, "state")

    layers = {
        "baseline": _layers(baseline),
        "shocked": None,
    }

    if shocked_state is not None:
        layers["shocked"] = _layers(_state(shocked_state, "shocked_state"))

    if rollout is not None:
        base_rollout = _rollout(rollout, "rollout")
        pulse_baseline = monsoon_pulse(base_rollout)
    else:
        base_rollout = None
        pulse_baseline = []

    if shocked_rollout is not None:
        shock_rollout = _rollout(shocked_rollout, "shocked_rollout")
        if base_rollout is not None and len(shock_rollout) != len(base_rollout):
            raise ValueError("Baseline and shocked rollouts must have the same number of days.")
        pulse_shocked = monsoon_pulse(shock_rollout)
    else:
        pulse_shocked = []

    elevation = np.asarray(core.orography(), dtype=np.float32)
    if elevation.shape != (NLAT, NLON) or not np.isfinite(elevation).all():
        raise ValueError("Static orography grid is invalid.")

    return {
        "grid_shape": [NLAT, NLON],
        "channels": CHANNELS,
        "layers": layers,
        "orography_m": elevation.tolist(),
        "monsoon_pulse": {
            "baseline": pulse_baseline,
            "shocked": pulse_shocked,
            "unit": "m/s",
            "region": {
                "latitude": [10, 25],
                "longitude": [70, 90],
                "variable": "u10",
            },
        },
        "provenance": {
            "wind_speed": "DERIVED FROM MODEL",
            "pressure_anomaly": "DERIVED FROM MODEL",
            "moisture_transport_proxy": "DERIVED PROXY FROM MODEL",
            "orography": "STATIC MODEL FIELD",
            "monsoon_pulse": "DERIVED SURFACE-WIND DIAGNOSTIC",
        },
        "scientific_notes": [
            "Wind speed uses 10 m u and v components.",
            "Pressure anomaly is relative to the spatial mean of this grid, not a climatological anomaly.",
            "TCWV multiplied by 10 m wind speed is a moisture-transport proxy, not vertically integrated moisture flux.",
            "Orography is a static field and is not forecast.",
            "Monsoon Pulse is a surface u10 diagnostic, not the official IMD monsoon onset index.",
        ],
    }
