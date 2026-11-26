import { useState } from "react";
import { MemoryResult, ReverseResult, Window_, runMemory, runReverse } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { CHANNELS, display, presetShock } from "../utils/science";
import { REGIONS, RegionId } from "../utils/india";
import { palette, ui } from "../theme";

interface Props {
  win: Window_ | null;
  meta: any;
  task: (name: string, fn: () => Promise<void>) => Promise<void>;
  busy: string;
}

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
      { title: `Baseline Day +${revDay} [Model]`, grid: b, range, diverging: false },
      { title: `Inverted Target Scenario Day +${revDay} [Model]`, grid: s, range, diverging: false },
    ];
  })();

  const memSeries: Series[] = memResult
    ? [
        {
          name: "Shock Disturbance Energy [Derived]",
          values: memResult.shocked_curve.map((r) => r.energy),
          color: "#E67E22",
        },
        {
          name: "Compensated Recovery Energy [Derived]",
          values: memResult.compensated_curve.map((r) => r.energy),
          color: palette.accent,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* SECTION 1: Reverse Simulator ("What Would It Take?") */}
      <div className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 className={ui.titleMd}>
              Atmospheric Reverse Simulator (&quot;What Would It Take?&quot;)
            </h2>
            <p className={ui.muted}>
              Inverse scenario exploration: identify bounded initial atmospheric perturbations that could achieve a specified regional outcome.
            </p>
          </div>
          <span className={ui.badgeAccent}>
            INVERSE MODEL EXPLORATION
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <label className={ui.label}>Target Region:</label>
            <select
              className={ui.input}
              value={revRegion}
              onChange={(e) => setRevRegion(e.target.value as RegionId)}
            >
              {Object.entries(REGIONS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Target Variable:</label>
            <select
              className={ui.input}
              value={revCh}
              onChange={(e) => setRevCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Goal Direction:</label>
            <select
              className={ui.input}
              value={revDir}
              onChange={(e) => setRevDir(e.target.value as any)}
            >
              <option value="increase">Increase (+) Rainfall/Value</option>
              <option value="decrease">Decrease (−) Rainfall/Value</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Horizon Day:</label>
            <select
              className={ui.input}
              value={revDay}
              onChange={(e) => setRevDay(+e.target.value)}
            >
              {[3, 4, 5, 6, 8].map((d) => (
                <option key={d} value={d}>Day +{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-twilight-border pt-3.5">
          <button
            className={ui.btnAccent}
            disabled={!win || !!busy}
            onClick={handleRunReverse}
          >
            Find Best Evaluated Shock
          </button>
          {revResult && (
            <span className={`${ui.muted} tabular-nums`}>
              Evaluated {revResult.evaluations} candidate shocks in {revResult.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {revResult && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-twilight-border bg-twilight-base p-4 text-xs text-text-main tabular-nums">
              <div className="font-bold text-[#75472F]">
                Optimal Initial Shock Found: {CHANNELS[revResult.best_candidate.channel].label} amplitude of{" "}
                {revResult.best_candidate.amplitude > 0 ? "+" : ""}
                {revResult.best_candidate.amplitude.toFixed(2)} {CHANNELS[revResult.best_candidate.channel].unit} at [
                {revResult.best_candidate.lat}°N, {revResult.best_candidate.lon}°E]
              </div>
              <div className="mt-1 text-text-muted">
                Regional mean in {REGIONS[revRegion].name} shifted from{" "}
                <strong className="text-text-bright">{revResult.baseline_mean.toFixed(2)}</strong> to{" "}
                <strong className="text-[#75472F]">{revResult.best_candidate.achieved_mean.toFixed(2)}</strong> {CHANNELS[revCh].unit} (Δ{" "}
                {revResult.best_candidate.delta > 0 ? "+" : ""}
                {revResult.best_candidate.delta.toFixed(2)}).
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
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
      <div className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 className={ui.titleMd}>
              Atmospheric Memory &amp; Recovery Lab
            </h2>
            <p className={ui.muted}>
              Evaluate persistence and atmospheric memory: test whether an intervening compensation can return the system to baseline trajectory.
            </p>
          </div>
          <span className={ui.badgePrimary}>
            HYSTERESIS &amp; RECOVERY DYNAMICS
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={ui.label}>Shock Scenario:</label>
            <select
              className={ui.input}
              value={memShock}
              onChange={(e) => setMemShock(e.target.value as any)}
            >
              <option value="warm_ocean">Warm Bay of Bengal (+3K, +15% TCWV)</option>
              <option value="monsoon_stall">Monsoon Stall (Arabian Sea Wind Drag)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Intervention / Recovery Day:</label>
            <select
              className={ui.input}
              value={recoveryDay}
              onChange={(e) => setRecoveryDay(+e.target.value)}
            >
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>Intervene at Day +{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-twilight-border pt-3.5">
          <button
            className={ui.btnPrimary}
            disabled={!win || !!busy}
            onClick={handleRunMemory}
          >
            Simulate 3-Branch Recovery Timeline
          </button>
          {memResult && (
            <span className={`${ui.muted} tabular-nums`}>
              3-branch continuation computed in {memResult.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {memResult && (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h4 className={`mb-2.5 ${ui.titleMd}`}>
                Atmospheric Disturbance Energy Decay [Derived]
              </h4>
              <LineChart series={memSeries} unit="Normalized Energy" />
            </div>

            <div className="space-y-3.5 text-xs text-text-main">
              <div className="rounded-xl border border-twilight-border bg-twilight-base p-4">
                <span className="font-bold text-[#75472F]">Recovery Diagnosis:</span>
                <p className="mt-1 leading-relaxed text-text-muted">
                  {memResult.time_to_return_day
                    ? `System returned within tolerance (<5% initial disturbance) by Day +${memResult.time_to_return_day}.`
                    : "Disturbance persists beyond the 10-day forecast horizon (hysteresis observed)."}
                </p>
              </div>
              <div className="rounded-xl border border-twilight-border bg-twilight-base p-4">
                <span className="font-bold text-[#29364A]">Atmospheric Memory Definition:</span>
                <p className="mt-1 leading-relaxed text-text-subtle">
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
