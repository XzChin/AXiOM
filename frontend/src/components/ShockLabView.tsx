import { useState } from "react";
import { CertResult, Meta, Run, Window_, runCertificate, simulate } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { CHANNELS, Grid, State, display, gaussianShock, lat, lon, maxAbs, presetShock, subtract, zeros } from "../utils/science";
import { palette, ui } from "../theme";

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

  const handleRunShock = () => task("Simulating Shock Multiverse Scenario", async () => {
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

  const handleRunCertificate = () => task("Auditing Shock Behaviour Certificate", async () => {
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
    const minDelta = ch === 4 ? 1.0 : 0.5;
    const k = Math.max(maxAbs(d), minDelta);
    const wind = ch === 2 || ch === 3;
    const flat = [b, s].flat(2);
    const m = Math.max(...flat.map(Math.abs));
    const range: [number, number] = wind ? [-m, m] : [Math.min(...flat), Math.max(...flat)];

    return [
      { title: "Control Baseline [Model]", grid: b, range, diverging: wind },
      { title: `Perturbed Scenario: Day +${day} [Model]`, grid: s, range, diverging: wind },
      { title: `Perturbation Delta: Scenario − Base [Derived]`, grid: d, range: [-k, k] as [number, number], diverging: true },
    ];
  })();

  // Butterfly Effect Domino Tracker: calculate spread across the 10 days
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

  const dominoSeries: Series[] = butterflyMetrics
    ? [
        { name: "Perturbation Energy [Derived]", values: butterflyMetrics.map((r) => r.energy), color: palette.accent },
        { name: "Affected Domain Area (%) [Derived]", values: butterflyMetrics.map((r) => r.coverageFrac), color: "#5F93B5" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Shock Controls: Located right above the comparison maps */}
      <div className={`${ui.cardRaised} border-l-4 border-l-teal-400`}>
        <div className={ui.cardHeader}>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <h2 className={ui.titleLg}>Multiverse Scenario Lab &amp; Perturbation Engine</h2>
            </div>
            <p className={ui.muted}>
              Apply bounded climate anomalies to Day-0 initial atmosphere and trace non-linear downstream cascades.
            </p>
          </div>
          <span className={ui.badgeAccent}>
            OFFLINE CPU SIMULATION
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className={ui.label}>Shock Archetype:</label>
            <select
              className={ui.input}
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              disabled={!!busy}
            >
              <option value="warm_ocean">Warm Bay of Bengal (+3K SST, +15% TCWV)</option>
              <option value="monsoon_stall">Monsoon Stall (Arabian Sea Wind Drag -40%)</option>
              <option value="zero">Zero / Null Shock (Exact Identity Test)</option>
              <option value="custom">Custom Gaussian Anomaly</option>
            </select>
          </div>

          {kind === "custom" ? (
            <>
              <div className="space-y-1">
                <label className={ui.label}>Target Channel:</label>
                <select
                  className={ui.input}
                  value={g.ch}
                  onChange={(e) => setG({ ...g, ch: +e.target.value })}
                >
                  {CHANNELS.map((c, i) => (
                    <option key={c.id} value={i}>{c.label} ({c.id})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={ui.label}>Center Coordinates [Lat, Lon]:</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    className={ui.input}
                    placeholder="Lat"
                    value={g.lat}
                    onChange={(e) => setG({ ...g, lat: +e.target.value })}
                  />
                  <input
                    type="number"
                    className={ui.input}
                    placeholder="Lon"
                    value={g.lon}
                    onChange={(e) => setG({ ...g, lon: +e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className={ui.label}>Radius (deg) &amp; Amplitude:</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    className={ui.input}
                    placeholder="Radius"
                    value={g.radius}
                    onChange={(e) => setG({ ...g, radius: +e.target.value })}
                  />
                  <input
                    type="number"
                    className={ui.input}
                    placeholder="Amp"
                    value={g.amp}
                    onChange={(e) => setG({ ...g, amp: +e.target.value })}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="col-span-3 flex items-center justify-between rounded-xl border border-twilight-border bg-twilight-base/80 p-3.5 text-xs text-text-main">
              {kind === "warm_ocean" && (
                <span>Perturbs +3.0 K temperature anomaly and +15% precipitable water vapour in Bay of Bengal box [8–20°N, 82–94°E].</span>
              )}
              {kind === "monsoon_stall" && (
                <span>Perturbs -40% u-wind and -40% v-wind deceleration drag in Arabian Sea box [8–20°N, 65–75°E].</span>
              )}
              {kind === "zero" && (
                <span>Zero perturbation array. Verifies that running with null shock produces bitwise identical rollout to baseline.</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-twilight-border pt-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              className={ui.btnAccent}
              disabled={!win || !base || !!busy}
              onClick={handleRunShock}
            >
              Simulate Shock Rollout
            </button>
            <button
              className={ui.btnSecondary}
              disabled={!shocked || !!busy}
              onClick={handleRunCertificate}
            >
              Run 8-Check Behaviour Certificate
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-text-muted">Display Channel:</span>
            <select
              className={ui.selectInline}
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

      {/* Tri-Panel Comparison Grid: Baseline vs Scenario vs Difference */}
      {base && shocked ? (
        <div className={ui.card}>
          <div className={ui.cardHeader}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={ui.titleSm}>Lead Day:</span>
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setDay(i + 1)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold tabular-nums transition ${
                    day === i + 1 ? "bg-teal-500 text-steel-900 shadow-sm" : "bg-twilight-base text-text-main hover:bg-twilight-hover"
                  }`}
                >
                  +{i + 1}
                </button>
              ))}
            </div>
            <span className={ui.badgeAccent}>
              Active Scenario: {shocked.label}
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
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
        <div className={`${ui.card} py-16 text-center text-sm text-text-muted`}>
          Click <strong>Simulate Shock Rollout</strong> above to view side-by-side Baseline, Shocked Scenario, and Anomaly Difference maps.
        </div>
      )}

      {/* Domino Dynamics & Cascade Table */}
      {butterflyMetrics && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={ui.card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className={ui.titleMd}>
                Perturbation Domino Dynamics [Derived]
              </h3>
              <span className={ui.badgePrimary}>
                CASCADE EVOLUTION
              </span>
            </div>
            <LineChart series={dominoSeries} unit="Score / %" />
          </div>

          <div className={ui.card}>
            <h3 className={`mb-3 ${ui.titleMd}`}>Monsoon Domino Cascade Metrics [Derived]</h3>
            <div className={`${ui.tableWrap} max-h-64 overflow-y-auto`}>
              <table className={ui.table}>
                <thead className={`${ui.thead} sticky top-0`}>
                  <tr>
                    <th className="p-3">Lead</th>
                    <th className="p-3">Anomaly Energy</th>
                    <th className="p-3">Max |Δ|/σ</th>
                    <th className="p-3">Affected Grid Cells</th>
                    <th className="p-3">Effective Radius</th>
                  </tr>
                </thead>
                <tbody className={ui.tbody}>
                  {butterflyMetrics.map((row) => (
                    <tr key={row.day} className={day === row.day ? "bg-steel-600/30 font-semibold text-teal-300" : "hover:bg-twilight-hover/40"}>
                      <td className="p-3">Day +{row.day}</td>
                      <td className="p-3">{row.energy.toFixed(2)}</td>
                      <td className="p-3">{row.maxZ.toFixed(2)} σ</td>
                      <td className="p-3">{row.affectedCells} ({row.coverageFrac.toFixed(1)}%)</td>
                      <td className="p-3">{row.meanRadius.toFixed(1)}° lat/lon</td>
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
        <div className="rounded-2xl border border-teal-500/50 bg-teal-950/20 p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-twilight-border pb-3.5">
            <div>
              <h3 className={ui.titleMd}>
                Shock Behaviour Certificate (8-Check Protocol)
              </h3>
              <p className="text-xs text-text-muted">
                Mathematical audit verifying locality, zero identity, boundedness, physical plausibility, and determinism.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
              cert.passed_count === cert.total_checks
                ? "bg-teal-500 text-steel-950"
                : "bg-amber-500 text-steel-950"
            }`}>
              {cert.passed_count} / {cert.total_checks} CHECKS PASSED
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {cert.checks.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-xl border border-twilight-border bg-twilight-surface p-3.5 shadow-sm"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                        c.passed ? "bg-teal-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-xs font-bold text-text-bright">{c.name}</span>
                  </div>
                  <span className="mt-1 block text-xs text-text-muted tabular-nums">{c.detail}</span>
                </div>
                <span
                  className={c.passed ? ui.badgeAccent : ui.badgeWarning}
                >
                  {c.passed ? "PASS" : "FAIL"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3.5 text-xs font-medium text-text-muted tabular-nums">
            Audit verified via live inference in {cert.inference_ms.toFixed(0)} ms.
          </div>
        </div>
      )}
    </div>
  );
}
