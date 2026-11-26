import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "src"), str(ROOT / "training"), str(ROOT / "evaluation")]

from monsoon.model import N, NC, Net  # noqa: E402
from train import Adam, backward, huber, init_params, paired_shock_penalty, rollout_train_step  # noqa: E402
from local_grader import run_synthetic_audit, shock_certificate  # noqa: E402
from monsoon_r1 import scoring as S  # noqa: E402


def test_backward_matches_finite_difference():
    rng = np.random.default_rng(7)
    art = init_params(rng, 16)
    art["static_features"] = np.zeros((N, 6), np.float32)
    net = Net(art)
    x = rng.normal(0, 0.5, (8, net.a["w0"].shape[0])).astype(np.float32)
    out, cache = net.forward(x, keep=True)
    target = rng.normal(0, 0.2, out.shape).astype(np.float32)
    _, g = huber(out - target)
    grads = {k: np.zeros_like(v) for k, v in art.items()}
    gx = backward(net, cache, out, (g / g.size).astype(np.float32), grads, True)

    eps = 1e-3
    idx = (0, 5)
    xp, xm = x.copy(), x.copy()
    xp[idx] += eps
    xm[idx] -= eps
    lp = huber(net.forward(xp) - target)[0].mean()
    lm = huber(net.forward(xm) - target)[0].mean()
    num_gx = (lp - lm) / (2 * eps)
    assert np.isclose(gx[idx], num_gx, atol=1e-3, rtol=1e-2)


def test_stage_c_and_d_rollout_steps_run_cleanly():
    rng = np.random.default_rng(1)
    art = init_params(rng, 16)
    art.update(
        static_features=np.zeros((N, 6), np.float32),
        tend_std=np.ones(NC, np.float32),
        tend_mean=np.zeros(NC, np.float32),
        anom_std=np.ones(NC, np.float32),
    )
    net = Net(art)
    params = {k: art[k] for k in art if k == "skip" or (k[0] in "wb" and k[1:].isdigit())}
    opt = Adam(params)
    z = rng.normal(0, 0.5, (20, N, NC)).astype(np.float32)
    doy = np.arange(1, 21, dtype=np.int32)
    l1 = rollout_train_step(net, opt, z, doy, np.array([2, 5]), 3, 1e-4, grad_weight=0.1, heavy_rain_weight=0.3)
    l2 = rollout_train_step(net, opt, z, doy, np.array([2, 5]), 3, 1e-4, shock_weight=0.2, rng=rng)
    assert np.isfinite(l1) and np.isfinite(l2)


def test_local_grader_certificate_on_shipped_weights():
    net = Net.load(ROOT / "weights" / "model.npz")
    audit = run_synthetic_audit(net)
    assert audit["archetypes_valid"] is True
    for key in ("warm_ocean_cert", "monsoon_stall_cert"):
        checks = {c["id"]: c["passed"] for c in audit[key]["checks"]}
        assert checks["zero_identity"] is True
        assert checks["day1_locality"] is True
        assert checks["finite_physical"] is True
        assert checks["determinism"] is True


def test_stage_d_backpropagates_shocked_rollout(monkeypatch):
    import train as train_module

    rng = np.random.default_rng(17)
    art = init_params(rng, 16)
    art.update(
        static_features=np.zeros((N, 6), np.float32),
        tend_std=np.ones(NC, np.float32),
        tend_mean=np.zeros(NC, np.float32),
        anom_std=np.ones(NC, np.float32),
    )
    net = Net(art)
    params = {k: art[k] for k in art if k == "skip" or (k[0] in "wb" and k[1:].isdigit())}
    opt = Adam(params)
    z = rng.normal(0, 0.5, (20, N, NC)).astype(np.float32)
    doy = np.arange(1, 21, dtype=np.int32)

    original_backward = train_module.backward
    calls = []

    def tracked_backward(*args, **kwargs):
        calls.append(1)
        return original_backward(*args, **kwargs)

    monkeypatch.setattr(train_module, "backward", tracked_backward)
    loss = rollout_train_step(
        net, opt, z, doy, np.array([2, 5]), 3, 1e-4,
        shock_weight=0.2, rng=np.random.default_rng(23)
    )

    assert np.isfinite(loss)
    assert len(calls) == 6, "Expected baseline and shocked BPTT passes"


def test_paired_shock_penalty_gradient_matches_finite_difference():
    delta = np.array([-6.2, -5.1, -4.4, -3.0, 0.5, 3.2, 4.6, 6.4], dtype=np.float32)
    weight, horizon = 0.37, 3
    loss, analytic = paired_shock_penalty(delta, weight, horizon)

    eps = 1e-3
    numeric = np.zeros_like(delta)
    for i in range(delta.size):
        plus, minus = delta.copy(), delta.copy()
        plus[i] += eps
        minus[i] -= eps
        lp = paired_shock_penalty(plus, weight, horizon)[0]
        lm = paired_shock_penalty(minus, weight, horizon)[0]
        numeric[i] = (lp - lm) / (2 * eps)

    assert np.isfinite(loss)
    assert np.allclose(analytic, numeric, atol=2e-5, rtol=2e-2)
    assert np.all(analytic[np.abs(delta) < 4.0] == 0)
