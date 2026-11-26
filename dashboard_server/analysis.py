"""Optional analysis & orchestration routes for the dashboard (separate from graded /simulate).

Every model rollout is obtained by calling the live graded server (/simulate) via `core.forward`.
"""
from __future__ import annotations

import datetime as dt
import json
import math
from typing import Any, Optional

import numpy as np

from dashboard_server import core

NC, NLAT, NLON = 6, 32, 36
LAT = np.arange(6.5, 38.0, 1.0)
LON = np.arange(65.5, 101.0, 1.0)

REGIONS = {
    "all_india": {"name": "All India Domain", "lat": [6.5, 37.5], "lon": [65.5, 100.5]},
    "western_ghats": {"name": "Western Ghats", "lat": [8.5, 20.5], "lon": [72.5, 77.5]},
    "central_monsoon": {"name": "Central Monsoon Core", "lat": [18.5, 26.5], "lon": [74.5, 86.5]},
    "indo_gangetic": {"name": "Indo-Gangetic Plain", "lat": [24.5, 31.5], "lon": [74.5, 88.5]},
    "northeast": {"name": "Northeast & Himalayas", "lat": [22.5, 29.5], "lon": [88.5, 97.5]},
    "bay_of_bengal": {"name": "Bay of Bengal", "lat": [8.0, 20.0], "lon": [82.0, 94.0]},
    "arabian_sea": {"name": "Arabian Sea", "lat": [8.0, 20.0], "lon": [65.0, 75.0]},
}


def _call_simulate(init_states: Any, doy_sincos: list[float], steps: int, perturbation: Any = None) -> tuple[np.ndarray, float]:
    payload = json.dumps({
        "init_states": init_states,
        "doy_sincos": doy_sincos,
        "steps": int(steps),
        "perturbation": perturbation,
    }).encode("utf-8")
    status, body = core.forward("simulate", payload)
    if status != 200:
        raise ValueError(f"Model server returned HTTP {status}: {body.decode('utf-8', 'ignore')[:200]}")
    res = json.loads(body)
    return np.asarray(res["rollout"], dtype=np.float32), float(res["inference_ms"])


def _region_mask(region_id: str, land_mask: Optional[np.ndarray] = None, land_only: bool = False) -> np.ndarray:
    r = REGIONS.get(region_id, REGIONS["all_india"])
    m = ((LAT >= r["lat"][0]) & (LAT <= r["lat"][1]))[:, None] & ((LON >= r["lon"][0]) & (LON <= r["lon"][1]))[None, :]
    if land_only and land_mask is not None:
        m = m & (land_mask > 0.5)
    return m if m.any() else np.ones((NLAT, NLON), dtype=bool)


def _gaussian_shock(ch: int, clat: float, clon: float, radius: float, amp: float) -> np.ndarray:
    d = np.zeros((NC, NLAT, NLON), dtype=np.float32)
    dist = np.hypot(LAT[:, None] - clat, LON[None, :] - clon)
    mask = dist <= 2.0 * radius
    d[ch][mask] = amp * np.exp(-(dist[mask] ** 2) / (2.0 * radius ** 2))
    return d


def _advance_doy_sincos(doy_sincos: list[float], days: int) -> list[float]:
    s, c = doy_sincos
    ang0 = math.atan2(s, c)
    ang = ang0 + 2.0 * math.pi * days / 365.0
    return [float(math.sin(ang)), float(math.cos(ang))]


def _stats_std() -> np.ndarray:
    return np.asarray(json.loads((core.ROOT / "weights" / "stats.json").read_text())["std"], dtype=np.float32)


