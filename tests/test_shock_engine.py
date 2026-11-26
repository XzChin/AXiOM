import numpy as np
import pytest

from dashboard_server.shock_engine import build_preset, build_custom, butterfly_metrics


@pytest.fixture
def last_state():
    x = np.zeros((6, 32, 36), dtype=np.float32)
    x[2] = 5.0
    x[3] = -2.0
    x[5] = 20.0
    return x


def test_warm_bay_preset(last_state):
    d = build_preset("warm_ocean", last_state)
    assert d.shape == (6, 32, 36)
    assert d[0, 5, 17] == 3.0
    assert d[5, 5, 17] == 3.0
    assert np.count_nonzero(d[1:5]) == 0


def test_monsoon_stall_preset(last_state):
    d = build_preset("monsoon_stall", last_state)
    assert d[2, 5, 5] == pytest.approx(-2.0)
    assert d[3, 5, 5] == pytest.approx(0.8)
    assert np.count_nonzero(d[[0, 1, 4, 5]]) == 0


def test_zero_preset(last_state):
    d = build_preset("zero", last_state)
    assert np.count_nonzero(d) == 0


def test_unknown_preset_rejected(last_state):
    with pytest.raises(ValueError):
        build_preset("cyclone", last_state)


def test_custom_shock_shape():
    d = build_custom(0, 15, 88, 2, 1.5)
    assert d.shape == (6, 32, 36)
    assert np.isfinite(d).all()
    assert d[0].max() <= 1.5


def test_butterfly_metrics_zero_difference():
    base = np.zeros((2, 6, 32, 36), dtype=np.float32)
    perturbation = np.zeros((6, 32, 36), dtype=np.float32)
    rows = butterfly_metrics(base, base.copy(), perturbation)
    assert len(rows) == 2
    assert rows[0]["energy"] == 0
    assert rows[0]["affectedCells"] == 0


def test_butterfly_metrics_detect_response():
    base = np.zeros((2, 6, 32, 36), dtype=np.float32)
    shocked = base.copy()
    shocked[0, 0, 10, 10] = 10
    perturbation = np.zeros((6, 32, 36), dtype=np.float32)
    perturbation[0, 10, 10] = 1
    rows = butterfly_metrics(base, shocked, perturbation)
    assert rows[0]["energy"] > 0
    assert rows[0]["affectedCells"] == 1
    assert rows[0]["maxZ"] > 0
import numpy as np
import pytest
from dashboard_server.shock_engine import run_shock


def test_shock_rejects_bad_initial_state():
    with pytest.raises(ValueError, match="shape"):
        run_shock([], [0.0, 1.0])


def test_shock_rejects_bad_doy():
    x = np.zeros((3, 6, 32, 36), dtype=np.float32)
    with pytest.raises(ValueError, match="doy_sincos"):
        run_shock(x, [float("nan"), 1.0])
