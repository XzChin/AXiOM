"""Timeline Prime: autoregressive forecasts and hindcast diagnostics."""
from __future__ import annotations

import datetime as dt
import numpy as np

from dashboard_server import analysis, core

CHANNELS = [
    {"id": "t2m", "name": "2m Temperature", "unit": "K"},
    {"id": "tp", "name": "Total Precipitation", "unit": "mm/day"},
    {"id": "u10", "name": "10m U Wind", "unit": "m/s"},
    {"id": "v10", "name": "10m V Wind", "unit": "m/s"},
    {"id": "msl", "name": "Mean Sea-Level Pressure", "unit": "Pa"},
    {"id": "tcwv", "name": "Total Column Water Vapour", "unit": "kg/m²"},
]

NLAT, NLON = 32, 36


def _date(value):
    try:
        return dt.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValueError("date must use YYYY-MM-DD format.") from None


def _indices(lat_index, lon_index):
    if isinstance(lat_index, bool) or not isinstance(lat_index, int) or not 0 <= lat_index < NLAT:
        raise ValueError("lat_index must be an integer from 0 to 31.")
    if isinstance(lon_index, bool) or not isinstance(lon_index, int) or not 0 <= lon_index < NLON:
        raise ValueError("lon_index must be an integer from 0 to 35.")


def _get_window(date):
    window = core.window(date)
    if not isinstance(window, dict):
        raise ValueError("No forecast window is available for this date.")
    if "init_states" not in window or "doy_sincos" not in window:
        raise ValueError("The selected window is missing model input data.")
    return window


def run_forecast(date, steps=10):
    target_date = _date(date)
    if isinstance(steps, bool) or not isinstance(steps, int) or not 1 <= steps <= 10:
        raise ValueError("steps must be an integer from 1 to 10.")

    window = _get_window(target_date)
    rollout, inference_ms = analysis._call_simulate(
        window["init_states"], window["doy_sincos"], steps, None
    )

    if rollout.shape != (steps, 6, NLAT, NLON) or not np.isfinite(rollout).all():
        raise ValueError("Model returned an invalid Timeline Prime forecast.")

    dates = [(target_date + dt.timedelta(days=i + 1)).isoformat() for i in range(steps)]

    return {
        "start_date": target_date.isoformat(),
        "forecast_dates": dates,
        "steps": steps,
        "channels": CHANNELS,
        "grid_shape": [NLAT, NLON],
        "forecast": rollout.tolist(),
        "inference_ms": inference_ms,
        "provenance": "MODEL",
        "note": "Autoregressive model rollout. Forecast values are model outputs, not observations.",
    }


def run_cell_series(date, lat_index, lon_index, steps=10):
    _indices(lat_index, lon_index)
    result = run_forecast(date, steps)
    values = np.asarray(result["forecast"], dtype=np.float32)

    series = []
    for day in range(values.shape[0]):
        row = {
            "date": result["forecast_dates"][day],
            "day": day + 1,
            "values": {
                CHANNELS[c]["id"]: float(values[day, c, lat_index, lon_index])
                for c in range(6)
            },
        }
        series.append(row)

    return {
        "start_date": result["start_date"],
        "cell": {
            "lat_index": lat_index,
            "lon_index": lon_index,
            "latitude": 6.5 + lat_index,
            "longitude": 65.5 + lon_index,
        },
        "series": series,
        "provenance": "MODEL",
    }


def run_hindcast(date, steps=10):
    result = run_forecast(date, steps)
    window = _get_window(date)
    truth = window.get("truth")

    if truth is None:
        raise ValueError("No actual observations are available for this hindcast window.")

    actual = np.asarray(truth, dtype=np.float32)
    predicted = np.asarray(result["forecast"], dtype=np.float32)

    if actual.ndim != 4 or actual.shape[1:] != (6, NLAT, NLON):
        raise ValueError("Actual observations have an invalid shape.")
    if not np.isfinite(actual).all():
        raise ValueError("Actual observations contain non-finite values.")

    count = min(len(actual), len(predicted))
    if count == 0:
        raise ValueError("No overlapping forecast and observation days are available.")

    actual = actual[:count]
    predicted = predicted[:count]
    error = predicted - actual

    daily = []
    for day in range(count):
        per_channel = {}
        for channel, meta in enumerate(CHANNELS):
            e = error[day, channel]
            per_channel[meta["id"]] = {
                "mae": float(np.mean(np.abs(e))),
                "rmse": float(np.sqrt(np.mean(e ** 2))),
                "bias": float(np.mean(e)),
            }
        daily.append({
            "day": day + 1,
            "date": result["forecast_dates"][day],
            "channels": per_channel,
        })

    overall = {}
    for channel, meta in enumerate(CHANNELS):
        e = error[:, channel]
        overall[meta["id"]] = {
            "mae": float(np.mean(np.abs(e))),
            "rmse": float(np.sqrt(np.mean(e ** 2))),
            "bias": float(np.mean(e)),
        }

    return {
        "start_date": result["start_date"],
        "days_compared": count,
        "channels": CHANNELS,
        "daily_metrics": daily,
        "overall_metrics": overall,
        "actual": actual.tolist(),
        "digital_twin": predicted.tolist(),
        "provenance": {
            "actual": "OBSERVATION",
            "digital_twin": "MODEL",
            "metrics": "DERIVED",
        },
        "note": "Hindcast comparison against available dataset observations; not a live forecast verification.",
    }