def run_certificate(init_states: Any, doy_sincos: list[float], perturbation: Any, steps: int = 10) -> dict:
    """Run all 8 Shock Behaviour Certificate checks via live /simulate calls."""
    std = _stats_std()
    pert = np.asarray(perturbation, dtype=np.float32)
    zeros = np.zeros((NC, NLAT, NLON), dtype=np.float32)

    base, ms_base = _call_simulate(init_states, doy_sincos, steps, None)
    zero_out, _ = _call_simulate(init_states, doy_sincos, steps, zeros.tolist())
    run1, ms_shock = _call_simulate(init_states, doy_sincos, steps, pert.tolist())
    run2, _ = _call_simulate(init_states, doy_sincos, steps, pert.tolist())
    half_run, _ = _call_simulate(init_states, doy_sincos, steps, (0.5 * pert).tolist())

    zero_diff = float(np.max(np.abs(zero_out - base)))
    repeat_diff = float(np.max(np.abs(run1 - run2)))
    diff = run1 - base
    half_diff = half_run - base

    z = np.abs(diff / std[None, :, None, None])
    energy = ((diff / std[None, :, None, None]) ** 2).sum(axis=1)

    src = np.any(pert != 0, axis=0)
    near = src.copy()
    for _ in range(2):
        o = near.copy()
        o[1:] |= near[:-1]; o[:-1] |= near[1:]
        o[:, 1:] |= near[:, :-1]; o[:, :-1] |= near[:, 1:]
        o[1:, 1:] |= near[:-1, :-1]; o[1:, :-1] |= near[:-1, 1:]
        o[:-1, 1:] |= near[1:, :-1]; o[:-1, :-1] |= near[1:, 1:]
        near = o

    tot1 = float(energy[0].sum())
    near_frac = float(energy[0][near].sum() / tot1) if tot1 > 0 else 0.0
    outside_day1 = float(np.max(np.abs(diff[0][:, ~near]))) if (~near).any() else 0.0

    ii, jj = np.indices((NLAT, NLON))
    bi, bj = np.where(src)
    if len(bi) > 0:
        dist = np.sqrt(((ii[..., None] - bi) ** 2 + (jj[..., None] - bj) ** 2)).min(axis=-1)
        r_d1 = float((energy[0] * dist).sum() / max(tot1, 1e-12))
        r_late = float(np.mean([(energy[k] * dist).sum() / max(float(energy[k].sum()), 1e-12) for k in range(min(3, steps - 1), steps)]))
    else:
        r_d1, r_late = 0.0, 0.0

    out_e = np.array([float(energy[k][~near].sum()) for k in range(steps)])
    late_out = float(out_e[3:8].mean()) if steps >= 8 else float(out_e[-1])
    grows = late_out > 1.5 * float(out_e[0]) + 1e-12 and r_late >= r_d1

    finite_phys = bool(np.isfinite(run1).all() and run1[:, 1].min() >= -1e-6 and run1[:, 0].min() >= 233.15 and run1[:, 0].max() <= 333.15)
    max_z = float(z.max()) if np.isfinite(z).all() else float("inf")
    day1_z = float(z[0].max()) if np.isfinite(z[0]).all() else float("inf")
    n1 = float(np.linalg.norm(diff[0] / std[:, None, None]))
    nh = float(np.linalg.norm(half_diff[0] / std[:, None, None]))
    ratio = float(nh / n1) if n1 > 1e-9 else 0.0

    checks = [
        {"id": "zero_identity", "name": "Zero shock equals null shock", "passed": zero_diff == 0.0, "detail": f"max |diff| = {zero_diff:.3e}"},
        {"id": "day1_locality", "name": "Day-1 locality (<= 2 cells)", "passed": outside_day1 == 0.0 and near_frac >= 0.60, "detail": f"near_frac={near_frac:.3f}, outside_max={outside_day1:.3e}"},
        {"id": "outward_spread", "name": "Outward spread across days 4-8", "passed": grows, "detail": f"radius {r_d1:.2f} -> {r_late:.2f} cells"},
        {"id": "boundedness", "name": "Boundedness (< 5 std)", "passed": max_z <= 5.0, "detail": f"max |delta|/std = {max_z:.2f}"},
        {"id": "finite_physical", "name": "Finite outputs & rain >= 0", "passed": finite_phys, "detail": "all finite & physical" if finite_phys else "validity violation"},
        {"id": "source_presence", "name": "Day-1 source presence", "passed": day1_z >= 1e-3, "detail": f"day1 max |delta|/std = {day1_z:.3f}"},
        {"id": "approximate_scaling", "name": "Approximate scaling (0.5x probe)", "passed": 0.2 <= ratio <= 0.8 if n1 > 1e-9 else False, "detail": f"0.5x/1.0x norm ratio = {ratio:.3f}"},
        {"id": "determinism", "name": "Deterministic repeatability", "passed": repeat_diff == 0.0, "detail": f"max |run1 - run2| = {repeat_diff:.3e}"},
    ]
    return {"checks": checks, "passed_count": sum(1 for c in checks if c["passed"]), "total_checks": 8, "inference_ms": ms_base + ms_shock}


