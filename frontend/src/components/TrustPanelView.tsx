import { Meta } from "../api";
import { ui } from "../theme";

interface Props {
  meta: Meta | null;
  serverStatus: { status: "checking" | "online" | "offline"; modelName?: string; error?: string };
}

export function TrustPanelView({ meta, serverStatus }: Props) {
  const evalVal = meta?.eval_val as any;
  const evalTest = meta?.eval_test as any;

  return (
    <div className="space-y-6">
      {/* Live Server Connection & System Metadata */}
      <div className={ui.cardRaised}>
        <div className={ui.cardHeader}>
          <div>
            <h2 className={ui.titleLg}>
              Model &amp; Trust Center
            </h2>
            <p className={ui.muted}>
              Real connection status, schema-driven evaluation metrics from offline test benchmarks, and physical limitations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                serverStatus.status === "online"
                  ? "bg-teal-500/20 border border-teal-400 text-teal-300"
                  : serverStatus.status === "checking"
                  ? "bg-steel-600/30 border border-steel-400 text-steel-200"
                  : "bg-red-500/20 border border-red-400 text-red-300"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  serverStatus.status === "online"
                    ? "bg-teal-400 animate-pulse"
                    : serverStatus.status === "checking"
                    ? "bg-steel-300 animate-spin"
                    : "bg-red-400"
                }`}
              />
              {serverStatus.status === "online"
                ? `Model Online: ${serverStatus.modelName || "MonsoonNet-lite"}`
                : serverStatus.status === "checking"
                ? "Checking Model Connection…"
                : "Model Server Offline (Port 8000)"}
            </span>
          </div>
        </div>

        {/* Runtime Capability Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-twilight-border bg-twilight-base p-4 text-text-main tabular-nums">
            <span className="block text-xs font-bold uppercase tracking-wider text-teal-400">Architecture</span>
            <span className="mt-1 block text-base font-bold text-text-bright">
              {String((meta?.model_info as any)?.model_name || "MonsoonNet-lite NumPy")}
            </span>
            <p className="mt-1 text-xs text-text-muted">
              {String((meta?.model_info as any)?.architecture || "2-layer residual MLP, 5×5 receptive field")}
            </p>
          </div>

          <div className="rounded-xl border border-twilight-border bg-twilight-base p-4 text-text-main tabular-nums">
            <span className="block text-xs font-bold uppercase tracking-wider text-teal-400">Grid Resolution</span>
            <span className="mt-1 block text-base font-bold text-text-bright">
              32 × 36 (1° Subcontinent Grid)
            </span>
            <p className="mt-1 text-xs text-text-muted">
              Covers 6.5–37.5°N, 65.5–100.5°E (All-India, Arabian Sea &amp; Bay of Bengal)
            </p>
          </div>

          <div className="rounded-xl border border-twilight-border bg-twilight-base p-4 text-text-main tabular-nums">
            <span className="block text-xs font-bold uppercase tracking-wider text-teal-400">Data Environment</span>
            <span className="mt-1 block text-base font-bold text-text-bright">
              {meta?.has_data ? `${meta.days} Daily Records Mounted` : "Synthetic Mode Active"}
            </span>
            <p className="mt-1 text-xs text-text-muted">
              {meta?.has_data
                ? `Historical ERA5 archive mounted starting ${meta.first_date}`
                : "Using competition climate archetypes and custom window JSON upload"}
            </p>
          </div>
        </div>
      </div>

      {/* Held-Out Validation & Test Evaluation Tables from Benchmark JSON */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Validation Set */}
        <div className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h3 className={ui.titleMd}>
                Validation Benchmark ({evalVal?.years ? evalVal.years.join("–") : "2018–2019"})
              </h3>
              <p className={ui.muted}>Evaluated across {evalVal?.windows ?? "—"} held-out windows</p>
            </div>
            <span className={ui.badgeNeutral}>
              Invalid Windows: {evalVal?.invalid_windows ?? 0}
            </span>
          </div>

          {evalVal ? (
            <div className="space-y-3 text-xs tabular-nums">
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Mean Window Skill Score:</span>
                <span className="font-bold text-teal-300">
                  {typeof evalVal.mean_window_skill === "number" ? evalVal.mean_window_skill.toFixed(4) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Heavy-Rain CSI (Day 1 / 4 / 8):</span>
                <span className="font-bold text-text-bright">
                  {evalVal.by_lead?.day1?.csi?.model?.toFixed(3) ?? "—"} /{" "}
                  {evalVal.by_lead?.day4?.csi?.model?.toFixed(3) ?? "—"} /{" "}
                  {evalVal.by_lead?.day8?.csi?.model?.toFixed(3) ?? "—"}
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Day-8 Rainfall Variance Ratio (Anti-Blur):</span>
                <span className="font-bold text-teal-300">
                  {Array.isArray(evalVal.day8_variance_ratio) ? evalVal.day8_variance_ratio[1]?.toFixed(3) : "—"} (Target: ≥ 0.40)
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Anti-Blur Points Awarded:</span>
                <span className="font-bold text-text-bright">
                  {typeof evalVal.anti_blur_points === "number" ? `${evalVal.anti_blur_points.toFixed(2)} / 10 pts` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Causality Mean Score:</span>
                <span className="font-bold text-text-bright">
                  {typeof evalVal.causality_mean_points_of_15 === "number" ? `${evalVal.causality_mean_points_of_15.toFixed(2)} / 15 pts` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-muted">Null Shock Bitwise Identity:</span>
                <span className={`font-bold ${evalVal.null_all_ok ? "text-teal-300" : "text-amber-300"}`}>
                  {evalVal.null_all_ok ? "Verified (Exact Bitwise Match)" : "Identity Check Failed"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Validation evaluation statistics loaded from repository schema.</p>
          )}
        </div>

        {/* Test Set */}
        <div className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h3 className={ui.titleMd}>
                Test Benchmark ({evalTest?.years ? evalTest.years.join("–") : "2020–2021"})
              </h3>
              <p className={ui.muted}>Evaluated across {evalTest?.windows ?? "—"} held-out windows</p>
            </div>
            <span className={ui.badgeNeutral}>
              Invalid Windows: {evalTest?.invalid_windows ?? 0}
            </span>
          </div>

          {evalTest ? (
            <div className="space-y-3 text-xs tabular-nums">
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Mean Window Skill Score:</span>
                <span className="font-bold text-teal-300">
                  {typeof evalTest.mean_window_skill === "number" ? evalTest.mean_window_skill.toFixed(4) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Heavy-Rain CSI (Day 1 / 4 / 8):</span>
                <span className="font-bold text-text-bright">
                  {evalTest.by_lead?.day1?.csi?.model?.toFixed(3) ?? "—"} /{" "}
                  {evalTest.by_lead?.day4?.csi?.model?.toFixed(3) ?? "—"} /{" "}
                  {evalTest.by_lead?.day8?.csi?.model?.toFixed(3) ?? "—"}
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Day-8 Rainfall Variance Ratio (Anti-Blur):</span>
                <span className="font-bold text-teal-300">
                  {Array.isArray(evalTest.day8_variance_ratio) ? evalTest.day8_variance_ratio[1]?.toFixed(3) : "—"} (Target: ≥ 0.40)
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Anti-Blur Points Awarded:</span>
                <span className="font-bold text-text-bright">
                  {typeof evalTest.anti_blur_points === "number" ? `${evalTest.anti_blur_points.toFixed(2)} / 10 pts` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between border-b border-twilight-border/80 py-1.5">
                <span className="text-text-muted">Causality Mean Score:</span>
                <span className="font-bold text-text-bright">
                  {typeof evalTest.causality_mean_points_of_15 === "number" ? `${evalTest.causality_mean_points_of_15.toFixed(2)} / 15 pts` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-muted">Null Shock Bitwise Identity:</span>
                <span className={`font-bold ${evalTest.null_all_ok ? "text-teal-300" : "text-amber-300"}`}>
                  {evalTest.null_all_ok ? "Verified (Exact Bitwise Match)" : "Identity Check Failed"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted">Test evaluation statistics loaded from repository schema.</p>
          )}
        </div>
      </div>

      {/* Architecture & Locality Safeguards */}
      <div className={ui.card}>
        <h3 className={`mb-3.5 ${ui.titleMd}`}>
          MonsoonNet-lite Mathematical Architecture &amp; Physical Safeguards
        </h3>
        <div className="grid gap-4 text-xs text-text-main md:grid-cols-3">
          <div className="rounded-xl border border-twilight-border bg-twilight-base p-4">
            <span className="font-bold text-teal-300">Receptive Field Locality (Radius = 2):</span>
            <p className="mt-1 leading-relaxed text-text-muted">
              Each grid cell computes tendencies strictly from its 5×5 spatial neighborhood. Day-1 disturbance propagation is mathematically bounded to ≤ 2 cells.
            </p>
          </div>
          <div className="rounded-xl border border-twilight-border bg-twilight-base p-4">
            <span className="font-bold text-teal-300">Harmonic Climatology Baseline:</span>
            <p className="mt-1 leading-relaxed text-text-muted">
              Model learns bounded anomalies relative to a 3-harmonic annual seasonal cycle. Rainfall is processed in log1p space with non-negative physical bounds.
            </p>
          </div>
          <div className="rounded-xl border border-twilight-border bg-twilight-base p-4">
            <span className="font-bold text-teal-300">Saturation &amp; Numerical Stability:</span>
            <p className="mt-1 leading-relaxed text-text-muted">
              Residual changes are capped via 4 × tanh(x/4) with explicit anomaly clipping (temperature ±6.0σ, rainfall 1.9σ) preventing numerical explosion.
            </p>
          </div>
        </div>
      </div>

      {/* Prominent Scientific Limitations & Disclosures */}
      <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-amber-500/30 border border-amber-400/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Scientific Caveats
          </span>
          <h3 className="text-sm font-bold text-amber-200">
            Known Scientific Limitations &amp; Transparency Disclosures
          </h3>
        </div>
        <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed text-amber-100/80">
          <li>
            <strong>Coarse Spatial Resolution:</strong> 1° × 1° ERA5 grid (~100 km) cannot resolve convective-scale thunderstorms, cloud microphysics, or complex mountain valley winds.
          </li>
          <li>
            <strong>Day-8 Rain Blur Weakness:</strong> Day-8 rainfall retains ~37% of real spatial variance, slightly below the 40% target, resulting in oversmoothed precipitation fields at longer leads.
          </li>
          <li>
            <strong>Counterfactual Unobservability:</strong> Multiverse shocks (e.g. +3K Bay of Bengal) represent model response dynamics, not real-world counterfactual truth.
          </li>
          <li>
            <strong>Uncalibrated Ensemble Spread:</strong> Ensemble spread is generated from initial-condition Gaussian perturbations and should not be treated as a formally calibrated probability without reliability diagram validation.
          </li>
          <li>
            <strong>Non-Operational Status:</strong> Multiverse of Monsoon is an AI research digital twin and must not be used for emergency disaster response or life-critical warnings.
          </li>
        </ul>
      </div>
    </div>
  );
}
