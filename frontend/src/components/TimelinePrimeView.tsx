import { useMemo, useState } from "react";
import { Meta, Run, Window_ } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { CHANNELS, Grid, State, display, lat, lon, latRmse, regionalMean, subtract, maxAbs } from "../utils/science";
import { REGIONS, RegionId } from "../utils/india";

interface Props {
  meta: Meta | null;
  win: Window_ | null;
  base: Run | null;
  shocked: { run: Run; delta: State; label: string } | null;
  ch: number;
  setCh: (c: number) => void;
  day: number;
  setDay: (d: number) => void;
  cell: [number, number];
  setCell: (c: [number, number]) => void;
  selectedRegion: RegionId;
  setSelectedRegion: (r: RegionId) => void;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

export function TimelinePrimeView({
  meta, win, base, shocked, ch, setCh, day, setDay, cell, setCell, selectedRegion, setSelectedRegion,
}: Props) {
  const unit = CHANNELS[ch].unit;
  const shown = (s: State): Grid => s[ch].map((r) => r.map((v) => display(v, ch)));

  const reg = REGIONS[selectedRegion];

  const maps = useMemo(() => {
    if (!base) return [];
    const b = shown(base.rollout[day - 1]);
    const s = shocked ? shown(shocked.run.rollout[day - 1]) : null;
    const t = !shocked && win?.truth?.[day - 1] ? shown(win.truth[day - 1]) : null;
    const flat = [b, s ?? t ?? b].flat(2);
    const wind = ch === 2 || ch === 3;
    const m = Math.max(...flat.map(Math.abs));
    const range: [number, number] = wind ? [-m, m] : [Math.min(...flat), Math.max(...flat)];
    const list = [{ title: "Baseline Rollout (MODEL)", grid: b, range, diverging: wind }];
    if (s) {
      const d = subtract(s, b), k = maxAbs(d) || 1;
      list.push(
        { title: `Shocked: ${shocked?.label} (MODEL)`, grid: s, range, diverging: wind },
        { title: "Anomaly Delta: Shocked − Base (DERIVED)", grid: d, range: [-k, k], diverging: true }
      );
    } else if (t) {
      const d = subtract(b, t), k = maxAbs(d) || 1;
      list.push(
        { title: "Hindcast Truth ERA5 (OBSERVED)", grid: t, range, diverging: wind },
        { title: "Forecast Error: Model − Truth (DERIVED)", grid: d, range: [-k, k], diverging: true }
      );
    }
    return list;
  }, [base, shocked, win, ch, day]);

  // Regional summary stats
  const regionalStats = useMemo(() => {
    if (!base) return null;
    const curBase = shown(base.rollout[day - 1]);
    const bMean = regionalMean(curBase, reg.lat as [number, number], reg.lon as [number, number], meta?.land_mask);
    let sMean: number | null = null;
    if (shocked) {
      const curShock = shown(shocked.run.rollout[day - 1]);
      sMean = regionalMean(curShock, reg.lat as [number, number], reg.lon as [number, number], meta?.land_mask);
    }
    return { bMean, sMean, delta: sMean !== null ? sMean - bMean : null };
  }, [base, shocked, day, ch, reg, meta]);

  // Timeseries for the selected grid cell
  const series: Series[] = [];
  if (base) {
    const at = (r: State[]) => r.map((s) => display(s[ch][cell[0]][cell[1]], ch));
    series.push({ name: "Baseline Forecast", values: at(base.rollout), color: "#0284c7" });
    if (shocked) series.push({ name: "Shocked Multi-verse", values: at(shocked.run.rollout), color: "#ea580c" });
    if (win?.truth?.length === 10) series.push({ name: "Observed Hindcast Truth", values: at(win.truth), color: "#16a34a", dash: "6 4" });
  }

  // Regional timeseries
  const regSeries: Series[] = [];
  if (base) {
    const regAt = (r: State[]) =>
      r.map((s) => regionalMean(shown(s), reg.lat as [number, number], reg.lon as [number, number], meta?.land_mask));
    regSeries.push({ name: `${reg.name} (Baseline)`, values: regAt(base.rollout), color: "#0284c7" });
    if (shocked) {
      regSeries.push({ name: `${reg.name} (Shocked)`, values: regAt(shocked.run.rollout), color: "#ea580c" });
    }
  }

  return (
    <div className="space-y-5">
      {/* Forecast Controls Bar */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-xs font-bold uppercase tracking-wider text-slate-500">Forecast Day:</span>
          {Array.from({ length: 10 }, (_, i) => (
            <button
              key={i}
              onClick={() => setDay(i + 1)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                day === i + 1
                  ? "bg-sky-700 text-white shadow-sm ring-2 ring-sky-700/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Day +{i + 1}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            Region:
            <select
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-sm"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value as RegionId)}
            >
              {Object.entries(REGIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            Variable:
            <select
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-sm"
              value={ch}
              onChange={(e) => setCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label} ({c.unit})</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Grid Maps */}
      <div className={card}>
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <h2 className="text-base font-bold text-slate-800">
            India Spatial Field — Day +{day} ({CHANNELS[ch].label})
          </h2>
          <span className="text-xs text-slate-500">
            Click on any grid cell to inspect local cell timeseries
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {maps.map((m) => (
            <GridMap
              key={m.title}
              {...m}
              unit={unit}
              land={meta?.land_mask || []}
              cell={cell}
              onCell={setCell}
              regionBounds={selectedRegion === "all_india" ? undefined : reg}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-slate-500">
          <span>
            Selected-region boundary: {selectedRegion === "all_india"
              ? "India geographical outline"
              : `${reg.name} bounding box`}. Black line: Land-sea boundary.
          </span>
          <span>Selected Cell: [{lat(cell[0])}°N, {lon(cell[1])}°E]</span>
        </div>
      </div>

      {/* Analytics & Graphs */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Cell Time-Series */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Point Trajectory: Cell [{lat(cell[0])}°N, {lon(cell[1])}°E]
            </h3>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              10-Day Horizon
            </span>
          </div>
          <LineChart series={series} unit={unit} />
        </div>

        {/* Regional Time-Series & Summary */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Regional Aggregate: {reg.name}
            </h3>
            {regionalStats && (
              <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                Mean: {regionalStats.bMean.toFixed(2)} {unit}
                {regionalStats.delta !== null && (
                  <span className={regionalStats.delta >= 0 ? " text-orange-600" : " text-blue-600"}>
                    {" "}(Δ {regionalStats.delta > 0 ? "+" : ""}{regionalStats.delta.toFixed(2)})
                  </span>
                )}
              </span>
            )}
          </div>
          <LineChart series={regSeries} unit={unit} />
        </div>
      </div>

      {/* Truth vs Twin Verification Panel (when Hindcast is active) */}
      {win?.truth?.[day - 1] && base && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-950">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-emerald-900">
              Hindcast Truth vs Twin Skill Audit (Day +{day})
            </h4>
            <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              VERIFIED AGAINST ERA5
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-white/80 p-3 shadow-xs">
              <span className="block text-xs text-slate-500">Model Latitude-Weighted RMSE</span>
              <span className="text-lg font-bold text-slate-800">
                {latRmse(shown(base.rollout[day - 1]), shown(win.truth[day - 1])).toFixed(3)} {unit}
              </span>
            </div>
            <div className="rounded-lg bg-white/80 p-3 shadow-xs">
              <span className="block text-xs text-slate-500">Persistence (Yesterday) Baseline</span>
              <span className="text-lg font-bold text-slate-800">
                {latRmse(shown(win.init_states[2]), shown(win.truth[day - 1])).toFixed(3)} {unit}
              </span>
            </div>
            <div className="rounded-lg bg-white/80 p-3 shadow-xs">
              <span className="block text-xs text-slate-500">Relative Skill over Persistence</span>
              {(() => {
                const mRmse = latRmse(shown(base.rollout[day - 1]), shown(win.truth[day - 1]));
                const pRmse = latRmse(shown(win.init_states[2]), shown(win.truth[day - 1]));
                const skill = pRmse > 0 ? ((pRmse - mRmse) / pRmse) * 100 : 0;
                return (
                  <span className={`text-lg font-bold ${skill >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {skill >= 0 ? "+" : ""}{skill.toFixed(1)}% {skill >= 0 ? "improvement" : "degradation"}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
