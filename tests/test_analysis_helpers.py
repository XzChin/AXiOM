import numpy as np
import pytest

from dashboard_server.analysis import _gaussian_shock


def test_gaussian_shock_has_expected_shape_and_finite_values():
    shock = _gaussian_shock(0, 15.0, 88.0, 2.0, 1.5)
    assert shock.shape == (6, 32, 36)
    assert np.isfinite(shock).all()
    assert shock[0].max() <= 1.5
    assert np.count_nonzero(shock[1:]) == 0


@pytest.mark.parametrize("channel", [-1, 6, 1.5, True])
def test_gaussian_shock_rejects_invalid_channel(channel):
    with pytest.raises(ValueError):
        _gaussian_shock(channel, 15.0, 88.0, 2.0, 1.0)


@pytest.mark.parametrize("radius", [0, -1, float("nan"), float("inf")])
def test_gaussian_shock_rejects_invalid_radius(radius):
    with pytest.raises(ValueError):
        _gaussian_shock(0, 15.0, 88.0, radius, 1.0)


@pytest.mark.parametrize(
    "params",
    [
        (float("nan"), 88.0, 2.0, 1.0),
        (15.0, float("inf"), 2.0, 1.0),
        (15.0, 88.0, 2.0, float("nan")),
    ],
)
def test_gaussian_shock_rejects_non_finite_parameters(params):
    with pytest.raises(ValueError):
        _gaussian_shock(0, *params)
