import json, datetime as dt
import numpy as np
from pathlib import Path
from hdf5_reader import load
from train import calendar
from monsoon.model import Net
from monsoon_r1 import scoring as S

data = load("data/official/india_climate_train.nc")[0]
data[:, 1] = np.maximum(data[:, 1], 0)
years, doy = calendar(len(data))
dates = [dt.date(2005, 1, 1) + dt.timedelta(days=i) for i in range(len(data))]
std = np.array(json.loads(Path("weights/stats.json").read_text())["std"], np.float32)

idx = np.where(np.isin(years, [2018, 2019]))[0]
starts = [t for t in idx if t-2 >= 0 and t+10 < len(data) and years[t+10] in [2018, 2019]]
selected = starts[::max(1, len(starts)//10)]

channels = ["t2m", "rainfall", "u10", "v10", "msl", "tcwv"]
results = {}

print("Selected windows:", len(selected))
print("Dates:", [str(dates[t]) for t in selected])

for label, weight in [
    ("BASELINE", "weights/model.npz"),
    ("V2", "weights/experiments/axiom_candidate_v2.npz")
]:
    print(f"\n========== {label} ==========")
    net = Net.load(weight)
    rows = []

    for t in selected:
        init = data[t-2:t+1]
        d = int(doy[t])
        base = net.rollout(init, d, 10)
        shock = S.make_shock("warm_ocean", init[-1], std)
        shocked_input = init.copy()
        shocked_input[-1] += shock
        shocked = net.rollout(shocked_input, d, 10)

        diff = shocked - base
        z = np.abs(diff / std[None, :, None, None])
        k, c, r, col = np.unravel_index(np.nanargmax(z), z.shape)
        cert = S.causality_checks(base, shocked, S.BOX_BAY_OF_BENGAL, std)

        row = {
            "date": str(dates[t]),
            "stable": bool(cert["stable"]),
            "max_z": float(z[k,c,r,col]),
            "forecast_day": int(k+1),
            "channel": channels[c],
            "grid_row": int(r),
            "grid_col": int(col),
            "baseline_value": float(base[k,c,r,col]),
            "shocked_value": float(shocked[k,c,r,col]),
            "difference": float(diff[k,c,r,col])
        }
        rows.append(row)
        print(
            f"{row['date']} | stable={row['stable']} | "
            f"max={row['max_z']:.3f}σ | day={k+1} | "
            f"{channels[c]} | cell=({r},{col}) | "
            f"change={row['difference']:+.4f}"
        )

    results[label] = rows

print("\n========== BASELINE vs V2 ==========")
for b, v in zip(results["BASELINE"], results["V2"]):
    print(
        f"{b['date']} | "
        f"baseline={b['max_z']:.3f}σ ({b['stable']}) | "
        f"V2={v['max_z']:.3f}σ ({v['stable']}) | "
        f"delta={v['max_z']-b['max_z']:+.3f}σ"
    )

Path("evaluation/warm_ocean_window_diagnostics.json").write_text(
    json.dumps(results, indent=2)
)
print("\nSaved evaluation/warm_ocean_window_diagnostics.json")
