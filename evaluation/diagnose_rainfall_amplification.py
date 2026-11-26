import json, datetime as dt
import numpy as np
from pathlib import Path
from hdf5_reader import load
from train import calendar
from monsoon.model import Net
from monsoon_r1 import scoring as S

data = load("data/official/india_climate_train.nc")[0]
data[:,1] = np.maximum(data[:,1], 0)
years, doy = calendar(len(data))
dates = [dt.date(2005,1,1)+dt.timedelta(days=i) for i in range(len(data))]
std = np.array(json.loads(Path("weights/stats.json").read_text())["std"],np.float32)

target_dates = ["2018-05-25","2018-08-05","2019-05-20","2019-07-31"]
channels = ["t2m","rainfall","u10","v10","msl","tcwv"]
results = {}

for label, path in [
    ("BASELINE","weights/model.npz"),
    ("V2","weights/experiments/axiom_candidate_v2.npz")
]:
    net = Net.load(path)
    results[label] = {}
    print(f"\n========== {label} ==========")

    for target in target_dates:
        t = dates.index(dt.date.fromisoformat(target))
        init = data[t-2:t+1]
        base = net.rollout(init,int(doy[t]),10)
        shock_input = init.copy()
        shock_input[-1] += S.make_shock("warm_ocean",init[-1],std)
        shocked = net.rollout(shock_input,int(doy[t]),10)
        z = np.abs((shocked-base)/std[None,:,None,None])

        rain = z[:,1]
        cell = np.unravel_index(np.argmax(rain),rain.shape)
        day, row, col = cell
        daily = [round(float(rain[k].max()),3) for k in range(10)]

        results[label][target] = {
            "daily_rain_max_z": daily,
            "max_rain_z": float(rain.max()),
            "max_rain_day": int(day+1),
            "max_rain_row": int(row),
            "max_rain_col": int(col),
            "baseline_rain_at_peak": float(base[day,1,row,col]),
            "shocked_rain_at_peak": float(shocked[day,1,row,col]),
            "rain_change_at_peak": float(shocked[day,1,row,col]-base[day,1,row,col]),
            "all_channel_daily_max_z": [
                [float(z[k,c].max()) for c in range(6)] for k in range(10)
            ]
        }

        print(f"\n{target}")
        print("Daily rainfall max σ:",daily)
        print(f"Peak: day {day+1}, cell ({row},{col}), {rain[day,row,col]:.3f}σ")
        print(f"Baseline rain: {base[day,1,row,col]:.3f} mm/day")
        print(f"Shocked rain:  {shocked[day,1,row,col]:.3f} mm/day")
        print(f"Rain increase: {shocked[day,1,row,col]-base[day,1,row,col]:+.3f} mm/day")

Path("evaluation/rainfall_amplification_diagnostic.json").write_text(
    json.dumps(results,indent=2)
)
print("\nSaved evaluation/rainfall_amplification_diagnostic.json")