def run_ensemble(init_states: Any, doy_sincos: list[float], steps: int = 10, members: int = 5, noise_scale: float = 0.05) -> dict:
    """Small initial-condition perturbation ensemble via live /simulate calls."""
    members = max(3, min(int(members), 9))
    std = _stats_std()
    rng = np.random.default_rng(42)
    base, ms0 = _call_simulate(init_states, doy_sincos, steps, None)
    rollouts = [base]
    total_ms = ms0
    for _ in range(members - 1):
        eps = rng.normal(0, noise_scale, (NC, NLAT, NLON)).astype(np.float32) * std[:, None, None]
        eps[1] = 0.0  # avoid negative rain noise on input
        r, ms = _call_simulate(init_states, doy_sincos, steps, eps.tolist())
        rollouts.append(r)
        total_ms += ms
    stack = np.stack(rollouts, axis=0)
    return {
        "members": members,
        "noise_scale_std": noise_scale,
        "mean": stack.mean(axis=0).tolist(),
        "spread": stack.std(axis=0).tolist(),
        "inference_ms": total_ms,
        "note": "PROXY/DERIVED: Ensemble spread from initial-condition perturbations is not a calibrated probability without held-out reliability validation.",
    }


def run_sensitivity(init_states: Any, doy_sincos: list[float], target_channel: int = 1, target_day: int = 4, region_id: str = "central_monsoon") -> dict:
    """Measure regional model sensitivity across all 6 input channels via live /simulate."""
    std = _stats_std()
    land = np.asarray(core.land_mask(), dtype=np.float32)
    rmask = _region_mask(region_id, land, land_only=(region_id not in ("bay_of_bengal", "arabian_sea")))
    base, ms0 = _call_simulate(init_states, doy_sincos, target_day, None)
    base_val = float(base[target_day - 1, target_channel][rmask].mean())

    # Probe each channel in Bay of Bengal, Arabian Sea, and target region
    probes = [
        ("bay_of_bengal", "Bay of Bengal", 14.0, 88.0),
        ("arabian_sea", "Arabian Sea", 14.0, 70.0),
        ("central_monsoon", "Central India", 22.0, 80.0),
        ("western_ghats", "Western Ghats", 14.0, 75.0),
    ]
    rows = []
    total_ms = ms0
    for pid, pname, plat, plon in probes:
        for ch in (0, 2, 3, 5):
            amp = float(0.5 * std[ch])
            pert = _gaussian_shock(ch, plat, plon, 3.0, amp)
            out, ms = _call_simulate(init_states, doy_sincos, target_day, pert.tolist())
            total_ms += ms
            val = float(out[target_day - 1, target_channel][rmask].mean())
            rows.append({
                "source_id": pid,
                "source_name": pname,
                "channel": ch,
                "probe_amp": round(amp, 3),
                "target_delta": round(val - base_val, 4),
                "abs_sensitivity": round(abs(val - base_val) / max(amp, 1e-6), 5),
            })
    rows.sort(key=lambda r: r["abs_sensitivity"], reverse=True)
    return {
        "target_region": region_id,
        "target_channel": target_channel,
        "target_day": target_day,
        "baseline_mean": base_val,
        "sensitivities": rows,
        "inference_ms": total_ms,
        "note": "MODEL sensitivity: measures model response to bounded perturbations, not physical atmospheric causality.",
    }


