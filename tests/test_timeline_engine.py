import numpy as np
import pytest

from dashboard_server import timeline_engine as timeline


def fake_window(date):
    return {
        "init_states": np.zeros((3, 6, 32, 36), dtype=np.float32).tolist(),
        "doy_sincos": [0.5, 0.8660254],
        "truth": np.ones((10, 6, 32, 36), dtype=np.float32).tolist(),
    }


def fake_simulate(init, doy, steps, perturbation=None):
    return np.ones((steps, 6, 32, 36), dtype=np.float32) * 2, 12.5


def test_forecast_shape_and_dates(monkeypatch):
    monkeypatch.setattr(timeline.core, "window", fake_window)
    monkeypatch.setattr(timeline.analysis, "_call_simulate", fake_simulate)
    result = timeline.run_forecast("2020-06-01")
    assert result["grid_shape"] == [32, 36]
    assert len(result["forecast"]) == 10
    assert result["forecast_dates"][0] == "2020-06-02"
    assert result["forecast_dates"][-1] == "2020-06-11"
    assert len(result["channels"]) == 6


def test_forecast_custom_steps(monkeypatch):
    monkeypatch.setattr(timeline.core, "window", fake_window)
    monkeypatch.setattr(timeline.analysis, "_call_simulate", fake_simulate)
    result = timeline.run_forecast("2020-06-01", 4)
    assert len(result["forecast"]) == 4


def test_forecast_rejects_invalid_date():
    with pytest.raises(ValueError, match="YYYY-MM-DD"):
        timeline.run_forecast("not-a-date")


def test_forecast_rejects_invalid_steps():
    with pytest.raises(ValueError, match="steps"):
        timeline.run_forecast("2020-06-01", 11)


def test_cell_series(monkeypatch):
    monkeypatch.setattr(timeline.core, "window", fake_window)
    monkeypatch.setattr(timeline.analysis, "_call_simulate", fake_simulate)
    result = timeline.run_cell_series("2020-06-01", 10, 20, 3)
    assert len(result["series"]) == 3
    assert result["cell"]["latitude"] == 16.5
    assert result["cell"]["longitude"] == 85.5
    assert result["series"][0]["values"]["t2m"] == 2.0


def test_cell_series_rejects_out_of_range_index():
    with pytest.raises(ValueError, match="lat_index"):
        timeline.run_cell_series("2020-06-01", 32, 0)


def test_hindcast_metrics(monkeypatch):
    monkeypatch.setattr(timeline.core, "window", fake_window)
    monkeypatch.setattr(timeline.analysis, "_call_simulate", fake_simulate)
    result = timeline.run_hindcast("2020-06-01", 2)
    assert result["days_compared"] == 2
    assert result["overall_metrics"]["t2m"]["mae"] == 1.0
    assert result["overall_metrics"]["t2m"]["rmse"] == 1.0
    assert result["overall_metrics"]["t2m"]["bias"] == 1.0
    assert result["provenance"]["actual"] == "OBSERVATION"


def test_hindcast_requires_truth(monkeypatch):
    def no_truth(date):
        result = fake_window(date)
        result["truth"] = None
        return result

    monkeypatch.setattr(timeline.core, "window", no_truth)
    monkeypatch.setattr(timeline.analysis, "_call_simulate", fake_simulate)
    with pytest.raises(ValueError, match="No actual observations"):
        timeline.run_hindcast("2020-06-01")


def test_hindcast_rejects_bad_truth_shape(monkeypatch):
    def bad_truth(date):
        result = fake_window(date)
        result["truth"] = np.zeros((10, 2)).tolist()
        return result

    monkeypatch.setattr(timeline.core, "window", bad_truth)
    monkeypatch.setattr(timeline.analysis, "_call_simulate", fake_simulate)
    with pytest.raises(ValueError, match="invalid shape"):
        timeline.run_hindcast("2020-06-01")
