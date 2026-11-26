import { useState } from "react";
import { EnsembleResult, SensResult, Window_, runEnsemble, runSensitivity } from "../api";
import { GridMap } from "./GridMap";
import { CHANNELS, Grid, State, display, maxAbs } from "../utils/science";
import { REGIONS, RegionId } from "../utils/india";
import { ui } from "../theme";

interface Props {
  win: Window_ | null;
  meta: any;
  task: (name: string, fn: () => Promise<void>) => Promise<void>;
  busy: string;
}

export function EnsembleSensitivityView({ win, meta, task, busy }: Props) {
  // Ensemble state
  const [members, setMembers] = useState(5);
  const [noise, setNoise] = useState(0.05);
  const [ensDay, setEnsDay] = useState(4);
  const [ensCh, setEnsCh] = useState(1);
  const [ensemble, setEnsemble] = useState<EnsembleResult | null>(null);

  // Sensitivity state
  const [sensRegion, setSensRegion] = useState<RegionId>("central_monsoon");
  const [sensTargetCh, setSensTargetCh] = useState(1);
  const [sensDay, setSensDay] = useState(4);
  const [sensitivity, setSensitivity] = useState<SensResult | null>(null);

  const handleRunEnsemble = () => task("Generating Initial-Condition Ensemble", async () => {
    if (!win) return;
    const res = await runEnsemble(win, 10, members, noise);
    setEnsemble(res);
  });

  const handleRunSensitivity = () => task("Computing Regional Sensitivity Atlas", async () => {
    if (!win) return;
    const res = await runSensitivity(win, sensTargetCh, sensDay, sensRegion);
    setSensitivity(res);
  });

  const unit = CHANNELS[ensCh].unit;
  const shown = (s: State): Grid => s[ensCh].map((r) => r.map((v) => display(v, ensCh)));

  const ensMaps = (() => {
    if (!ensemble) return [];
    const meanGrid = shown(ensemble.mean[ensDay - 1]);
    const spreadGrid = ensemble.spread[ensDay - 1][ensCh].map((r) => r.map((v) => v * CHANNELS[ensCh].scale));
    const flat = meanGrid.flat();
    const rangeMean: [number, number] = [Math.min(...flat), Math.max(...flat)];
    const spreadMax = maxAbs(spreadGrid) || 1;
    return [
      { title: `Ensemble Mean (Day +${ensDay}) [${CHANNELS[ensCh].label}] [Derived]`, grid: meanGrid, range: rangeMean, diverging: false },
      { title: `Ensemble Spread / Uncertainty σ (Day +${ensDay}) [Derived]`, grid: spreadGrid, range: [0, spreadMax] as [number, number], diverging: false },
    ];
  })();

  return (
    <div className="space-y-6">
      {/* SECTION 1: Ensemble Futures */}
      <div className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 className={ui.titleMd}>
              Ensemble Futures &amp; Confidence Engine
            </h2>
            <p className={ui.muted}>
              Probabilistic spread simulated via bounded initial-condition perturbations.
            </p>
          </div>
          <span className={ui.badgeAccent}>
            PROXY ENSEMBLE (UNRELIABILITY DISCLOSED)
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1">
            <label className={ui.label}>Ensemble Members (N):</label>
            <select
              className={ui.input}
              value={members}
              onChange={(e) => setMembers(+e.target.value)}
              disabled={!!busy}
            >
              {[3, 5, 7, 9].map((n) => (
                <option key={n} value={n}>{n} Members</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Perturbation Scale (σ):</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.20"
              className={ui.input}
              value={noise}
              onChange={(e) => setNoise(+e.target.value)}
              disabled={!!busy}
            />
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Day:</label>
            <select
              className={ui.input}
              value={ensDay}
              onChange={(e) => setEnsDay(+e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>Day +{i + 1}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Variable:</label>
            <select
              className={ui.input}
              value={ensCh}
              onChange={(e) => setEnsCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-twilight-border pt-3.5">
          <button
            className={ui.btnAccent}
            disabled={!win || !!busy}
            onClick={handleRunEnsemble}
          >
            Generate {members}-Member Ensemble
          </button>
          {ensemble && (
            <span className={`${ui.muted} tabular-nums`}>
              Computed {members} rollouts in {ensemble.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {ensMaps.length > 0 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {ensMaps.map((m) => (
              <GridMap
                key={m.title}
                {...m}
                unit={unit}
                land={meta?.land_mask || []}
              />
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Sensitivity Atlas */}
      <div className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 className={ui.titleMd}>
              Atmospheric Sensitivity Atlas
            </h2>
            <p className={ui.muted}>
              Evaluates how regional climate variables respond to cross-basin oceanic and continental anomalies.
            </p>
          </div>
          <span className={ui.badgePrimary}>
            MODEL SENSITIVITY GRADIENTS
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className={ui.label}>Target Region:</label>
            <select
              className={ui.input}
              value={sensRegion}
              onChange={(e) => setSensRegion(e.target.value as RegionId)}
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
              value={sensTargetCh}
              onChange={(e) => setSensTargetCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={ui.label}>Forecast Lead (Day):</label>
            <select
              className={ui.input}
              value={sensDay}
              onChange={(e) => setSensDay(+e.target.value)}
            >
              {[1, 2, 4, 6, 8].map((d) => (
                <option key={d} value={d}>Day +{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-twilight-border pt-3.5">
          <button
            className={ui.btnPrimary}
            disabled={!win || !!busy}
            onClick={handleRunSensitivity}
          >
            Compute Regional Sensitivity
          </button>
          {sensitivity && (
            <span className={`${ui.muted} tabular-nums`}>
              Computed 16 perturbation probes in {sensitivity.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {sensitivity && (
          <div className="mt-5 space-y-3">
            <div className="text-xs font-semibold text-text-bright tabular-nums">
              Baseline Mean in {REGIONS[sensRegion].name}: {sensitivity.baseline_mean.toFixed(2)} {CHANNELS[sensTargetCh].unit}
            </div>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead className={ui.thead}>
                  <tr>
                    <th className="p-3">Perturbation Basin</th>
                    <th className="p-3">Perturbed Variable</th>
                    <th className="p-3">Probe Amplitude</th>
                    <th className="p-3">Target Response Δ</th>
                    <th className="p-3">Absolute Sensitivity Gradient</th>
                  </tr>
                </thead>
                <tbody className={ui.tbody}>
                  {sensitivity.sensitivities.map((s, idx) => (
                    <tr key={idx} className="hover:bg-twilight-hover/40 transition-colors">
                      <td className="p-3 font-semibold text-text-bright">{s.source_name}</td>
                      <td className="p-3 text-text-main">{CHANNELS[s.channel].label}</td>
                      <td className="p-3 text-text-main">{s.probe_amp} {CHANNELS[s.channel].unit}</td>
                      <td className="p-3 font-semibold">
                        <span className={s.target_delta >= 0 ? "text-teal-300" : "text-amber-300"}>
                          {s.target_delta > 0 ? "+" : ""}{s.target_delta} {CHANNELS[sensTargetCh].unit}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-teal-300">{s.abs_sensitivity.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
