import { State, Grid, NLAT, NLON, CHANNELS, lat, lon, display, zeros, subtract, maxAbs, latRmse, gaussianShock, presetShock, validRollout, outsideResponse } from "./utils/science";

// ---- Types ----
export interface Meta {
  has_data: boolean; days: number; first_date: string; land_mask: number[][];
  orography_m?: number[][]; stats?: { channels: string[]; mean: number[]; std: number[] };
  model_info?: Record<string, unknown>;
  eval_val?: Record<string, unknown>; eval_test?: Record<string, unknown>;
}
export interface Window_ { date?: string; init_states: State[]; doy_sincos: number[]; truth?: State[]; id?: string; label?: string; synthetic_input?: boolean }
export interface Run { rollout: State[]; inference_ms: number; at: string; wall_ms: number }
export interface CertCheck { id: string; name: string; passed: boolean; detail: string }
export interface CertResult { checks: CertCheck[]; passed_count: number; total_checks: number; inference_ms: number }
export interface EnsembleResult { members: number; mean: State[]; spread: State[]; inference_ms: number; note: string }
export interface SensRow { source_id: string; source_name: string; channel: number; probe_amp: number; target_delta: number; abs_sensitivity: number }
export interface SensResult { target_region: string; target_channel: number; target_day: number; baseline_mean: number; sensitivities: SensRow[]; inference_ms: number; note: string }
export interface ReverseResult { target_region: string; target_day: number; target_channel: number; direction: string; baseline_mean: number; baseline_rollout: State[]; best_candidate: { channel: number; lat: number; lon: number; radius: number; amplitude: number; achieved_mean: number; delta: number; ood_warning: boolean; perturbation: State; rollout: State[] }; evaluations: number; inference_ms: number; note: string }
export interface MemoryCurveRow { day: number; energy: number; affected_cells: number; max_z: number }
export interface MemoryResult { recovery_day: number; total_days: number; control: State[]; shocked: State[]; compensated: State[]; shocked_curve: MemoryCurveRow[]; compensated_curve: MemoryCurveRow[]; time_to_return_day: number | null; tolerance_energy: number; inference_ms: number; note: string }

// ---- HTTP helpers ----
async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} failed (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
function post<T>(url: string, body: unknown): Promise<T> {
  return json<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

// ---- API calls ----
export const getMeta = () => json<Meta>("/api/meta");
export const getWindow = (d: string) => json<Window_>(`/api/window?date=${encodeURIComponent(d)}`);
export const getSampleWindows = () => json<Window_[]>("/api/sample-windows");

export async function simulate(w: Window_, perturbation: State | null): Promise<Run> {
  const t = performance.now();
  const r = await post<{ rollout: unknown; inference_ms: number }>("/api/model/simulate", {
    init_states: w.init_states, doy_sincos: w.doy_sincos, steps: 10, perturbation,
  });
  if (!validRollout(r.rollout, 10)) throw new Error("Model response failed shape or finite-value checks");
  return { rollout: r.rollout as State[], inference_ms: r.inference_ms, at: new Date().toLocaleTimeString(), wall_ms: performance.now() - t };
}

export const runCertificate = (w: Window_, pert: State, steps = 10) =>
  post<CertResult>("/api/analysis/certificate", { init_states: w.init_states, doy_sincos: w.doy_sincos, perturbation: pert, steps });

export const runEnsemble = (w: Window_, steps = 10, members = 5, noise = 0.05) =>
  post<EnsembleResult>("/api/analysis/ensemble", { init_states: w.init_states, doy_sincos: w.doy_sincos, steps, members, noise_scale: noise });

export const runSensitivity = (w: Window_, ch = 1, day = 4, region = "central_monsoon") =>
  post<SensResult>("/api/analysis/sensitivity", { init_states: w.init_states, doy_sincos: w.doy_sincos, target_channel: ch, target_day: day, region_id: region });

export const runReverse = (w: Window_, region: string, day: number, ch: number, dir: string) =>
  post<ReverseResult>("/api/analysis/reverse", { init_states: w.init_states, doy_sincos: w.doy_sincos, target_region: region, target_day: day, target_channel: ch, direction: dir });

export const runMemory = (w: Window_, pert: State, recoveryDay: number, totalDays = 10, compScale = 1.0) =>
  post<MemoryResult>("/api/analysis/memory", { init_states: w.init_states, doy_sincos: w.doy_sincos, perturbation: pert, recovery_day: recoveryDay, total_days: totalDays, comp_scale: compScale });