def run_reverse_simulator(
    init_states: Any,
    doy_sincos: list[float],
    target_region: str = "central_monsoon",
    target_day: int = 5,
    target_channel: int = 1,
    direction: str = "increase",
) -> dict:
    """Atmospheric Reverse Simulator ('What would it take?'): bounded search over localized shocks."""
    std = _stats_std()
    land = np.asarray(core.land_mask(), dtype=np.float32)
    rmask = _region_mask(target_region, land, land_only=(target_region not in ("bay_of_bengal", "arabian_sea")))
    reg = REGIONS.get(target_region, REGIONS["central_monsoon"])
    clat0 = 0.5 * (reg["lat"][0] + reg["lat"][1])
    clon0 = 0.5 * (reg["lon"][0] + reg["lon"][1])

    base, ms0 = _call_simulate(init_states, doy_sincos, target_day, None)
    base_val = float(base[target_day - 1, target_channel][rmask].mean())
    total_ms = ms0

    # Constrained candidate grid (max 12 evaluations to keep CPU fast)
    candidates = []
    for ch, amps in ((0, [2.5, -2.5]), (5, [8.0, -8.0]), (2, [3.0, -3.0])):
        for clat, clon in ((clat0, clon0), (14.0, 88.0), (14.0, 70.0)):
            if len(candidates) >= 12:
                break
            for amp in amps:
                if len(candidates) >= 12:
                    break
                candidates.append((ch, clat, clon, 3.5, amp))

    best = None
    sign = 1.0 if direction == "increase" else -1.0
    for ch, clat, clon, rad, amp in candidates:
        pert = _gaussian_shock(ch, clat, clon, rad, amp)
        out, ms = _call_simulate(init_states, doy_sincos, target_day, pert.tolist())
        total_ms += ms
        val = float(out[target_day - 1, target_channel][rmask].mean())
        score = sign * (val - base_val)
        ood = abs(amp) > 2.5 * float(std[ch])
        if best is None or score > best["score"]:
            best = {
                "score": score,
                "channel": ch,
                "lat": clat,
                "lon": clon,
                "radius": rad,
                "amplitude": amp,
                "achieved_mean": val,
                "delta": val - base_val,
                "ood_warning": ood,
                "perturbation": pert.tolist(),
                "rollout": out.tolist(),
            }

    return {
        "target_region": target_region,
        "target_day": target_day,
        "target_channel": target_channel,
        "direction": direction,
        "baseline_mean": base_val,
        "baseline_rollout": base.tolist(),
        "best_candidate": best,
        "evaluations": len(candidates),
        "inference_ms": total_ms,
        "note": "Inverse model search / model-conditioned scenario design. Does not prove physical causality in the real atmosphere.",
    }


def run_memory_lab(
    init_states: Any,
    doy_sincos: list[float],
    perturbation: Any,
    recovery_day: int = 3,
    total_days: int = 10,
    comp_scale: float = 1.0,
) -> dict:
    """Atmospheric Memory & Recovery Lab: control vs shocked vs shocked-then-compensated branch."""
    std = _stats_std()
    pert = np.asarray(perturbation, dtype=np.float32)
    recovery_day = max(1, min(int(recovery_day), total_days - 1))

    control, ms1 = _call_simulate(init_states, doy_sincos, total_days, None)
    shocked, ms2 = _call_simulate(init_states, doy_sincos, total_days, pert.tolist())

    # Build 3-day continuation state ending at `recovery_day` (1-indexed forecast day)
    init_arr = np.asarray(init_states, dtype=np.float32)
    hist = np.concatenate([init_arr, shocked[:recovery_day]], axis=0)
    cont_init = hist[-3:]
    cont_doy = _advance_doy_sincos(doy_sincos, recovery_day)
    # Compensating perturbation: cancel remaining anomaly at recovery_day (bounded to 3*std)
    rem_anom = shocked[recovery_day - 1] - control[recovery_day - 1]
    comp_delta = np.clip(-comp_scale * rem_anom, -3.0 * std[:, None, None], 3.0 * std[:, None, None]).astype(np.float32)

    rem_steps = total_days - recovery_day
    comp_tail, ms3 = _call_simulate(cont_init.tolist(), cont_doy, rem_steps, comp_delta.tolist())
    compensated = np.concatenate([shocked[:recovery_day], comp_tail], axis=0)

    def _metrics(branch: np.ndarray) -> list[dict]:
        rows = []
        for k in range(total_days):
            d = branch[k] - control[k]
            e = ((d / std[:, None, None]) ** 2).sum(axis=0)
            rows.append({
                "day": k + 1,
                "energy": float(e.sum()),
                "affected_cells": int((e > 0.01).sum()),
                "max_z": float(np.abs(d / std[:, None, None]).max()),
            })
        return rows

    shock_curve = _metrics(shocked)
    comp_curve = _metrics(compensated)
    tol = 0.05 * max(shock_curve[0]["energy"], 1e-6)
    t_return = next((r["day"] for r in comp_curve[recovery_day:] if r["energy"] <= tol), None)

    return {
        "recovery_day": recovery_day,
        "total_days": total_days,
        "control": control.tolist(),
        "shocked": shocked.tolist(),
        "compensated": compensated.tolist(),
        "shocked_curve": shock_curve,
        "compensated_curve": comp_curve,
        "time_to_return_day": t_return,
        "tolerance_energy": tol,
        "inference_ms": ms1 + ms2 + ms3,
        "note": "Modelled disturbance persistence and recovery behaviour via branch continuation; not a measurement of real atmospheric memory.",
    }
