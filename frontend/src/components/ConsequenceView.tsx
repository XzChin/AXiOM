import { useMemo } from "react";
import { Meta, Run } from "../api";
import { LineChart, Series } from "./LineChart";
import { State, consequenceProxies, regionalMean } from "../utils/science";
import { REGIONS } from "../utils/india";

interface Props {
  meta: Meta | null;
  base: Run | null;
  shocked: { run: Run; delta: State; label: string } | null;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

export function ConsequenceView({ meta, base, shocked }: Props) {
  const baseProxies = useMemo(() => {
    return base ? consequenceProxies(base.rollout, meta?.land_mask) : [];
  }, [base, meta]);

  const shockedProxies = useMemo(() => {
    return shocked ? consequenceProxies(shocked.run.rollout, meta?.land_mask) : [];
  }, [shocked, meta]);

  const seriesDeficit: Series[] = [];
  const seriesFlood: Series[] = [];
  if (baseProxies.length > 0) {
    seriesDeficit.push({
      name: "Baseline Land Deficit Fraction",
      values: baseProxies.map((p) => p.deficit_frac * 100),
      color: "#f59e0b",
    });
    seriesFlood.push({
      name: "Baseline Extreme Rain Risk Fraction",
      values: baseProxies.map((p) => p.flood_frac * 100),
      color: "#0284c7",
    });
  }
  if (shockedProxies.length > 0) {
    seriesDeficit.push({
      name: "Shocked Land Deficit Fraction",
      values: shockedProxies.map((p) => p.deficit_frac * 100),
      color: "#ea580c",
      dash: "5 3",
    });
    seriesFlood.push({
      name: "Shocked Extreme Rain Risk Fraction",
      values: shockedProxies.map((p) => p.flood_frac * 100),
      color: "#8b5cf6",
      dash: "5 3",
    });
  }

  // Regional exposure ranking
  const regionalExposure = useMemo(() => {
    if (!base) return [];
    return Object.entries(REGIONS).map(([k, reg]) => {
      // average 10-day rainfall over region
      let totalRainBase = 0;
      let totalRainShock = 0;
      for (let d = 0; d < 10; d++) {
        totalRainBase += regionalMean(
          base.rollout[d][1],
          reg.lat as [number, number],
          reg.lon as [number, number],
          meta?.land_mask
        );
        if (shocked) {
          totalRainShock += regionalMean(
            shocked.run.rollout[d][1],
            reg.lat as [number, number],
            reg.lon as [number, number],
            meta?.land_mask
          );
        }
      }
      const meanRainBase = totalRainBase / 10;
      const meanRainShock = shocked ? totalRainShock / 10 : null;
      const delta = meanRainShock !== null ? meanRainShock - meanRainBase : 0;
      const pctChange = meanRainBase > 0.1 ? (delta / meanRainBase) * 100 : 0;

      let riskCategory = "Normal Exposure";
      if (meanRainBase < 2.0 || pctChange < -25) riskCategory = "High Drought/Deficit Risk";
      else if (meanRainBase > 15.0 || pctChange > 30) riskCategory = "Elevated Flood Risk";

      return {
        id: k,
        name: reg.name,
        meanRainBase,
        meanRainShock,
        delta,
        pctChange,
        riskCategory,
      };
    });
  }, [base, shocked, meta]);

  return (
    <div className="space-y-5">
      {/* Disclaimer Banner */}
      <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
            PROXY SCREENING ONLY
          </span>
          <h2 className="text-sm font-bold text-amber-900">
            Decision-Support Screening & Impact Proxies
          </h2>
        </div>
        <p className="mt-1 text-xs text-amber-800">
          These impact metrics are purely scientific screening proxies derived from grid rainfall thresholds (&lt; 2 mm/day agricultural dry spell, &gt; 50 mm/day extreme precipitation). They are <strong>NOT official operational flood or drought warnings</strong>. Official forecasts are issued solely by the India Meteorological Department (IMD).
        </p>
      </div>

      {/* Screeners Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Agricultural Moisture Deficit Exposure
            </h3>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              Rainfall &lt; 2 mm/day
            </span>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Percentage of land grid points experiencing deficient rainfall (&lt; 2 mm/day).
          </p>
          <LineChart series={seriesDeficit} unit="% Land" />
        </div>

        <div className={card}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Extreme Rainfall & Hydrological Flood Risk
            </h3>
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
              Rainfall &gt; 50 mm/day
            </span>
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Percentage of land grid points receiving heavy localized rain (&gt; 50 mm/day).
          </p>
          <LineChart series={seriesFlood} unit="% Land" />
        </div>
      </div>

      {/* Regional Exposure Table */}
      <div className={card}>
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <h3 className="font-bold text-slate-800">
            Regional Exposure & Impact Ranking Across Agro-Climatic Zones
          </h3>
          <span className="text-xs text-slate-500">10-Day Cumulative Screening</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3">Agro-Climatic Zone</th>
                <th className="p-3">Baseline Rain (mm/day)</th>
                {shocked && <th className="p-3">Shocked Rain (mm/day)</th>}
                {shocked && <th className="p-3">Perturbation Delta</th>}
                <th className="p-3">Screening Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regionalExposure.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="p-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="p-3">{row.meanRainBase.toFixed(2)} mm/day</td>
                  {shocked && <td className="p-3">{row.meanRainShock?.toFixed(2)} mm/day</td>}
                  {shocked && (
                    <td className="p-3 font-semibold">
                      <span className={row.delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {row.delta > 0 ? "+" : ""}{row.delta.toFixed(2)} ({row.pctChange.toFixed(1)}%)
                      </span>
                    </td>
                  )}
                  <td className="p-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        row.riskCategory.includes("Drought")
                          ? "bg-amber-100 text-amber-800"
                          : row.riskCategory.includes("Flood")
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {row.riskCategory}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
