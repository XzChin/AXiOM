import { useState } from "react";
import { EnsembleResult, SensResult, Window_, runEnsemble, runSensitivity } from "../api";
import { GridMap } from "./GridMap";
import { CHANNELS, Grid, State, display, maxAbs } from "../utils/science";
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
      { title: `Ensemble Mean (Day +${ensDay}) [${CHANNELS[ensCh].label}]`, grid: meanGrid, range: rangeMean, diverging: false },
      { title: `Ensemble Spread / Uncertainty σ (Day +${ensDay})`, grid: spreadGrid, range: [0, spreadMax] as [number, number], diverging: false },
    ];
  })();

  return (
    <div className="space-y-6">
      {/* SECTION 1: Ensemble Futures */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between border-b pb-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Ensemble Futures & Confidence Engine
            </h2>
            <p className="text-xs text-slate-500">
              Probabilistic ensemble generated via localized initial-condition perturbations.
            </p>
          </div>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            PROXY ENSEMBLE (UNRELIABILITY DISCLOSED)
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Ensemble Members (N):</label>
            <select
              className={input}
              value={members}
              onChange={(e) => setMembers(+e.target.value)}
              disabled={!!busy}
            >
              {[3, 5, 7, 9].map((n) => (
                <option key={n} value={n}>{n} Members</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Perturbation Scale (σ):</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.20"
              className={input}
              value={noise}
              onChange={(e) => setNoise(+e.target.value)}
              disabled={!!busy}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Day:</label>
            <select
              className={input}
              value={ensDay}
              onChange={(e) => setEnsDay(+e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i + 1}>Day +{i + 1}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Variable:</label>
            <select
              className={input}
              value={ensCh}
              onChange={(e) => setEnsCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <button
            className={btnPrimary}
            disabled={!win || !!busy}
            onClick={handleRunEnsemble}
          >
            Generate {members}-Member Ensemble
          </button>
          {ensemble && (
            <span className="text-xs text-slate-500">
              Computed in {ensemble.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {ensMaps.length > 0 && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between border-b pb-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Atmospheric Sensitivity Atlas
            </h2>
            <p className="text-xs text-slate-500">
              Evaluates how regional climate variables respond to cross-basin oceanic and continental anomalies.
            </p>
          </div>
          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
            MODEL SENSITIVITY GRADIENTS
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Target Region:</label>
            <select
              className={input}
              value={sensRegion}
              onChange={(e) => setSensRegion(e.target.value as RegionId)}
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
              value={sensTargetCh}
              onChange={(e) => setSensTargetCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Forecast Lead (Day):</label>
            <select
              className={input}
              value={sensDay}
              onChange={(e) => setSensDay(+e.target.value)}
            >
              {[1, 2, 4, 6, 8].map((d) => (
                <option key={d} value={d}>Day +{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <button
            className={btnPrimary}
            disabled={!win || !!busy}
            onClick={handleRunSensitivity}
          >
            Compute Regional Sensitivity
          </button>
          {sensitivity && (
            <span className="text-xs text-slate-500">
              Computed in {sensitivity.inference_ms.toFixed(0)} ms.
            </span>
          )}
        </div>

        {sensitivity && (
          <div className="mt-4 overflow-x-auto">
            <div className="mb-2 text-xs font-semibold text-slate-700">
              Baseline Value in {REGIONS[sensRegion].name}: {sensitivity.baseline_mean.toFixed(2)} {CHANNELS[sensTargetCh].unit}
            </div>
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2">Perturbation Basin</th>
                  <th className="p-2">Perturbed Variable</th>
                  <th className="p-2">Probe Amplitude</th>
                  <th className="p-2">Target Response Δ</th>
                  <th className="p-2">Absolute Sensitivity Gradient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sensitivity.sensitivities.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2 font-semibold">{s.source_name}</td>
                    <td className="p-2">{CHANNELS[s.channel].label}</td>
                    <td className="p-2">{s.probe_amp} {CHANNELS[s.channel].unit}</td>
                    <td className="p-2 font-semibold">
                      <span className={s.target_delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {s.target_delta > 0 ? "+" : ""}{s.target_delta} {CHANNELS[sensTargetCh].unit}
                      </span>
                    </td>
                    <td className="p-2 font-bold text-sky-800">{s.abs_sensitivity.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
