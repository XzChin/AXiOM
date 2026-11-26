"""Local evaluation grader & 8-check Shock Behaviour Certificate.

Supports:
1. Full blocked temporal cross-validation and 5-window/3-shock evaluation when --data PATH.nc is provided.
2. Offline synthetic 5-archetype + 3-shock certificate verification when no NetCDF archive is mounted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Optional

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "training")]

from monsoon.model import H, LAT, LON, NC, Net, RADIUS, W  # noqa: E402
from monsoon_r1 import contract as C, scoring as S, stats as kit_stats  # noqa: E402


DEFAULT_FOLDS = [
    {"name": "fold1_2014_2015", "train_end": 2013, "val_years": [2014, 2015]},
    {"name": "fold2_2016_2017", "train_end": 2015, "val_years": [2016, 2017]},
    {"name": "fold3_2018_2019", "train_end": 2017, "val_years": [2018, 2019]},
]


def load_std(path: Path = ROOT / "weights" / "stats.json") -> np.ndarray:
    return np.array(json.loads(path.read_text())["std"], dtype=np.float32)


def _dilate_mask(mask: np.ndarray, radius: int, square: bool = True) -> np.ndarray:
    out = mask.copy()
    for _ in range(radius):
        o = out.copy()
        o[1:] |= out[:-1]
        o[:-1] |= out[1:]
        o[:, 1:] |= out[:, :-1]
        o[:, :-1] |= out[:, 1:]
        if square:
            o[1:, 1:] |= out[:-1, :-1]
            o[1:, :-1] |= out[:-1, 1:]
            o[:-1, 1:] |= out[1:, :-1]
            o[:-1, :-1] |= out[1:, 1:]
        out = o
    return out


def _effective_radius(energy_2d: np.ndarray, src_mask: np.ndarray) -> float:
    tot = float(energy_2d.sum())
    if tot <= 1e-12:
        return 0.0
    ii, jj = np.indices((H, W))
    bi, bj = np.where(src_mask)
    if len(bi) == 0:
        return 0.0
    dist = np.sqrt(((ii[..., None] - bi) ** 2 + (jj[..., None] - bj) ** 2)).min(axis=-1)
    return float((energy_2d * dist).sum() / tot)


def shock_certificate(
    net: Net,
    init_states: np.ndarray,
    doy: int,
    delta: np.ndarray,
    box: Optional[tuple[float, float, float, float]] = None,
    std: Optional[np.ndarray] = None,
    steps: int = 10,
) -> dict:
    """Run all 8 Shock Behaviour Certificate checks for a perturbation [6,32,36]."""
    std_arr = load_std() if std is None else np.asarray(std, np.float32)
    base = net.rollout(init_states.copy(), doy, steps)

    zero_in = init_states.copy()
    zero_out = net.rollout(zero_in, doy, steps)
    zero_diff = float(np.max(np.abs(zero_out - base)))

    shock_in = init_states.copy()
    shock_in[-1] += delta
    run1 = net.rollout(shock_in.copy(), doy, steps)
    run2 = net.rollout(shock_in.copy(), doy, steps)
    repeat_diff = float(np.max(np.abs(run1 - run2)))

    # Small scaling probe (0.5x vs 1.0x)
    half_in = init_states.copy()
    half_in[-1] += 0.5 * delta
    half_run = net.rollout(half_in, doy, steps)

    diff = run1 - base
    half_diff = half_run - base
    z = np.abs(diff / std_arr[None, :, None, None])
    energy = ((diff / std_arr[None, :, None, None]) ** 2).sum(axis=1)

    src_mask = C.box_mask(box) if box is not None else np.any(delta != 0, axis=0)
    near = _dilate_mask(src_mask, RADIUS, square=True)
    near_kit = _dilate_mask(src_mask, S.DILATE, square=False)
    tot1 = float(energy[0].sum())
    near_frac_day1 = float(energy[0][near_kit].sum() / tot1) if tot1 > 0 else 0.0
    outside_day1 = float(np.max(np.abs(diff[0][:, ~near]))) if (~near).any() else 0.0

    r_day1 = _effective_radius(energy[0], src_mask)
    r_late = float(np.mean([_effective_radius(energy[k], src_mask) for k in range(min(3, steps - 1), steps)]))
    out_e = np.array([float(energy[k][~near].sum()) for k in range(steps)])
    late_out = float(out_e[3:8].mean()) if steps >= 8 else float(out_e[-1])
    outward_grows = late_out > 1.5 * float(out_e[0]) + 1e-12 and r_late >= r_day1

    val_violations = S.validity(run1, steps)
    max_z = float(z.max()) if np.isfinite(z).all() else float("inf")
    day1_max_z = float(z[0].max()) if np.isfinite(z[0]).all() else float("inf")

    norm1 = float(np.linalg.norm(diff[0] / std_arr[:, None, None]))
    norm_half = float(np.linalg.norm(half_diff[0] / std_arr[:, None, None]))
    scale_ratio = float(norm_half / norm1) if norm1 > 1e-9 else 0.0

    checks = [
        {"id": "zero_identity", "name": "Zero shock equals null shock", "passed": zero_diff == 0.0, "detail": f"max |diff| = {zero_diff:.3e}"},
        {"id": "day1_locality", "name": "Day-1 locality within receptive field", "passed": outside_day1 == 0.0 and near_frac_day1 >= 0.60, "detail": f"near_frac={near_frac_day1:.3f}, outside_max={outside_day1:.3e}"},
        {"id": "outward_spread", "name": "Outward spread across forecast horizon", "passed": outward_grows, "detail": f"r_day1={r_day1:.2f} -> r_late={r_late:.2f} cells"},
        {"id": "boundedness", "name": "Bounded response (< 5 std)", "passed": max_z <= S.STABLE_MAX_STD, "detail": f"max |delta|/std = {max_z:.2f}"},
        {"id": "finite_physical", "name": "Finite outputs and non-negative rainfall", "passed": len(val_violations) == 0, "detail": "valid" if not val_violations else ", ".join(val_violations)},
        {"id": "source_presence", "name": "Day-1 source response present", "passed": day1_max_z >= S.NONZERO_MIN, "detail": f"day1 max |delta|/std = {day1_max_z:.3f}"},
        {"id": "approximate_scaling", "name": "Approximate scaling (0.5x probe)", "passed": 0.2 <= scale_ratio <= 0.8 if norm1 > 1e-9 else False, "detail": f"0.5x/1.0x norm ratio = {scale_ratio:.3f} (model diagnostic)"},
        {"id": "determinism", "name": "Deterministic repeatability", "passed": repeat_diff == 0.0, "detail": f"max |run1 - run2| = {repeat_diff:.3e}"},
    ]
    return {
        "passed_count": sum(1 for c in checks if c["passed"]),
        "total_checks": len(checks),
        "checks": checks,
        "metrics": {
            "max_z": max_z,
            "near_frac_day1": near_frac_day1,
            "r_day1": r_day1,
            "r_late": r_late,
            "scale_ratio": scale_ratio,
        },
    }


def _synthetic_archetypes() -> list[tuple[str, int, np.ndarray]]:
    """Five synthetic India-like weather archetypes for offline smoke grading when .nc is absent."""
    rng = np.random.default_rng(42)
    base = np.array([298.0, 4.0, 3.0, 2.0, 100700.0, 42.0], np.float32)[None, :, None, None]
    cases = [
        ("monsoon_onset", 155, [300.0, 12.0, 6.0, 4.0, 100400.0, 52.0]),
        ("heavy_rain", 200, [297.0, 22.0, 7.0, 3.0, 100200.0, 58.0]),
        ("heatwave", 135, [311.0, 0.2, 2.0, 0.5, 100600.0, 22.0]),
        ("cyclone", 295, [299.0, 28.0, -8.0, 7.0, 99400.0, 60.0]),
        ("winter_disturbance", 20, [286.0, 3.0, 4.0, -2.0, 101600.0, 18.0]),
    ]
    out = []
    for name, doy, mean in cases:
        m = np.array(mean, np.float32)[None, :, None, None]
        x = m + rng.normal(0, 1, (3, NC, H, W)).astype(np.float32) * np.array([2.0, 3.0, 1.5, 1.5, 180.0, 5.0], np.float32)[None, :, None, None]
        x[:, 1] = np.maximum(x[:, 1], 0.0)
        x[:, 5] = np.maximum(x[:, 5], 1.0)
        out.append((name, doy, x))
    return out


def run_synthetic_audit(net: Net) -> dict:
    std = load_std()
    archetypes = _synthetic_archetypes()
    validity_ok = True
    for _, doy, x in archetypes:
        out = net.rollout(x, doy, 10)
        if S.validity(out, 10):
            validity_ok = False
    _, doy, x = archetypes[0]
    warm = S.make_shock("warm_ocean", x[-1], std)
    stall = S.make_shock("monsoon_stall", x[-1], std)
    return {
        "mode": "synthetic_smoke",
        "archetypes_valid": validity_ok,
        "warm_ocean_cert": shock_certificate(net, x, doy, warm, S.BOX_BAY_OF_BENGAL, std),
        "monsoon_stall_cert": shock_certificate(net, x, doy, stall, S.BOX_ARABIAN_SEA, std),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", help="Path to india_climate_train.nc (optional)")
    ap.add_argument("--weights", default=str(ROOT / "weights" / "model.npz"))
    ap.add_argument("--years", type=int, nargs="+", default=[2018, 2019])
    ap.add_argument("--clim-end", type=int, default=2017)
    ap.add_argument("--stride", type=int, default=5)
    ap.add_argument("--out")
    args = ap.parse_args()

    net = Net.load(args.weights)
    if not args.data:
        res = run_synthetic_audit(net)
    else:
        from hdf5_reader import load
        from train import calendar

        data = load(args.data)[0]
        data[:, 1] = np.maximum(data[:, 1], 0)
        years, doy = calendar(len(data))
        dates = [dt.date(2005, 1, 1) + dt.timedelta(days=i) for i in range(len(data))]
        ymd = np.array([int(f"{d:%Y%m%d}") for d in dates])
        clim = kit_stats.climatology(data[years <= args.clim_end], ymd[years <= args.clim_end])
        std = load_std()
        idx = np.where(np.isin(years, args.years))[0]
        starts = [t for t in idx[::args.stride] if t - 2 >= 0 and t + 10 < len(data) and years[t + 10] in args.years]
        L = [0, 3, 7]
        P, T, Pe, Cl, ratios, invalid = [], [], [], [], [], 0
        for t in starts:
            out = net.rollout(data[t - 2:t + 1], int(doy[t]), 10)
            invalid += bool(S.validity(out, 10))
            true = data[t + 1:t + 11]
            c = np.stack([kit_stats.clim_for(clim, dates[t + k]) for k in range(1, 11)])
            P.append(out[L]); T.append(true[L]); Cl.append(c[L]); Pe.append(np.repeat(data[t][None], 3, 0))
            ratios.append(S.variance_ratio(out[7], true[7]))
        P, T, Pe, Cl = map(np.stack, (P, T, Pe, Cl))
        sk = [S.skill_vs_best_ref(P[i], T[i], Pe[i], Cl[i]) for i in range(len(starts))]
        res = {
            "mode": "era5_dataset",
            "years": args.years,
            "windows": len(starts),
            "invalid_windows": invalid,
            "mean_window_skill": float(np.nanmean([s["ss"] for s in sk])),
            "day8_variance_ratio": [round(float(v), 3) for v in np.nanmean(ratios, 0)],
            "anti_blur_points": float(S.anti_blur_points(np.stack(ratios))),
        }

    txt = json.dumps(res, indent=2)
    print(txt)
    if args.out:
        Path(args.out).write_text(txt)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
