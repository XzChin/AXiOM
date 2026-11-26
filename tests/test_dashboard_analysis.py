import numpy as np

from dashboard_server import analysis


def test_certificate_sums_all_five_model_inference_times(monkeypatch):
    monkeypatch.setattr(
        analysis,
        "_stats_std",
        lambda: np.ones(6, dtype=np.float32),
    )

    timings = iter((11.0, 13.0, 17.0, 19.0, 23.0))
    calls = []

    def fake_simulate(init_states, doy_sincos, steps, perturbation=None):
        calls.append(perturbation)
        rollout = np.zeros((steps, 6, 32, 36), dtype=np.float32)
        return rollout, next(timings)

    monkeypatch.setattr(analysis, "_call_simulate", fake_simulate)

    perturbation = np.zeros((6, 32, 36), dtype=np.float32)
    perturbation[0, 15, 18] = 1.0

    result = analysis.run_certificate(
        np.zeros((3, 6, 32, 36), dtype=np.float32).tolist(),
        [0.5, 0.8660254],
        perturbation.tolist(),
        steps=8,
    )

    assert len(calls) == 5
    assert result["inference_ms"] == 83.0


def test_reverse_search_evaluates_all_three_source_channels(monkeypatch):
    monkeypatch.setattr(
        analysis,
        "_stats_std",
        lambda: np.array([13.46, 7.55, 2.90, 2.43, 619.0, 20.49], dtype=np.float32),
    )
    monkeypatch.setattr(
        analysis.core,
        "land_mask",
        lambda: np.ones((32, 36), dtype=np.float32),
    )

    evaluated_channels = []

    def fake_simulate(init_states, doy_sincos, steps, perturbation=None):
        if perturbation is not None:
            delta = np.asarray(perturbation)
            evaluated_channels.append(
                int(np.flatnonzero(np.any(delta != 0, axis=(1, 2)))[0])
            )
        rollout = np.zeros((steps, 6, 32, 36), dtype=np.float32)
        return rollout, 1.0

    monkeypatch.setattr(analysis, "_call_simulate", fake_simulate)

    result = analysis.run_reverse_simulator(
        np.zeros((3, 6, 32, 36), dtype=np.float32).tolist(),
        [0.5, 0.8660254],
        target_region="all_india",
        target_day=1,
        target_channel=1,
    )

    assert result["evaluations"] == 12
    assert len(evaluated_channels) == 12
    assert set(evaluated_channels) == {0, 2, 5}
    assert {ch: evaluated_channels.count(ch) for ch in (0, 2, 5)} == {
        0: 4,
        2: 4,
        5: 4,
    }
