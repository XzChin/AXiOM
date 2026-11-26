import numpy as np
import pytest

from dashboard_server import atmosphere_engine as atm


@pytest.fixture
def state():
    s = np.zeros((6, 32, 36), dtype=np.float32)
    s[2] = 3.0
    s[3] = 4.0
    s[4] = 100000.0
    s[5] = 20.0
    return s


def test_wind_speed(state):
    result = atm.wind_speed(state)
    assert result.shape == (32, 36)
    assert np.allclose(result, 5.0)


def test_pressure_anomaly_spatial_mean(state):
    state[4, 0, 0] += 100.0
    result = atm.pressure_anomaly(state)
    assert result.shape == (32, 36)
    assert abs(float(result.mean())) < 1e-5
    assert result[0, 0] > 0


def test_moisture_transport_proxy(state):
    result = atm.moisture_transport(state)
    assert result.shape == (32, 36)
    assert np.allclose(result, 100.0)


def test_monsoon_pulse_matches_domain_mean():
    rollout = np.zeros((2, 6, 32, 36), dtype=np.float32)
    rollout[:, 2] = 7.5
    result = atm.monsoon_pulse(rollout)
    assert result == pytest.approx([7.5, 7.5])


def test_explorer_returns_expected_layers(state, monkeypatch):
    monkeypatch.setattr(
        atm.core, "orography",
        lambda: np.full((32, 36), 125.0).tolist()
    )
    result = atm.run_explorer(state)
    assert result["grid_shape"] == [32, 36]
    assert result["layers"]["baseline"]["wind_speed"][0][0] == pytest.approx(5.0)
    assert result["orography_m"][0][0] == pytest.approx(125.0)
    assert result["layers"]["shocked"] is None


def test_explorer_returns_shocked_layers_and_pulse(state, monkeypatch):
    monkeypatch.setattr(
        atm.core, "orography",
        lambda: np.zeros((32, 36), dtype=np.float32).tolist()
    )
    shock = state.copy()
    shock[2] = 9.0
    rollout = np.repeat(state[None], 3, axis=0)
    shocked_rollout = np.repeat(shock[None], 3, axis=0)

    result = atm.run_explorer(
        state, rollout, shock, shocked_rollout
    )
    assert result["layers"]["shocked"]["wind_speed"][0][0] == pytest.approx(
        np.hypot(9.0, 4.0)
    )
    assert result["monsoon_pulse"]["baseline"] == pytest.approx([3.0] * 3)
    assert result["monsoon_pulse"]["shocked"] == pytest.approx([9.0] * 3)


@pytest.mark.parametrize("bad", [
    np.zeros((2, 32, 36)),
    np.full((6, 32, 36), np.nan),
])
def test_invalid_state_rejected(bad):
    with pytest.raises(ValueError):
        atm.run_explorer(bad)


def test_invalid_rollout_rejected(state, monkeypatch):
    monkeypatch.setattr(
        atm.core, "orography",
        lambda: np.zeros((32, 36)).tolist()
    )
    with pytest.raises(ValueError, match="rollout"):
        atm.run_explorer(state, np.zeros((2, 6, 32, 35)))


def test_mismatched_rollout_lengths_rejected(state, monkeypatch):
    monkeypatch.setattr(
        atm.core, "orography",
        lambda: np.zeros((32, 36)).tolist()
    )
    base = np.zeros((2, 6, 32, 36))
    shock = np.zeros((3, 6, 32, 36))
    with pytest.raises(ValueError, match="same number of days"):
        atm.run_explorer(state, base, shocked_rollout=shock)
