import { useMemo, useState } from "react";
import { Meta, Run } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { Grid, State, moistureTransport, monsoonPulse, pressureAnomaly, windSpeed } from "../utils/science";
import { palette, ui } from "../theme";

interface Props {
  meta: Meta | null;
  base: Run | null;
  shocked: { run: Run; delta: State; label: string } | null;
  day: number;
  setDay: (d: number) => void;
  cell: [number, number];
  setCell: (c: [number, number]) => void;
}

export function AtmosphereView({
  meta, base, shocked, day, setDay, cell, setCell,
}: Props) {
  const [layer, setLayer] = useState<"wind_speed" | "pressure_anom" | "moisture_transport" | "orography">("wind_speed");

  const currentState = base?.rollout[day - 1];
  const currentShockState = shocked?.run.rollout[day - 1];

  const layerInfo = {
    wind_speed: { name: "Surface Wind Speed (|V|)", unit: "m/s", diverging: false },
    pressure_anom: { name: "Sea Level Pressure Anomaly (ΔP)", unit: "hPa", diverging: true },
    moisture_transport: { name: "Moisture Flux Proxy (TCWV × |V|)", unit: "kg/(m·s)", diverging: false },
    orography: { name: "Surface Elevation / Orography", unit: "meters", diverging: false },
  }[layer];

  const currentGrid: Grid | null = useMemo(() => {
    if (layer === "orography") {
      return meta?.orography_m || Array.from({ length: 32 }, () => Array(36).fill(0));
    }
    if (!currentState) return null;
    if (layer === "wind_speed") return windSpeed(currentState);
    if (layer === "pressure_anom") return pressureAnomaly(currentState);
    if (layer === "moisture_transport") return moistureTransport(currentState);
    return null;
  }, [layer, currentState, meta]);

  const shockGrid: Grid | null = useMemo(() => {
    if (layer === "orography" || !currentShockState) return null;
    if (layer === "wind_speed") return windSpeed(currentShockState);
    if (layer === "pressure_anom") return pressureAnomaly(currentShockState);
    if (layer === "moisture_transport") return moistureTransport(currentShockState);
    return null;
  }, [layer, currentShockState]);

  const mapList = useMemo(() => {
    if (!currentGrid) return [];
    const flat = currentGrid.flat();
    const lo = Math.min(...flat);
    const hi = Math.max(...flat);
    const range: [number, number] = layerInfo.diverging
      ? [-Math.max(Math.abs(lo), Math.abs(hi)), Math.max(Math.abs(lo), Math.abs(hi))]
      : [Math.max(0, lo), hi];

    const list = [
      {
        title: `${layerInfo.name} — Baseline Day +${day} [Derived]`,
        grid: currentGrid,
        range,
        diverging: layerInfo.diverging,
      },
    ];

    if (shockGrid) {
      list.push({
        title: `${layerInfo.name} — Shocked Day +${day} [Derived]`,
        grid: shockGrid,
        range,
        diverging: layerInfo.diverging,
      });
    }

    return list;
  }, [currentGrid, shockGrid, layerInfo, day]);

  // Monsoon Pulse diagnostic: Mean zonal wind over Arabian Sea & Central Monsoon domain
  const pulseBaseline = useMemo(() => {
    return base ? monsoonPulse(base.rollout) : [];
  }, [base]);

  const pulseShocked = useMemo(() => {
    return shocked ? monsoonPulse(shocked.run.rollout) : [];
  }, [shocked]);

  const pulseSeries: Series[] = [];
  if (pulseBaseline.length > 0) {
    pulseSeries.push({ name: "Baseline Monsoon Pulse [Derived]", values: pulseBaseline, color: "#5F93B5" });
  }
  if (pulseShocked.length > 0) {
    pulseSeries.push({ name: "Shocked Monsoon Pulse [Derived]", values: pulseShocked, color: palette.accent });
  }

  return (
    <div className="space-y-6">
      {/* Layer selector bar */}
      <div className={`${ui.card} flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-steel-400`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={ui.titleSm}>Atmospheric Diagnostic:</span>
          {[
            { id: "wind_speed", label: "Wind Speed (|V|)" },
            { id: "pressure_anom", label: "Pressure Anomaly (ΔP)" },
            { id: "moisture_transport", label: "Moisture Flux" },
            { id: "orography", label: "Static Orography" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setLayer(item.id as any)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                layer === item.id
                  ? "bg-[#1D2A3E] text-[#FFFEFA] shadow-sm"
                  : "bg-twilight-raised text-text-main hover:bg-twilight-hover"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {layer !== "orography" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={ui.titleSm}>Lead Day:</span>
            {Array.from({ length: 10 }, (_, i) => (
              <button
                key={i}
                onClick={() => setDay(i + 1)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums transition ${
                  day === i + 1
                    ? "bg-teal-500 text-steel-950"
                    : "bg-twilight-raised text-text-muted hover:bg-twilight-hover"
                }`}
              >
                +{i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Spatial Maps */}
      {currentGrid ? (
        <div className={ui.cardRaised}>
          <div className={ui.cardHeader}>
            <div>
              <h3 className={ui.titleLg}>
                {layerInfo.name} Spatial Distribution [Derived]
              </h3>
              <p className={ui.muted}>Physical dynamic diagnostic calculated from atmospheric rollout states</p>
            </div>
            <span className={ui.badgeAccent}>
              Unit: {layerInfo.unit}
            </span>
          </div>

          <div className={`grid gap-5 ${mapList.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
            {mapList.map((m) => (
              <GridMap
                key={m.title}
                {...m}
                unit={layerInfo.unit}
                land={meta?.land_mask || []}
                cell={cell}
                onCell={setCell}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={`${ui.card} py-14 text-center text-sm text-text-muted`}>
          Load an initial forecast window to calculate derived atmospheric diagnostics.
        </div>
      )}

      {/* Monsoon Pulse Diagnostic */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={ui.card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className={ui.titleMd}>
              Monsoon Pulse Index — Kinetic Onset Diagnostic [Derived]
            </h3>
            <span className={ui.badgePrimary}>
              PHYSICAL DIAGNOSTIC
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-text-muted">
            Domain-averaged lower-tropospheric zonal wind (u10) across Arabian Sea &amp; Central India [10–25°N, 70–90°E]. Onset typically manifests as sustained westerlies &gt; 5–6 m/s.
          </p>
          <LineChart series={pulseSeries} unit="m/s" />
        </div>

        <div className={ui.card}>
          <h3 className={`mb-3 ${ui.titleMd}`}>Meteorological Diagnostic Notes</h3>
          <div className="space-y-3 text-xs text-text-main">
            <div className="rounded-xl border border-twilight-border bg-twilight-base/80 p-3.5">
              <span className="font-bold text-[#75472F]">Moisture Transport Jet (Findlater Jet):</span>
              <p className="mt-1 leading-relaxed text-text-muted">
                Strong low-level cross-equatorial southwesterly flow transports precipitable water vapor from the Arabian Sea across the Western Ghats into central India.
              </p>
            </div>
            <div className="rounded-xl border border-twilight-border bg-twilight-base/80 p-3.5">
              <span className="font-bold text-[#29364A]">Monsoon Trough Pressure Anomaly:</span>
              <p className="mt-1 leading-relaxed text-text-muted">
                Negative pressure anomalies along the Indo-Gangetic Plain and northern Bay of Bengal signal active monsoon trough depressions that steer rainfall clusters.
              </p>
            </div>
            <div className="rounded-xl border border-twilight-border bg-twilight-base/80 p-3.5">
              <span className="font-bold text-[#75472F]">Orographic Triggering:</span>
              <p className="mt-1 leading-relaxed text-text-muted">
                Elevated terrain along the Western Ghats and Himalayan foothills generates intense mechanical lifting, driving localized heavy precipitation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
