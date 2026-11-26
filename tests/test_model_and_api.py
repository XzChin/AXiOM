import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "src")]
from api.core import Engine, SimulateRequest, day_of_year  # noqa: E402
from monsoon.model import RADIUS  # noqa: E402


@pytest.fixture(scope="module")
def engine():
    return Engine()


@pytest.fixture
def state():
    r = np.random.default_rng(0)
    base = np.array([298, 4, 2, 1, 100800, 35], np.float32)[None, :, None, None]
    x = base + r.normal(0, 1, (3, 6, 32, 36)).astype(np.float32) * np.array([2, 1, 1, 1, 150, 4], np.float32)[None, :, None, None]
    x[:, 1] = np.abs(x[:, 1])
    return x.astype(np.float32)


def run(engine, x, pert=None, steps=10):
    req = SimulateRequest(init_states=x.tolist(), doy_sincos=[0.38, -0.925], steps=steps, perturbation=pert)
    return np.array(engine.simulate(req)["rollout"], np.float32)


def test_shape_finite_nonnegative_rain(engine, state):
    out = run(engine, state)
    assert out.shape == (10, 6, 32, 36) and np.isfinite(out).all() and out[:, 1].min() >= 0


def test_zero_shock_identical_to_null(engine, state):
    assert np.array_equal(run(engine, state), run(engine, state, np.zeros((6, 32, 36)).tolist()))


def test_day1_locality_is_exact(engine, state):
    d = np.zeros((6, 32, 36), np.float32)
    d[0, 15, 18] = 3.0
    diff = np.abs(run(engine, state, d.tolist(), 1) - run(engine, state, None, 1))[0].max(0)
    assert diff.max() > 0
    diff[15 - RADIUS:16 + RADIUS, 18 - RADIUS:19 + RADIUS] = 0
    assert diff.max() == 0


@pytest.mark.parametrize("bad", [np.zeros((2, 6, 32, 36)).tolist(), "x", [[1, 2], [3]]])
def test_bad_input_rejected(engine, bad):
    with pytest.raises(ValueError):
        engine.simulate(SimulateRequest(init_states=bad, doy_sincos=[0, 1], steps=1))


@pytest.mark.parametrize("doy", [1, 90, 182, 274, 365])
def test_doy_roundtrip(doy):
    a = 2 * np.pi * doy / 365
    assert day_of_year([np.sin(a), np.cos(a)]) == doy
