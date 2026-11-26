import { useState } from "react";
import { CertResult, Meta, Run, Window_, runCertificate, simulate } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { CHANNELS, Grid, State, display, gaussianShock, lat, lon, maxAbs, presetShock, subtract, zeros } from "../utils/science";

interface Props {
  meta: Meta | null;
  win: Window_ | null;
  base: Run | null;
  shocked: { run: Run; delta: State; label: string } | null;
  setShocked: (s: { run: Run; delta: State; label: string } | null) => void;
  day: number;
  setDay: (d: number) => void;
  cell: [number, number];
  setCell: (c: [number, number]) => void;
  task: (name: string, fn: () => Promise<void>) => Promise<void>;
  busy: string;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const btnPrimary = "rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-40 transition";
const btnSecondary = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition";
const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 shadow-sm";

export function ShockLabView({
  meta, win, base, shocked, setShocked, day, setDay, cell, setCell, task, busy,
}: Props) {
  const [kind, setKind] = useState<"warm_ocean" | "monsoon_stall" | "zero" | "custom">("warm_ocean");
  const [ch, setCh] = useState(1); // default to rainfall
  const [g, setG] = useState({ ch: 0, lat: 15, lon: 88, radius: 3, amp: 2.5 });
  const [cert, setCert] = useState<CertResult | null>(null);

  const makeDelta = (): State => {
    if (kind === "zero") return zeros();
    if (kind === "custom") return gaussianShock(g.ch, g.lat, g.lon, g.radius, g.amp);
    return presetShock(kind, win!.init_states[2]);
  };

  const handleRunShock = () => task("Simulating Shock Multiverse", async () => {
    if (!win) return;
    const delta = makeDelta();
    setCert(null);
    const label =
      kind === "zero"
        ? "Zero / Null Shock"
        : kind === "custom"
        ? `Custom: ${CHANNELS[g.ch].id} +${g.amp} at [${g.lat}°N, ${g.lon}°E]`
        : kind === "warm_ocean"
        ? "Warm Bay of Bengal (+3K SST, +15% TCWV)"
        : "Monsoon Stall (Arabian Sea Wind Drag -40%)";
    const res = await simulate(win, delta);
    setShocked({ run: res, delta, label });
  });

  const handleRunCertificate = () => task("Certifying Shock Behaviour", async () => {
    if (!win || !shocked) return;
    const certRes = await runCertificate(win, shocked.delta);
    setCert(certRes);
  });

  const unit = CHANNELS[ch].unit;
  const shown = (s: State): Grid => s[ch].map((r) => r.map((v) => display(v, ch)));

  const maps = (() => {
    if (!base || !shocked) return [];
    const b = shown(base.rollout[day - 1]);
    const s = shown(shocked.run.rollout[day - 1]);
    const d = subtract(s, b);
    const k = maxAbs(d) || 1;
    const wind = ch === 2 || ch === 3;
    const flat = [b, s].flat(2);
    const m = Math.max(...flat.map(Math.abs));
    const range: [number, number] = wind ? [-m, m] : [Math.min(...flat), Math.max(...flat)];

    return [
      { title: "Control Baseline (MODEL)", grid: b, range, diverging: wind },
      { title: `Shocked State: Day +${day} (MODEL)`, grid: s, range, diverging: wind },
      { title: `Perturbation Delta: Shock − Base (DERIVED)`, grid: d, range: [-k, k] as [number, number], diverging: true },
    ];
  })();

  // Butterfly Effect & Domino Tracker: calculate spread across the 10 days
  const butterflyMetrics = (() => {
    if (!base || !shocked) return null;
    const rows = [];
    const stds = meta?.stats?.std || [2.0, 10.0, 3.0, 3.0, 400.0, 10.0];

    for (let d = 0; d < 10; d++) {
      let totalEnergy = 0;
      let maxZ = 0;
      let affectedCells = 0;
      let sumDist = 0;

      for (let i = 0; i < 32; i++) {
        for (let j = 0; j < 36; j++) {
          let cellEnergy = 0;
          for (let c = 0; c < 6; c++) {
            const diff = shocked.run.rollout[d][c][i][j] - base.rollout[d][c][i][j];
            const z = Math.abs(diff / (stds[c] || 1.0));
            if (z > maxZ) maxZ = z;
            cellEnergy += z * z;
          }
          if (cellEnergy > 0.05) {
            affectedCells++;
            totalEnergy += cellEnergy;
            // distance from center of shock if known
            const dist = Math.hypot(lat(i) - (kind === "custom" ? g.lat : 14), lon(j) - (kind === "custom" ? g.lon : 88));
            sumDist += dist * cellEnergy;
          }
        }
      }

      const meanRadius = totalEnergy > 0 ? sumDist / totalEnergy : 0;
      const coverageFrac = (affectedCells / (32 * 36)) * 100;

      rows.push({
        day: d + 1,
        energy: totalEnergy,
        maxZ,
        affectedCells,
        coverageFrac,
        meanRadius,
      });
    }
    return rows;
  })();

  // Butterfly Series for LineChart
  const dominoSeries: Series[] = butterflyMetrics
    ? [
        { name: "Atmospheric Perturbation Energy", values: butterflyMetrics.map((r) => r.energy), color: "#ea580c" },
        { name: "Domain Affected Area (%)", values: butterflyMetrics.map((r) => r.coverageFrac), color: "#8b5cf6" },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Shock Configuration Controls */}
      <div className={card}>
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <div>
            <h2 className="text-base font-bold text-slate-800">Multiverse Shock Lab & Perturbation Engine</h2>
            <p className="text-xs text-slate-500">
              Inject localized climate shocks into Day-0 atmosphere and simulate downstream domino cascades.
            </p>
          </div>
          <span className="rounded bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
            OFFLINE CPU SIMULATION
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Shock Archetype:</label>
            <select
              className={input}
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              disabled={!!busy}
            >
              <option value="warm_ocean">Warm Bay of Bengal (+3K SST, +15% TCWV)</option>
              <option value="monsoon_stall">Monsoon Stall (Arabian Sea Wind Drag -40%)</option>
              <option value="zero">Zero / Null Shock (Exact Identity Test)</option>
              <option value="custom">Custom Gaussian Perturbation</option>
            </select>
          </div>

          {kind === "custom" ? (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Target Channel:</label>
                <select
                  className={input}
                  value={g.ch}
                  onChange={(e) => setG({ ...g, ch: +e.target.value })}
                >
                  {CHANNELS.map((c, i) => (
                    <option key={c.id} value={i}>{c.label} ({c.id})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Location [Lat, Lon]:</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    className={input}
                    placeholder="Lat"
                    value={g.lat}
                    onChange={(e) => setG({ ...g, lat: +e.target.value })}
                  />
                  <input
                    type="number"
                    className={input}
                    placeholder="Lon"
                    value={g.lon}
                    onChange={(e) => setG({ ...g, lon: +e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Radius (deg) & Amp:</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    className={input}
                    placeholder="Radius"
                    value={g.radius}
                    onChange={(e) => setG({ ...g, radius: +e.target.value })}
                  />
                  <input
                    type="number"
                    className={input}
                    placeholder="Amplitude"
                    value={g.amp}
                    onChange={(e) => setG({ ...g, amp: +e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-3 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {kind === "warm_ocean" && (
                <span>Perturbs +3.0 K temperature and +15% precipitable water vapour in Bay of Bengal [8–20°N, 82–94°E].</span>
              )}
              {kind === "monsoon_stall" && (
                <span>Perturbs -40% u-wind and -40% v-wind deceleration in Arabian Sea [8–20°N, 65–75°E].</span>
              )}
              {kind === "zero" && (
                <span>Zero perturbation array. Verifies that running with zero perturbation exactly replicates baseline forecast.</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <button
              className={btnPrimary}
              disabled={!win || !base || !!busy}
              onClick={handleRunShock}
            >
              Simulate Shock Rollout
            </button>
            <button
              className={btnSecondary}
              disabled={!shocked || !!busy}
              onClick={handleRunCertificate}
            >
              Run 8-Check Behaviour Certificate
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Display Variable:</span>
            <select
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 shadow-sm"
              value={ch}
              onChange={(e) => setCh(+e.target.value)}
            >
              {CHANNELS.map((c, i) => (
                <option key={c.id} value={i}>{c.label} ({c.unit})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tri-Panel Grid Map: Base vs Shocked vs Delta */}
      {base && shocked ? (
        <div className={card}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <div className="flex items-center gap-1">
              <span className="mr-2 text-xs font-bold text-slate-600">Day:</span>
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setDay(i + 1)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    day === i + 1 ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  +{i + 1}
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold text-orange-700">
              Multiverse Scenario: {shocked.label}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {maps.map((m) => (
              <GridMap
                key={m.title}
                {...m}
                unit={unit}
                land={meta?.land_mask || []}
                cell={cell}
                onCell={setCell}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={`${card} text-center text-sm text-slate-500`}>
          Simulate a shock above to view side-by-side Base / Shocked / Delta spatial comparison.
        </div>
      )}

      {/* Atmospheric Butterfly Effect & Monsoon Domino Tracker */}
      {butterflyMetrics && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className={card}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">
                Atmospheric Butterfly Effect — Perturbation Growth
              </h3>
              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                DOMINO DYNAMICS
              </span>
            </div>
            <LineChart series={dominoSeries} unit="Score / %" />
          </div>

          <div className={card}>
            <h3 className="mb-2 font-bold text-slate-800">Monsoon Domino Cascade Table</h3>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-2">Lead</th>
                    <th className="p-2">Perturbation Energy</th>
                    <th className="p-2">Max |Δ|/σ</th>
                    <th className="p-2">Affected Cells</th>
                    <th className="p-2">Dispersion Radius</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {butterflyMetrics.map((row) => (
                    <tr key={row.day} className={day === row.day ? "bg-sky-50 font-semibold" : "hover:bg-slate-50"}>
                      <td className="p-2">Day +{row.day}</td>
                      <td className="p-2">{row.energy.toFixed(2)}</td>
                      <td className="p-2">{row.maxZ.toFixed(2)} σ</td>
                      <td className="p-2">{row.affectedCells} ({row.coverageFrac.toFixed(1)}%)</td>
                      <td className="p-2">{row.meanRadius.toFixed(1)}° lat/lon</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Shock Behaviour Certificate Panel */}
      {cert && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
            <div>
              <h3 className="font-bold text-indigo-950">
                Shock Behaviour Certificate (8-Check Protocol)
              </h3>
              <p className="text-xs text-indigo-700">
                Rigorous mathematical audit verifying locality, zero identity, boundedness, physical plausibility, and determinism.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              cert.passed_count === cert.total_checks
                ? "bg-emerald-600 text-white"
                : "bg-amber-600 text-white"
            }`}>
              {cert.passed_count} / {cert.total_checks} CHECKS PASSED
            </span>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {cert.checks.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-lg bg-white/90 p-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        c.passed ? "bg-emerald-600" : "bg-rose-500"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-800">{c.name}</span>
                  </div>
                  <span className="mt-1 block text-xs text-slate-500">{c.detail}</span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${
                    c.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {c.passed ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-indigo-800">
            Audit executed via live backend inference in {cert.inference_ms.toFixed(0)} ms.
          </div>
        </div>
      )}
    </div>
  );
}
