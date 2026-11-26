import { useState } from "react";
import { MemoryResult, ReverseResult, Window_, runMemory, runReverse } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { CHANNELS, Grid, State, display, maxAbs, presetShock } from "../utils/science";
import { REGIONS, RegionId } from "../utils/india";

interface Props {
  win: Window_ | null;
  meta: any;
  task: (name: string, fn: () => Promise<void>) => Promise<void>;
  busy: string;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const btnPrimary = "rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-40 transition";
const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 shadow-sm";

export function ReverseMemoryView({ win, meta, task, busy }: Props) {
  // Reverse Simulator State
  const [revRegion, setRevRegion] = useState<RegionId>("central_monsoon");
  const [revDay, setRevDay] = useState(5);
  const [revCh, setRevCh] = useState(1);
  const [revDir, setRevDir] = useState<"increase" | "decrease">("increase");
  const [revResult, setRevResult] = useState<ReverseResult | null>(null);

  // Memory Lab State
  const [memShock, setMemShock] = useState<"warm_ocean" | "monsoon_stall">("warm_ocean");
  const [recoveryDay, setRecoveryDay] = useState(3);
  const [memResult, setMemResult] = useState<MemoryResult | null>(null);

  const handleRunReverse = () => task("Running Atmospheric Reverse Simulator", async () => {
    if (!win) return;
    const res = await runReverse(win, revRegion, revDay, revCh, revDir);
    setRevResult(res);
  });

  const handleRunMemory = () => task("Simulating Memory & Recovery Lab", async () => {
    if (!win) return;
    const delta = presetShock(memShock, win.init_states[2]);
    const res = await runMemory(win, delta, recoveryDay, 10, 1.0);
    setMemResult(res);
  });

  const revMaps = (() => {
    if (!revResult) return [];
    const best = revResult.best_candidate;
    const b = revResult.baseline_rollout[revDay - 1][revCh].map((r) => r.map((v) => display(v, revCh)));
    const s = best.rollout[revDay - 1][revCh].map((r) => r.map((v) => display(v, revCh)));
    const flat = [b, s].flat(2);
    const range: [number, number] = [Math.min(...flat), Math.max(...flat)];
    return [
      { title: `Baseline Day +${revDay}`, grid: b, range, diverging: false },
      { title: `Inverted Target Scenario Day +${revDay}`, grid: s, range, diverging: false },
    ];
  })();

  const memSeries: Series[] = memResult
    ? [
        {
          name: "Shocked Disturbance Energy",
          values: memResult.shocked_curve.map((r) => r.energy),
          color: "#ea580c",
        },
        {
          name: "Compensated Recovery Energy",
          values: memResult.compensated_curve.map((r) => r.energy),
          color: "#0284c7",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* SECTION 1: Reverse Simulator ("What Would It Take?") */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between border-b pb-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Atmospheric Reverse Simulator ("What Would It Take?")
            </h2>
            <p className="text-xs text-slate-500">
              Inverse scenario exploration: identify bounded initial atmospheric perturbations that could achieve a specified regional outcome.
            </p>
          </div>
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
            INVERSE MODEL EXPLORATION
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Target Region:</label>
            <select
              className={input}
              value={revRegion}
              onChange={(e) => setRevRegion(e.target.value as RegionId)}
            >
              {Object.entries(REGIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Target Variable:</label>
            <select
              className={input}
              value={revCh}
              onChange={(e) => setRevCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Goal Direction:</label>
            <select
              className={input}
              value={revDir}
              onChange={(e) => setRevDir(e.target.value as any)}
            >
              <option value="increase">Increase (+) Rainfall/Value</option>
              <option value="decrease">Decrease (−) Rainfall/Value</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Horizon Day:</label>
            <select
              className={input}
              value={revDay}
              onChange={(e) => setRevDay(+e.target.value)}
            >
              {[3, 4, 5, 6, 8].map((d) => (
                <option key={d} value={d}>Day +{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <button
            className={btnPrimary}
            disabled={!win || !!busy}
            onClick={handleRunReverse}
          >
            Solve Optimal Shock Candidate
          </button>
          {revResult && (
            <span className="text-xs text-slate-500">
              Evaluated {revResult.evaluations} candidate shocks in {revResult.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {revResult && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-indigo-50/70 p-4 text-xs text-indigo-950">
              <div className="font-bold">
                Optimal Initial Shock Found: {CHANNELS[revResult.best_candidate.channel].label} amplitude of{" "}
                {revResult.best_candidate.amplitude > 0 ? "+" : ""}
                {revResult.best_candidate.amplitude.toFixed(2)} {CHANNELS[revResult.best_candidate.channel].unit} at [
                {revResult.best_candidate.lat}°N, {revResult.best_candidate.lon}°E]
              </div>
              <div className="mt-1">
                Regional mean in {REGIONS[revRegion].name} shifted from{" "}
                <strong>{revResult.baseline_mean.toFixed(2)}</strong> to{" "}
                <strong>{revResult.best_candidate.achieved_mean.toFixed(2)}</strong> {CHANNELS[revCh].unit} (Δ{" "}
                {revResult.best_candidate.delta > 0 ? "+" : ""}
                {revResult.best_candidate.delta.toFixed(2)}).
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {revMaps.map((m) => (
                <GridMap
                  key={m.title}
                  {...m}
                  unit={CHANNELS[revCh].unit}
                  land={meta?.land_mask || []}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Atmospheric Memory & Recovery Lab */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between border-b pb-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Atmospheric Memory & Recovery Lab
            </h2>
            <p className="text-xs text-slate-500">
              Evaluate persistence and atmospheric memory: test whether an intervening compensation can return the system to baseline trajectory.
            </p>
          </div>
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            HYSTERESIS & RECOVERY DYNAMICS
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Shock Scenario:</label>
            <select
              className={input}
              value={memShock}
              onChange={(e) => setMemShock(e.target.value as any)}
            >
              <option value="warm_ocean">Warm Bay of Bengal (+3K, +15% TCWV)</option>
              <option value="monsoon_stall">Monsoon Stall (Arabian Sea Wind Drag)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Intervention / Recovery Day:</label>
            <select
              className={input}
              value={recoveryDay}
              onChange={(e) => setRecoveryDay(+e.target.value)}
            >
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>Intervene at Day +{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <button
            className={btnPrimary}
            disabled={!win || !!busy}
            onClick={handleRunMemory}
          >
            Simulate 3-Branch Recovery Timeline
          </button>
          {memResult && (
            <span className="text-xs text-slate-500">
              3-branch continuation computed in {memResult.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {memResult && (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold text-slate-700">
                Atmospheric Disturbance Energy Decay
              </h4>
              <LineChart series={memSeries} unit="Normalized Energy" />
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="font-bold text-slate-900">Recovery Diagnosis:</span>
                <p className="mt-1">
                  {memResult.time_to_return_day
                    ? `System returned within tolerance (<5% initial disturbance) by Day +${memResult.time_to_return_day}.`
                    : "Disturbance persists beyond the 10-day forecast horizon (hysteresis observed)."}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="font-bold text-slate-900">Atmospheric Memory Definition:</span>
                <p className="mt-1 text-slate-500">
                  Measures the relaxation timescale of non-linear circulation anomalies back to control climatology after an oceanic thermal or kinematic pulse.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
