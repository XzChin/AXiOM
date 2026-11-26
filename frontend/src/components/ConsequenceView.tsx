import { useMemo } from "react";
import { Meta, Run } from "../api";
import { LineChart, Series } from "./LineChart";
import { State, consequenceProxies, regionalMean } from "../utils/science";
import { REGIONS } from "../utils/india";
import { palette, ui } from "../theme";

interface Props {
  meta: Meta | null;
  base: Run | null;
  shocked: { run: Run; delta: State; label: string } | null;
}

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
      name: "Baseline Land Deficit Fraction [Proxy]",
      values: baseProxies.map((p) => p.deficit_frac * 100),
      color: "#5F93B5",
    });
    seriesFlood.push({
      name: "Baseline Heavy Rain Risk Fraction [Proxy]",
      values: baseProxies.map((p) => p.flood_frac * 100),
      color: "#5F93B5",
    });
  }
  if (shockedProxies.length > 0) {
    seriesDeficit.push({
      name: "Shocked Land Deficit Fraction [Proxy]",
      values: shockedProxies.map((p) => p.deficit_frac * 100),
      color: "#E67E22",
      dash: "5 3",
    });
    seriesFlood.push({
      name: "Shocked Heavy Rain Risk Fraction [Proxy]",
      values: shockedProxies.map((p) => p.flood_frac * 100),
      color: "#E67E22",
      dash: "5 3",
    });
  }

  // Regional exposure ranking
  const regionalExposure = useMemo(() => {
    if (!base) return [];
    return Object.entries(REGIONS).map(([k, reg]) => {
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
    <div className="space-y-6">
      {/* Explicit Scientific Disclaimer Banner */}
      <div className="rounded-2xl border border-[#C99A75] bg-[#F2E2D7] p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-md bg-[#A66A45] border border-[#905535] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#FFFEFA]">
            PROXY SCREENING ONLY
          </span>
          <h2 className="text-sm font-bold text-[#29364A]">
            Decision-Support Screening &amp; Agro-Climatic Impact Proxies
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#5A4634]">
          These impact metrics are purely scientific screening proxies derived from grid rainfall thresholds (&lt; 2 mm/day agricultural dry spell, &gt; 50 mm/day extreme precipitation). They are <strong>NOT official operational flood or drought warnings</strong>. Official meteorological advisories and warnings are issued solely by the India Meteorological Department (IMD).
        </p>
      </div>

      {/* Screeners Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={ui.card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className={ui.titleMd}>
              Agricultural Moisture Deficit Exposure [Proxy]
            </h3>
            <span className={ui.badgeWarning}>
              Rainfall &lt; 2 mm/day
            </span>
          </div>
          <p className="mb-3 text-xs text-text-muted">
            Percentage of land grid points experiencing deficient rainfall (&lt; 2 mm/day).
          </p>
          <LineChart series={seriesDeficit} unit="% Land" />
        </div>

        <div className={ui.card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className={ui.titleMd}>
              Heavy Rainfall Hydrological Risk [Proxy]
            </h3>
            <span className={ui.badgeAccent}>
              Rainfall &gt; 50 mm/day
            </span>
          </div>
          <p className="mb-3 text-xs text-text-muted">
            Percentage of land grid points receiving heavy localized rain (&gt; 50 mm/day).
          </p>
          <LineChart series={seriesFlood} unit="% Land" />
        </div>
      </div>

      {/* Regional Exposure Table */}
      <div className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h3 className={ui.titleMd}>
              Regional Exposure &amp; Impact Ranking Across Agro-Climatic Zones [Proxy]
            </h3>
            <p className={ui.muted}>10-day cumulative screening across Indian geographic domains</p>
          </div>
          <span className={ui.badgePrimary}>10-DAY MEAN</span>
        </div>

        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead className={ui.thead}>
              <tr>
                <th className="p-3">Agro-Climatic Zone</th>
                <th className="p-3">Baseline Rain (mm/day) [Model]</th>
                {shocked && <th className="p-3">Shocked Rain (mm/day) [Model]</th>}
                {shocked && <th className="p-3">Perturbation Delta [Derived]</th>}
                <th className="p-3">Screening Classification [Proxy]</th>
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {regionalExposure.map((row) => (
                <tr key={row.id} className="hover:bg-twilight-hover/40 transition-colors">
                  <td className="p-3 font-semibold text-text-bright">{row.name}</td>
                  <td className="p-3 text-text-main">{row.meanRainBase.toFixed(2)} mm/day</td>
                  {shocked && <td className="p-3 text-text-main">{row.meanRainShock?.toFixed(2)} mm/day</td>}
                  {shocked && (
                    <td className="p-3 font-semibold">
                      <span className={row.delta >= 0 ? "text-teal-300" : "text-amber-300"}>
                        {row.delta > 0 ? "+" : ""}{row.delta.toFixed(2)} ({row.pctChange.toFixed(1)}%)
                      </span>
                    </td>
                  )}
                  <td className="p-3">
                    <span
                      className={
                        row.riskCategory.includes("Drought")
                          ? ui.badgeWarning
                          : row.riskCategory.includes("Flood")
                          ? ui.badgeAccent
                          : ui.badgeNeutral
                      }
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
