export const CHANNELS = [
  { id: "t2m", label: "Temperature", unit: "°C", offset: -273.15, scale: 1 },
  { id: "tp", label: "Rainfall", unit: "mm/day", offset: 0, scale: 1 },
  { id: "u10", label: "U wind (10 m)", unit: "m/s", offset: 0, scale: 1 },
  { id: "v10", label: "V wind (10 m)", unit: "m/s", offset: 0, scale: 1 },
  { id: "msl", label: "Sea level pressure", unit: "hPa", offset: 0, scale: 0.01 },
  { id: "tcwv", label: "Water vapour", unit: "kg/m²", offset: 0, scale: 1 },
] as const;
export const NLAT = 32, NLON = 36;
export const lat = (i: number) => 6.5 + i;
export const lon = (j: number) => 65.5 + j;
export type Grid = number[][];        // [lat][lon]
export type State = Grid[];           // [channel][lat][lon]
export const display = (v: number, c: number) => (v + CHANNELS[c].offset) * CHANNELS[c].scale;
export const zeros = (): State => Array.from({ length: 6 }, () => Array.from({ length: NLAT }, () => Array(NLON).fill(0)));

type Box = [number, number, number, number];
const inBox = (i: number, j: number, [a, b, c, d]: Box) => lat(i) >= a && lat(i) <= b && lon(j) >= c && lon(j) <= d;

/** Same definitions as the official kit scoring.make_shock. */
export function presetShock(name: "warm_ocean" | "monsoon_stall", last: State): State {
  const d = zeros();
  for (let i = 0; i < NLAT; i++)
    for (let j = 0; j < NLON; j++) {
      if (name === "warm_ocean" && inBox(i, j, [8, 20, 82, 94])) { d[0][i][j] = 3; d[5][i][j] = 0.15 * last[5][i][j]; }
      if (name === "monsoon_stall" && inBox(i, j, [8, 20, 65, 75])) { d[2][i][j] = -0.4 * last[2][i][j]; d[3][i][j] = -0.4 * last[3][i][j]; }
    }
  return d;
}

/** Compact Gaussian: exactly zero beyond two sigma, so the footprint is bounded. */
export function gaussianShock(ch: number, clat: number, clon: number, radius: number, amp: number): State {
  const d = zeros();
  for (let i = 0; i < NLAT; i++)
    for (let j = 0; j < NLON; j++) {
      const r = Math.hypot(lat(i) - clat, lon(j) - clon);
      if (r <= 2 * radius) d[ch][i][j] = amp * Math.exp(-(r * r) / (2 * radius * radius));
    }
  return d;
}

export const subtract = (a: Grid, b: Grid): Grid => a.map((row, i) => row.map((v, j) => v - b[i][j]));
export const maxAbs = (g: Grid) => g.reduce((m, r) => r.reduce((n, v) => Math.max(n, Math.abs(v)), m), 0);

export function latRmse(a: Grid, b: Grid): number {
  let se = 0, w = 0;
  for (let i = 0; i < NLAT; i++) {
    const k = Math.cos((lat(i) * Math.PI) / 180);
    for (let j = 0; j < NLON; j++) { se += k * (a[i][j] - b[i][j]) ** 2; w += k; }
  }
  return Math.sqrt(se / w);
}

/** True if rollout has the contract shape and only finite numbers. */
export function validRollout(r: unknown, steps: number): r is State[] {
  return Array.isArray(r) && r.length === steps && r.every((s) => Array.isArray(s) && s.length === 6 && s.every(
    (g: unknown) => Array.isArray(g) && g.length === NLAT && g.every((row: unknown) => Array.isArray(row) && row.length === NLON && row.every(Number.isFinite))));
}

/** Largest day-1 response outside the footprint dilated by the model's per-step radius (square neighbourhood). */
export function outsideResponse(shock: State, base: State, run: State, radius = 2): number {
  const near = Array.from({ length: NLAT }, () => Array(NLON).fill(false));
  for (let i = 0; i < NLAT; i++)
    for (let j = 0; j < NLON; j++)
      if (shock.some((g) => g[i][j] !== 0))
        for (let a = Math.max(0, i - radius); a <= Math.min(NLAT - 1, i + radius); a++)
          for (let b = Math.max(0, j - radius); b <= Math.min(NLON - 1, j + radius); b++) near[a][b] = true;
  let m = 0;
  for (let c = 0; c < 6; c++)
    for (let i = 0; i < NLAT; i++)
      for (let j = 0; j < NLON; j++) if (!near[i][j]) m = Math.max(m, Math.abs(run[c][i][j] - base[c][i][j]));
  return m;
}
