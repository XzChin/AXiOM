import math

import pytest
from pydantic import ValidationError

from dashboard_server.app import (
    CertificateReq,
    EnsembleReq,
    MemoryReq,
    ReverseReq,
    SensitivityReq,
)


BASE = {
    "init_states": [],
    "doy_sincos": [0.0, 1.0],
}


def test_valid_request_defaults():
    assert CertificateReq(**BASE, perturbation=[]).steps == 10
    assert EnsembleReq(**BASE).members == 5
    assert SensitivityReq(**BASE).target_channel == 1
    assert ReverseReq(**BASE).direction == "increase"
    assert MemoryReq(**BASE, perturbation=[]).total_days == 10


@pytest.mark.parametrize("steps", [0, -1, 31])
def test_certificate_rejects_invalid_steps(steps):
    with pytest.raises(ValidationError):
        CertificateReq(**BASE, perturbation=[], steps=steps)


@pytest.mark.parametrize("steps", [0, -1, 31])
def test_ensemble_rejects_invalid_steps(steps):
    with pytest.raises(ValidationError):
        EnsembleReq(**BASE, steps=steps)


@pytest.mark.parametrize("members", [0, 1, 2, 10])
def test_ensemble_rejects_invalid_member_count(members):
    with pytest.raises(ValidationError):
        EnsembleReq(**BASE, members=members)


@pytest.mark.parametrize("noise", [-0.1, 1.1, math.nan, math.inf])
def test_ensemble_rejects_invalid_noise_scale(noise):
    with pytest.raises(ValidationError):
        EnsembleReq(**BASE, noise_scale=noise)


@pytest.mark.parametrize("channel", [-1, 6])
def test_sensitivity_rejects_invalid_channel(channel):
    with pytest.raises(ValidationError):
        SensitivityReq(**BASE, target_channel=channel)


@pytest.mark.parametrize("day", [0, 31])
def test_sensitivity_rejects_invalid_target_day(day):
    with pytest.raises(ValidationError):
        SensitivityReq(**BASE, target_day=day)


def test_sensitivity_rejects_unknown_region():
    with pytest.raises(ValidationError):
        SensitivityReq(**BASE, region_id="not_a_region")


def test_reverse_rejects_unknown_region():
    with pytest.raises(ValidationError):
        ReverseReq(**BASE, target_region="not_a_region")


def test_reverse_rejects_invalid_direction():
    with pytest.raises(ValidationError):
        ReverseReq(**BASE, direction="sideways")


@pytest.mark.parametrize("days", [0, 1, 31])
def test_memory_rejects_invalid_total_days(days):
    with pytest.raises(ValidationError):
        MemoryReq(**BASE, perturbation=[], total_days=days)


def test_memory_rejects_recovery_day_equal_to_total_days():
    with pytest.raises(ValidationError):
        MemoryReq(
            **BASE,
            perturbation=[],
            recovery_day=5,
            total_days=5,
        )


def test_memory_rejects_recovery_day_after_total_days():
    with pytest.raises(ValidationError):
        MemoryReq(
            **BASE,
            perturbation=[],
            recovery_day=6,
            total_days=5,
        )


@pytest.mark.parametrize("scale", [-0.1, 3.1, math.nan, math.inf])
def test_memory_rejects_invalid_compensation_scale(scale):
    with pytest.raises(ValidationError):
        MemoryReq(**BASE, perturbation=[], comp_scale=scale)
