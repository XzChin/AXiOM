"""Score the model with the official kit's scoring functions (pip install the kit wheel first, or pass --kit DIR
containing the unpacked monsoon_r1 package).
Usage: python evaluation/evaluate.py --data NC --weights weights/model.npz --years 2020 2021 --stride 5"""
import argparse, datetime as dt, json, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "training")]
from hdf5_reader import load
from train import calendar
from monsoon.model import Net

ap = argparse.ArgumentParser()
ap.add_argument("--data", required=True)
ap.add_argument("--weights", default=str(ROOT / "weights/model.npz"))
ap.add_argument("--years", type=int, nargs="+", required=True)
ap.add_argument("--clim-end", type=int, default=2017)
ap.add_argument("--stride", type=int, default=5)
ap.add_argument("--rain-scale", type=float)
ap.add_argument("--kit")
ap.add_argument("--out")
args = ap.parse_args()
if args.kit:
    sys.path.append(args.kit)
from monsoon_r1 import scoring as S, stats

data = load(args.data)[0]
data[:, 1] = np.maximum(data[:, 1], 0)
years, doy = calendar(len(data))
dates = [dt.date(2005, 1, 1) + dt.timedelta(days=i) for i in range(len(data))]
ymd = np.array([int(f"{d:%Y%m%d}") for d in dates])
clim = stats.climatology(data[years <= args.clim_end], ymd[years <= args.clim_end])
std = np.array(json.loads((ROOT / "weights/stats.json").read_text())["std"], np.float32)
net = Net.load(args.weights)
if args.rain_scale is not None:
    net.a["rain_scale"] = np.float32(args.rain_scale)
idx = np.where(np.isin(years, args.years))[0]
starts = [t for t in idx[::args.stride] if t - 2 >= 0 and t + 10 < len(data) and years[t + 10] in args.years]
L = [0, 3, 7]
P, T, Pe, Cl, ratios, invalid = [], [], [], [], [], 0
for t in starts:
    out = net.rollout(data[t - 2:t + 1], int(doy[t]), 10)
    invalid += bool(S.validity(out, 10))
    true = data[t + 1:t + 11]
    c = np.stack([stats.clim_for(clim, dates[t + k]) for k in range(1, 11)])
    P.append(out[L]); T.append(true[L]); Cl.append(c[L]); Pe.append(np.repeat(data[t][None], 3, 0))
    ratios.append(S.variance_ratio(out[7], true[7]))
P, T, Pe, Cl = map(np.stack, (P, T, Pe, Cl))
sk = [S.skill_vs_best_ref(P[i], T[i], Pe[i], Cl[i]) for i in range(len(starts))]
res = {"years": args.years, "windows": len(starts), "invalid_windows": invalid,
       "mean_window_skill": float(np.nanmean([s["ss"] for s in sk])), "by_lead": {}}
for j, lead in enumerate((1, 4, 8)):
    r = S.skill_vs_best_ref(P[:, j], T[:, j], Pe[:, j], Cl[:, j])
    res["by_lead"][f"day{lead}"] = {
        k: [round(float(v), 4) for v in r[k]] for k in ("rmse", "ss", "ss_persist", "ss_clim")}
    res["by_lead"][f"day{lead}"]["csi"] = {n: round(S.csi(a[:, j, 1], T[:, j, 1]), 4)
                                            for n, a in (("model", P), ("persistence", Pe), ("climatology", Cl))}
res["day8_variance_ratio"] = [round(float(v), 3) for v in np.nanmean(ratios, 0)]
res["anti_blur_points"] = S.anti_blur_points(np.stack(ratios))
# shock behaviour on several real windows
rows = []
for t in starts[::max(1, len(starts) // 10)]:
    init, d = data[t - 2:t + 1], int(doy[t])
    base = net.rollout(init, d, 10)
    shocks = []
    for name, box in (("warm_ocean", S.BOX_BAY_OF_BENGAL), ("monsoon_stall", S.BOX_ARABIAN_SEA)):
        x = init.copy(); x[-1] += S.make_shock(name, init[-1], std)
        shocks.append(S.causality_checks(base, net.rollout(x, d, 10), box, std))
    x = init.copy(); x[-1] += S.make_shock("null", init[-1], std)
    ok = S.null_consistent(base, net.rollout(x, d, 10), std)
    rows.append({"points": S.causality_points(shocks, ok), "null_ok": ok, "shocks": shocks})
res["causality_mean_points_of_15"] = float(np.mean([r["points"] for r in rows]))
res["causality_windows"] = len(rows)
res["null_all_ok"] = all(r["null_ok"] for r in rows)
res["shock_pass_rate"] = {n: {k: float(np.mean([r["shocks"][i][k] for r in rows])) for k in ("nonzero", "localized", "propagates", "stable")}
                          for i, n in enumerate(("warm_ocean", "monsoon_stall"))}
txt = json.dumps(res, indent=1)
print(txt)
if args.out:
    Path(args.out).write_text(txt)
