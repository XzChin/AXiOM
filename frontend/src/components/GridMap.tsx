import { useEffect, useRef } from "react";
import { Grid, NLAT, NLON, lat, lon } from "../utils/science";
import { INDIA_OUTLINE } from "../utils/india";
import { palette } from "../theme";

const S = 14;

/**
 * High-legibility scientific color scales tailored for mid-tone twilight:
 * - Sequential: Clean Ice Blue (low) -> Ocean Steel -> Deep Navy Marine (high)
 * - Diverging: Standard IPCC/NOAA scientific anomaly ramp (RdBu-inspired):
 *   Negative anomaly (deficit/cool) -> Ocean Blue
 *   Zero anomaly (neutral center)   -> Clean Soft Off-White
 *   Positive anomaly (surplus/warm) -> Crimson Red
 *
 * Continuous and monotonic to prevent blotching, posterization, or artificial seams.
 */
function color(t: number, diverging: boolean): string {
  const x = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0.5));
  if (!diverging) {
    // Meteorological sequential precipitation/magnitude ramp
    return `hsl(${208 - 22 * x} ${65 + 25 * x}% ${94 - 64 * x}%)`;
  }
  // Diverging anomaly scale: 0 is center (neutral soft off-white)
  const k = 2 * x - 1; // [-1, +1]
  const absK = Math.abs(k);
  const hue = k < 0 ? 215 : 15;
  const sat = Math.round(15 + 65 * Math.pow(absK, 0.6));
  const light = Math.round(95 - 53 * absK);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export function GridMap({ title, grid, range, diverging, land, cell, onCell, unit, showOutline = true, regionBounds }: {
  title: string; grid: Grid; range: [number, number]; diverging: boolean; land: number[][];
  cell?: [number, number]; onCell?: (c: [number, number]) => void; unit: string; showOutline?: boolean;
  regionBounds?: { lat: readonly [number, number]; lon: readonly [number, number] };
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const g = ref.current!.getContext("2d")!;
    const [lo, hi] = range;
    for (let i = 0; i < NLAT; i++) {
      for (let j = 0; j < NLON; j++) {
        g.fillStyle = color(hi > lo ? (grid[i][j] - lo) / (hi - lo) : 0.5, diverging);
        g.fillRect(j * S, (NLAT - 1 - i) * S, S, S);
      }
    }

    // Land/sea coastline boundary
    g.strokeStyle = palette.mapLandBoundary;
    g.lineWidth = 1.3;
    g.beginPath();
    for (let i = 0; i < NLAT; i++) {
      for (let j = 0; j < NLON; j++) {
        const a = land[i][j] > 0.5, y = (NLAT - 1 - i) * S;
        if (j + 1 < NLON && a !== land[i][j + 1] > 0.5) { g.moveTo((j + 1) * S, y); g.lineTo((j + 1) * S, y + S); }
        if (i + 1 < NLAT && a !== land[i + 1][j] > 0.5) { g.moveTo(j * S, y); g.lineTo((j + 1) * S, y); }
      }
    }
    g.stroke();
    // Show selected region, or the national India outline by default.
    if (regionBounds) {
      const [south, north] = regionBounds.lat;
      const [west, east] = regionBounds.lon;
      const x = (value: number) => (value - lon(0) + 0.5) * S;
      const y = (value: number) => (lat(NLAT - 1) + 0.5 - value) * S;
      const rx = x(west);
      const ry = y(north);
      const rw = x(east) - rx;
      const rh = y(south) - ry;

      // Dark outer border for contrast.
      g.setLineDash([]);
      g.strokeStyle = "rgba(15,23,42,0.95)";
      g.lineWidth = 6;
      g.strokeRect(rx, ry, rw, rh);

      // Bright magenta dashed selected-region boundary.
      g.strokeStyle = "#ff2d75";
      g.lineWidth = 3;
      g.setLineDash([9, 4]);
      g.strokeRect(rx, ry, rw, rh);
      g.setLineDash([]);
    } else if (showOutline && INDIA_OUTLINE.length > 2) {
      // High-contrast warm-gold India outline from the redesigned UI.
      g.strokeStyle = "rgba(245, 166, 35, 0.85)";
      g.lineWidth = 1.6;
      g.beginPath();
      INDIA_OUTLINE.forEach(([li, lj], idx) => {
        const cx = (lj + 0.5) * S, cy = (NLAT - 1 - li + 0.5) * S;
        idx === 0 ? g.moveTo(cx, cy) : g.lineTo(cx, cy);
      });
      g.closePath();
      g.stroke();
    }

    // Selected cell crosshair & highlight
    if (cell) {
      g.lineWidth = 3;
      g.strokeStyle = palette.selectionHighlight;
      g.strokeRect(cell[1] * S, (NLAT - 1 - cell[0]) * S, S, S);
    }
  }, [grid, range, diverging, land, cell, showOutline, regionBounds]);

  return (
    <figure className="min-w-0 rounded-2xl border border-twilight-border bg-twilight-surface-raised p-4 shadow-md transition-all">
      <figcaption className="mb-2.5 flex items-center justify-between text-xs font-bold tracking-tight text-text-bright">
        <span className="truncate pr-2">{title}</span>
        <span className="shrink-0 rounded bg-steel-700/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-300">
          [{unit}]
        </span>
      </figcaption>

      <div className="relative overflow-hidden rounded-xl border border-twilight-border bg-twilight-base shadow-inner">
        <canvas
          ref={ref}
          width={NLON * S}
          height={NLAT * S}
          className="h-auto w-full cursor-crosshair transition-opacity hover:opacity-95"
          aria-label={`${title} grid map`}
          onClick={(e) => {
            if (!onCell) return;
            const b = e.currentTarget.getBoundingClientRect();
            const j = Math.min(NLON - 1, Math.floor(((e.clientX - b.left) / b.width) * NLON));
            const i = NLAT - 1 - Math.min(NLAT - 1, Math.floor(((e.clientY - b.top) / b.height) * NLAT));
            onCell([i, j]);
          }}
        />
      </div>

      <div className="mt-3 flex items-center gap-2.5 text-xs font-bold text-text-main tabular-nums">
        <span className="shrink-0">{range[0].toFixed(1)}</span>
        <span
          className="h-2.5 flex-1 rounded-full border border-twilight-border/80 shadow-inner"
          style={{
            background: `linear-gradient(90deg,${[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
              .map((t) => color(t, diverging))
              .join(",")})`,
          }}
        />
        <span className="shrink-0">{range[1].toFixed(1)} <span className="text-text-muted font-normal">{unit}</span></span>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-subtle tabular-nums">
        <span>Subcontinent: {lat(0)}–{lat(31)}°N, {lon(0)}–{lon(35)}°E</span>
        <span className="text-teal-400 font-medium">1° ERA5 Resolution</span>
      </div>
    </figure>
  );
}
