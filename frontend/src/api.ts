import { State, validRollout } from "./utils/science";

export interface Meta { has_data: boolean; days: number; first_date: string; land_mask: number[][] }
export interface Window_ { date?: string; init_states: State[]; doy_sincos: number[]; truth?: State[] }
export interface Run { rollout: State[]; inference_ms: number; at: string; wall_ms: number }

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} failed (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
export const getMeta = () => json<Meta>("/api/meta");
export const getWindow = (d: string) => json<Window_>(`/api/window?date=${encodeURIComponent(d)}`);
export async function simulate(w: Window_, perturbation: State | null): Promise<Run> {
  const t = performance.now();
  const r = await json<{ rollout: unknown; inference_ms: number }>("/api/model/simulate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_states: w.init_states, doy_sincos: w.doy_sincos, steps: 10, perturbation }),
  });
  if (!validRollout(r.rollout, 10)) throw new Error("Model response failed shape or finite-value checks");
  return { rollout: r.rollout, inference_ms: r.inference_ms, at: new Date().toLocaleTimeString(), wall_ms: performance.now() - t };
}
