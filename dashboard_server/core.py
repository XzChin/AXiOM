"""Dashboard data access (framework-free): demo windows from MONSOON_DATA and a proxy to the graded server."""
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "training"))
DATA_START = json.loads((ROOT / "weights" / "model.json").read_text())["data_start"]
MODEL_URL = os.environ.get("MODEL_URL", "http://127.0.0.1:8000").rstrip("/")


def forward(route: str, body: bytes):
    """Pass a request body through unchanged. Returns (status, response bytes)."""
    req = urllib.request.Request(MODEL_URL + "/" + route, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except OSError:
        return 502, b'{"detail":"model server unreachable"}'


@lru_cache(maxsize=1)
def dataset():
    path = os.environ.get("MONSOON_DATA")
    if not path:
        return None
    p = Path(path)
    if p.is_dir():
        p = p / "india_climate_train.nc"
    from hdf5_reader import load
    data, static, *_ = load(p)
    return data, static


def land_mask():
    with np.load(ROOT / "weights" / "model.npz") as z:
        return z["static_features"][:, 0].reshape(32, 36).tolist()


def orography():
    with np.load(ROOT / "weights" / "model.npz") as z:
        return (z["static_features"][:, 1] * 3000.0).reshape(32, 36).tolist()


def _read_json(rel: str):
    p = ROOT / rel
    return json.loads(p.read_text()) if p.is_file() else None


def meta():
    ds = dataset()
    return {
        "has_data": ds is not None,
        "days": 0 if ds is None else len(ds[0]),
        "first_date": DATA_START,
        "land_mask": land_mask(),
        "orography_m": orography(),
        "stats": _read_json("weights/stats.json"),
        "model_info": _read_json("weights/model.json"),
        "eval_val": _read_json("evaluation/results_validation_2018_2019.json"),
        "eval_test": _read_json("evaluation/results_test_2020_2021.json"),
    }


def sample_windows():
    """Five synthetic India-like input windows for live testing when MONSOON_DATA is not set."""
    rng = np.random.default_rng(42)
    specs = [
        ("monsoon_onset", "Monsoon Onset (June archetype)", 155, [300.0, 12.0, 6.0, 4.0, 100400.0, 52.0]),
        ("heavy_rain", "Active Monsoon Heavy Rain (July archetype)", 200, [297.0, 22.0, 7.0, 3.0, 100200.0, 58.0]),
        ("heatwave", "Pre-Monsoon Heatwave (May archetype)", 135, [311.0, 0.2, 2.0, 0.5, 100600.0, 22.0]),
        ("cyclone", "Post-Monsoon Bay Cyclone (Oct archetype)", 295, [299.0, 28.0, -8.0, 7.0, 99400.0, 60.0]),
        ("winter_disturbance", "Western Disturbance (Jan archetype)", 20, [286.0, 3.0, 4.0, -2.0, 101600.0, 18.0]),
    ]
    out = []
    for wid, label, doy, mean in specs:
        m = np.array(mean, np.float32)[None, :, None, None]
        x = m + rng.normal(0, 1, (3, 6, 32, 36)).astype(np.float32) * np.array([2.0, 3.0, 1.5, 1.5, 180.0, 5.0], np.float32)[None, :, None, None]
        x[:, 1] = np.maximum(x[:, 1], 0.0)
        x[:, 5] = np.maximum(x[:, 5], 1.0)
        a = 2 * np.pi * doy / 365.0
        out.append({
            "id": wid,
            "label": label,
            "synthetic_input": True,
            "init_states": x.tolist(),
            "doy_sincos": [float(np.sin(a)), float(np.cos(a))],
        })
    return out


def window(date: str):
    """Three input days ending on `date`, plus up to 10 following days as truth."""
    ds = dataset()
    if ds is None:
        raise ValueError("MONSOON_DATA is not set")
    d = dt.date.fromisoformat(date)
    i = (d - dt.date.fromisoformat(DATA_START)).days
    if i < 2 or i >= len(ds[0]):
        raise ValueError("date outside the dataset")
    doy = d.timetuple().tm_yday
    a = 2 * np.pi * doy / 365.0
    return {"date": date, "init_states": ds[0][i - 2:i + 1].tolist(), "doy_sincos": [float(np.sin(a)), float(np.cos(a))],
            "truth": ds[0][i + 1:i + 11].tolist()}
