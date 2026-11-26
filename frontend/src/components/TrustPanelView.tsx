import { Meta, EvaluationResult } from "../api";

interface Props {
  meta: Meta | null;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

function fmt(value: number | undefined, digits = 3): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "Not available";
}

function periodLabel(result: EvaluationResult): string {
  return result.years?.length
    ? `${result.years[0]}–${result.years[result.years.length - 1]}`
    : "Period not specified";
}

function EvaluationCard({
  title,
  result,
}: {
  title: string;
  result: EvaluationResult | null | undefined;
}) {
  if (!result) {
    return (
      <div className={card}>
        <h3 className="mb-2 font-bold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500">No evaluation artifact is available.</p>
      </div>
    );
  }

  const rainfallVariance = result.day8_variance_ratio?.[1];

  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-500">
          {periodLabel(result)} · {result.windows} windows
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <span className="text-slate-600">Mean window skill</span>
          <span className="font-bold text-slate-900">{fmt(result.mean_window_skill)}</span>
        </div>

        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <span className="text-slate-600">Day-8 rainfall variance ratio</span>
          <span className="font-bold text-amber-700">{fmt(rainfallVariance)}</span>
        </div>

        <div className="border-b border-slate-100 py-2">
          <p className="mb-1 font-semibold text-slate-700">Heavy-rain CSI · Model / Persistence / Climatology</p>
          {(["day1", "day4", "day8"] as const).map((lead) => {
            const values = result.by_lead?.[lead]?.csi;
            return (
              <div key={lead} className="flex justify-between gap-3 py-1">
                <span className="text-slate-600">{lead.replace("day", "Day ")}</span>
                <span className="font-medium text-slate-900">
                  {values
                    ? `${fmt(values.model)} / ${fmt(values.persistence)} / ${fmt(values.climatology)}`
                    : "Not available"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <span className="text-slate-600">Invalid evaluation windows</span>
          <span className="font-bold text-slate-900">
            {result.invalid_windows} / {result.windows}
          </span>
        </div>

        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <span className="text-slate-600">Anti-blur score (points)</span>
          <span className="font-bold text-slate-900">{fmt(result.anti_blur_points, 2)}</span>
        </div>

        <div className="flex justify-between gap-3 border-b border-slate-100 py-1">
          <span className="text-slate-600">Mean causality score</span>
          <span className="font-bold text-slate-900">
            {fmt(result.causality_mean_points_of_15, 2)} / 15
          </span>
        </div>

        <div className="flex justify-between gap-3 py-1">
          <span className="text-slate-600">All-null check</span>
          <span className={`font-bold ${result.null_all_ok ? "text-emerald-700" : "text-rose-700"}`}>
            {result.null_all_ok ? "Passed" : "Not passed"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TrustPanelView({ meta }: Props) {
  const evalVal = meta?.eval_val;
  const evalTest = meta?.eval_test;

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Trust Panel & Mission Control Audit
            </h2>
            <p className="text-xs text-slate-500">
              Evaluation evidence, model safeguards, and scientific limitations.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Evaluation artifacts · {evalVal && evalTest ? "2 periods loaded" : "Partial or unavailable"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="block text-xs font-medium text-slate-600">Validation windows</span>
            <span className="text-xl font-bold text-slate-900">
              {evalVal?.windows ?? "—"}
            </span>
            <p className="mt-1 text-xs text-slate-600">
              {evalVal ? periodLabel(evalVal) : "No validation artifact"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <span className="block text-xs font-medium text-slate-600">Held-out test windows</span>
            <span className="text-xl font-bold text-slate-900">
              {evalTest?.windows ?? "—"}
            </span>
            <p className="mt-1 text-xs text-slate-600">
              {evalTest ? periodLabel(evalTest) : "No test artifact"}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <span className="block text-xs font-medium text-slate-600">Model identity</span>
            <span className="text-sm font-bold text-slate-900">
              {typeof meta?.model_info?.name === "string"
                ? meta.model_info.name
                : "MonsoonNet-lite"}
            </span>
            <p className="mt-1 text-xs text-slate-600">
              Identity label from available metadata
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <EvaluationCard title="Held-out validation evaluation" result={evalVal} />
        <EvaluationCard title="Held-out test evaluation" result={evalTest} />
      </div>

      <div className={card}>
        <h3 className="mb-3 font-bold text-slate-800">
          Model Architecture & Physics Safeguards (MonsoonNet-lite)
        </h3>
        <div className="grid gap-4 text-xs text-slate-700 md:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-bold text-slate-900">Receptive Field & Locality:</span>
            <p className="mt-1 text-slate-600">
              Each forecast step uses a 5×5 spatial neighborhood (radius = 2 grid cells).
              Repeated autoregressive steps can propagate effects beyond that one-step neighborhood.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-bold text-slate-900">Climatological Normalization:</span>
            <p className="mt-1 text-slate-600">
              Predicts bounded anomalies against a 3-harmonic annual seasonal cycle.
              Rainfall is processed in log1p space to stabilize heavy precipitation.
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-bold text-slate-900">Non-Linear Saturation Bounding:</span>
            <p className="mt-1 text-slate-600">
              Residual changes use 4 × tanh(x/4), with explicit anomaly clipping.
              Temperature anomaly clipping is 6.0σ and rainfall anomaly clipping is 1.9σ.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 text-rose-950">
        <h3 className="font-bold text-rose-900">
          Known Scientific Limitations & Transparency Disclosures
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1.5 text-xs text-rose-800">
          <li>
            <strong>Coarse Spatial Resolution:</strong> The 1° × 1° ERA5 grid (approximately
            100 km) cannot resolve convective-scale thunderstorms, cloud microphysics, or
            complex mountain-valley winds.
          </li>
          <li>
            <strong>Day-8 Rainfall Smoothing:</strong> The held-out evaluation reports a
            rainfall variance ratio of {fmt(evalVal?.day8_variance_ratio?.[1])} on validation
            and {fmt(evalTest?.day8_variance_ratio?.[1])} on test. These values indicate
            reduced spatial variance at longer lead times.
          </li>
          <li>
            <strong>Counterfactual Unobservability:</strong> Multiverse shocks (for example,
            a +3 K Bay of Bengal perturbation) represent model response dynamics, not
            real-world counterfactual truth.
          </li>
          <li>
            <strong>Uncalibrated Ensemble Spread:</strong> Ensemble spread is generated
            from initial-condition Gaussian perturbations and should not be treated as a
            formally calibrated probability without reliability-diagram validation.
          </li>
          <li>
            <strong>Non-Operational Status:</strong> Multiverse of Monsoon is an AI research
            digital twin and must not be used for emergency disaster response or
            life-critical warnings.
          </li>
        </ul>
      </div>
    </div>
  );
}
