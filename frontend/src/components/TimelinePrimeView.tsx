import { useMemo } from "react";
import { Meta, Run, Window_ } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { CHANNELS, Grid, State, display, lat, lon, latRmse, regionalMean, subtract, maxAbs } from "../utils/science";
import { REGIONS, RegionId } from "../utils/india";
import { palette, ui } from "../theme";

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
    const list = [{ title: "Baseline Rollout [Model]", grid: b, range, diverging: wind }];
    if (s) {
      const d = subtract(s, b);
      const minDelta = ch === 4 ? 1.0 : 0.5;
      const k = Math.max(maxAbs(d), minDelta);
      list.push(
        { title: `Shocked: ${shocked?.label} [Model]`, grid: s, range, diverging: wind },
        { title: "Anomaly Delta: Shocked − Base [Derived]", grid: d, range: [-k, k], diverging: true }
      );
    } else if (t) {
      const d = subtract(b, t);
      const minDelta = ch === 4 ? 1.0 : 0.5;
      const k = Math.max(maxAbs(d), minDelta);
      list.push(
        { title: "Hindcast Truth ERA5 [Observed]", grid: t, range, diverging: wind },
        { title: "Forecast Error: Model − Truth [Derived]", grid: d, range: [-k, k], diverging: true }
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
    series.push({ name: "Baseline Forecast [Model]", values: at(base.rollout), color: "#5F93B5" });
    if (shocked) series.push({ name: "Shocked Multi-verse [Model]", values: at(shocked.run.rollout), color: palette.accent });
    if (win?.truth?.length === 10) series.push({ name: "Observed Hindcast Truth", values: at(win.truth), color: "#E67E22", dash: "5 4" });
  }

  // Regional timeseries
  const regSeries: Series[] = [];
  if (base) {
    const regAt = (r: State[]) =>
      r.map((s) => regionalMean(shown(s), reg.lat as [number, number], reg.lon as [number, number], meta?.land_mask));
    regSeries.push({ name: `${reg.name} (Baseline)`, values: regAt(base.rollout), color: "#5F93B5" });
    if (shocked) {
      regSeries.push({ name: `${reg.name} (Shocked)`, values: regAt(shocked.run.rollout), color: palette.accent });
    }
  }

  return (
    <div className="space-y-6">
      {/* Visual Anchor: Forecast Controls Bar */}
      <div className={`${ui.card} border-l-4 border-l-teal-400 bg-twilight-surface`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Day Scrubbers */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={ui.titleSm}>Lead Day:</span>
            {Array.from({ length: 10 }, (_, i) => (
              <button
                key={i}
                onClick={() => setDay(i + 1)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold tabular-nums transition active:scale-95 ${
                  day === i + 1
                    ? "bg-teal-500 text-steel-900 shadow-md ring-2 ring-teal-400/40"
                    : "bg-twilight-raised text-text-main hover:bg-twilight-hover hover:text-text-bright"
                }`}
              >
                Day +{i + 1}
              </button>
            ))}
          </div>

          {/* Quick Selectors */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-xs font-semibold text-text-muted">
              Region:
              <select
                className={ui.selectInline}
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value as RegionId)}
              >
                {Object.entries(REGIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v.name}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-text-muted">
              Variable:
              <select
                className={ui.selectInline}
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
      </div>

      {/* Main Visual Center: Spatial Map Workspace */}
      <div className={ui.cardRaised}>
        <div className={ui.cardHeader}>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <h2 className={ui.titleLg}>
                India Spatial Forecast — Day +{day} ({CHANNELS[ch].label})
              </h2>
            </div>
            <p className={ui.muted}>
              Autoregressive 10-day physical forecast simulated on 1-degree subcontinent grid.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className={ui.badgeAccent}>
              Selected: [{lat(cell[0])}°N, {lon(cell[1])}°E]
            </span>
            <span className={ui.badgePrimary}>
              Unit: {unit}
            </span>
          </div>
        </div>

        {maps.length > 0 ? (
          <div className={`grid gap-5 ${maps.length > 1 ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-2xl mx-auto"}`}>
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
        ) : (
          <div className="py-14 text-center text-sm text-text-muted">
            No forecast loaded. Select a climate archetype or historical date from the left controls.
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-twilight-border pt-3 text-xs text-text-muted">
          <span className="flex items-center gap-2 font-medium">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-teal-400" />
            Click anywhere on the map to inspect local coordinate timeseries below.
          </span>
          <span className="text-text-subtle font-mono">
            Selected-region boundary: {selectedRegion === "all_india" ? "India geographical outline" : `${reg.name} bounding box`} | Navy = Coastline
          </span>
        </div>
      </div>

      {/* Dual Analytics Cards: Point Trajectory & Regional Aggregate */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cell Time-Series */}
        <div className={ui.card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className={ui.titleMd}>
                Point Trajectory: Cell [{lat(cell[0])}°N, {lon(cell[1])}°E]
              </h3>
              <p className={ui.muted}>Autoregressive forecast path at clicked coordinates</p>
            </div>
            <span className={ui.badgeNeutral}>
              10-Day Horizon
            </span>
          </div>
          <LineChart series={series} unit={unit} />
        </div>

        {/* Regional Time-Series & Summary */}
        <div className={ui.card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={ui.titleMd}>
                Regional Domain Aggregate: {reg.name}
              </h3>
              <p className={ui.muted}>Mean over {reg.lat[0]}–{reg.lat[1]}°N, {reg.lon[0]}–{reg.lon[1]}°E</p>
            </div>
            {regionalStats && (
              <span className={`${ui.badgePrimary} tabular-nums`}>
                Mean: {regionalStats.bMean.toFixed(2)} {unit}
                {regionalStats.delta !== null && (
                  <span className={regionalStats.delta >= 0 ? "text-teal-300 font-bold" : "text-amber-300 font-bold"}>
                    {" "}(Δ {regionalStats.delta > 0 ? "+" : ""}{regionalStats.delta.toFixed(2)})
                  </span>
                )}
              </span>
            )}
          </div>
          <LineChart series={regSeries} unit={unit} />
        </div>
      </div>

      {/* Truth vs Twin Verification Panel (when ERA5 Hindcast Truth is active) */}
      {win?.truth?.[day - 1] && base && (
        <div className="rounded-2xl border border-teal-500/50 bg-teal-900/20 p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className={ui.titleMd}>
                Hindcast Verification vs Ground Truth ERA5 (Day +{day})
              </h4>
              <p className="text-xs text-text-muted">
                Offline benchmark evaluation comparing AI forecast against observed ERA5 reanalysis
              </p>
            </div>
            <span className={ui.badgeAccent}>
              VERIFIED AGAINST ERA5
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-twilight-border bg-twilight-surface p-4 shadow-sm tabular-nums">
              <span className="block text-xs font-semibold text-text-muted">Model Latitude-Weighted RMSE</span>
              <span className="mt-1 block text-lg font-bold text-text-bright">
                {latRmse(shown(base.rollout[day - 1]), shown(win.truth[day - 1])).toFixed(3)} {unit}
              </span>
            </div>
            <div className="rounded-xl border border-twilight-border bg-twilight-surface p-4 shadow-sm tabular-nums">
              <span className="block text-xs font-semibold text-text-muted">Persistence Baseline RMSE</span>
              <span className="mt-1 block text-lg font-bold text-text-bright">
                {latRmse(shown(win.init_states[2]), shown(win.truth[day - 1])).toFixed(3)} {unit}
              </span>
            </div>
            <div className="rounded-xl border border-twilight-border bg-twilight-surface p-4 shadow-sm tabular-nums">
              <span className="block text-xs font-semibold text-text-muted">Relative Skill over Persistence</span>
              {(() => {
                const mRmse = latRmse(shown(base.rollout[day - 1]), shown(win.truth[day - 1]));
                const pRmse = latRmse(shown(win.init_states[2]), shown(win.truth[day - 1]));
                const skill = pRmse > 0 ? ((pRmse - mRmse) / pRmse) * 100 : 0;
                return (
                  <span className={`mt-1 block text-lg font-bold ${skill >= 0 ? "text-teal-300" : "text-amber-300"}`}>
                    {skill >= 0 ? "+" : ""}{skill.toFixed(1)}% {skill >= 0 ? "gain" : "loss"}
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
