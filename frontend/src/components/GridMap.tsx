import { useEffect, useRef } from "react";
import { Grid, NLAT, NLON, lat, lon } from "../utils/science";
import { INDIA_OUTLINE } from "../utils/india";

const S = 14;
function color(t: number, diverging: boolean): string {
  const x = Math.max(0, Math.min(1, t));
  if (!diverging) return `hsl(${210 - 20 * x} 70% ${94 - 70 * x}%)`;
  const k = 2 * x - 1;
  return `hsl(${k < 0 ? 215 : 15} 75% ${96 - 52 * Math.abs(k)}%)`;
}

export function GridMap({ title, grid, range, diverging, land, cell, onCell, unit, showOutline = true }: {
  title: string; grid: Grid; range: [number, number]; diverging: boolean; land: number[][];
  cell?: [number, number]; onCell?: (c: [number, number]) => void; unit: string; showOutline?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current!.getContext("2d")!;
    const [lo, hi] = range;
    for (let i = 0; i < NLAT; i++)
      for (let j = 0; j < NLON; j++) {
        g.fillStyle = color(hi > lo ? (grid[i][j] - lo) / (hi - lo) : 0.5, diverging);
        g.fillRect(j * S, (NLAT - 1 - i) * S, S, S);
      }
    // Land/sea boundary
    g.strokeStyle = "#111827"; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < NLAT; i++)
      for (let j = 0; j < NLON; j++) {
        const a = land[i][j] > 0.5, y = (NLAT - 1 - i) * S;
        if (j + 1 < NLON && a !== land[i][j + 1] > 0.5) { g.moveTo((j + 1) * S, y); g.lineTo((j + 1) * S, y + S); }
        if (i + 1 < NLAT && a !== land[i + 1][j] > 0.5) { g.moveTo(j * S, y); g.lineTo((j + 1) * S, y); }
      }
    g.stroke();
    // India outline overlay
    if (showOutline && INDIA_OUTLINE.length > 2) {
      g.strokeStyle = "rgba(255,215,0,0.7)"; g.lineWidth = 2; g.beginPath();
      INDIA_OUTLINE.forEach(([li, lj], idx) => {
        const cx = (lj + 0.5) * S, cy = (NLAT - 1 - li + 0.5) * S;
        idx === 0 ? g.moveTo(cx, cy) : g.lineTo(cx, cy);
      });
      g.closePath(); g.stroke();
    }
    // Selected cell highlight
    if (cell) {
      g.lineWidth = 3; g.strokeStyle = "#f59e0b"; g.strokeRect(cell[1] * S, (NLAT - 1 - cell[0]) * S, S, S);
    }
  }, [grid, range, diverging, land, cell, showOutline]);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-sm font-semibold">{title}</figcaption>
      <canvas ref={ref} width={NLON * S} height={NLAT * S} className="h-auto w-full cursor-crosshair rounded border border-slate-300"
        aria-label={`${title} grid map`}
        onClick={(e) => {
          if (!onCell) return;
          const b = e.currentTarget.getBoundingClientRect();
          const j = Math.min(NLON - 1, Math.floor(((e.clientX - b.left) / b.width) * NLON));
          const i = NLAT - 1 - Math.min(NLAT - 1, Math.floor(((e.clientY - b.top) / b.height) * NLAT));
          onCell([i, j]);
        }} />
      <div className="mt-1 flex items-center gap-2 text-xs">
        <span>{range[0].toFixed(1)}</span>
        <span className="h-2 flex-1 rounded" style={{ background: `linear-gradient(90deg,${[0, 0.25, 0.5, 0.75, 1].map((t) => color(t, diverging)).join(",")})` }} />
        <span>{range[1].toFixed(1)} {unit}</span>
      </div>
      <div className="text-xs text-slate-500">{lat(0)}–{lat(31)}°N, {lon(0)}–{lon(35)}°E</div>
    </figure>
  );
}
