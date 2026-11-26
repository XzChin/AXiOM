"""Framework-free request handling for the graded API: validation, shock application, inference."""
import base64
import math
import sys
import time
from pathlib import Path
from typing import Any, Optional

import numpy as np
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from monsoon.model import Net  # noqa: E402

MODEL_NAME = "monsoonnet-lite-numpy-1.0"
MAX_STEPS = 14


class SimulateRequest(BaseModel):
    init_states: Any
    doy_sincos: list[float] = Field(min_length=2, max_length=2)
    steps: int = Field(ge=1, le=MAX_STEPS)
    perturbation: Optional[Any] = None


def to_array(x, shape, name):
    """Nested lists (the contract) or {'b64','shape'} (tolerated by the contract)."""
    try:
        if isinstance(x, dict):
            if tuple(x["shape"]) != shape:
                raise ValueError("wrong shape")
            a = np.frombuffer(base64.b64decode(x["b64"], validate=True), dtype="<f4").reshape(shape).astype(np.float32)
        else:
            a = np.asarray(x, dtype=np.float32)
    except (ValueError, TypeError, KeyError) as e:
        raise ValueError(f"{name}: malformed array ({e})") from None
    if a.shape != shape:
        raise ValueError(f"{name}: shape {a.shape}, expected {shape}")
    if not np.isfinite(a).all():
        raise ValueError(f"{name}: non-finite values")
    return a


def day_of_year(sc):
    s, c = sc
    if not (math.isfinite(s) and math.isfinite(c)) or abs(math.hypot(s, c) - 1) > 0.05:
        raise ValueError("doy_sincos must be a finite [sin, cos] pair on the unit circle")
    d = round((math.atan2(s, c) % (2 * math.pi)) * 365 / (2 * math.pi))
    return d or 365


class Engine:
    def __init__(self, weights=ROOT / "weights" / "model.npz"):
        self.net = Net.load(weights)
        warm = np.zeros((3, 6, 32, 36), np.float32)
        warm[:, 0], warm[:, 4], warm[:, 5] = 298.0, 100800.0, 35.0
        self.net.rollout(warm, 160, 10)

    def simulate(self, req: SimulateRequest) -> dict:
        t0 = time.perf_counter()
        init = to_array(req.init_states, (3, 6, 32, 36), "init_states").copy()
        delta = np.zeros((6, 32, 36), np.float32)      # null and zero shocks share one code path
        if req.perturbation is not None:
            delta = to_array(req.perturbation, (6, 32, 36), "perturbation")
        init[-1] += delta
        out = self.net.rollout(init, day_of_year(req.doy_sincos), req.steps)
        if not np.isfinite(out).all():
            raise ValueError("input produced non-finite output; check physical units")
        return {"rollout": out.tolist(), "inference_ms": (time.perf_counter() - t0) * 1000.0}
