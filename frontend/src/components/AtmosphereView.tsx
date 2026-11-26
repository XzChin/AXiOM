import { useMemo, useState } from "react";
import { Meta, Run } from "../api";
import { GridMap } from "./GridMap";
import { LineChart, Series } from "./LineChart";
import { Grid, State, lat, lon, moistureTransport, monsoonPulse, pressureAnomaly, windSpeed } from "../utils/science";

interface Props {
  meta: Meta | null;
  base: Run | null;
  shocked: { run: Run; delta: State; label: string } | null;
  day: number;
  setDay: (d: number) => void;
  cell: [number, number];
  setCell: (c: [number, number]) => void;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";

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
        title: `${layerInfo.name} — Baseline Day +${day} (DERIVED)`,
        grid: currentGrid,
        range,
        diverging: layerInfo.diverging,
      },
    ];

    if (shockGrid) {
      list.push({
        title: `${layerInfo.name} — Shocked Day +${day} (DERIVED)`,
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
    pulseSeries.push({ name: "Baseline Monsoon Zonal Pulse", values: pulseBaseline, color: "#0284c7" });
  }
  if (pulseShocked.length > 0) {
    pulseSeries.push({ name: "Shocked Monsoon Pulse", values: pulseShocked, color: "#ea580c" });
  }

  return (
    <div className="space-y-5">
      {/* Layer selector bar */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 text-xs font-bold text-slate-600">Atmosphere Layer:</span>
          {[
            { id: "wind_speed", label: "Wind Speed (|V|)" },
            { id: "pressure_anom", label: "Pressure Anomaly (ΔP)" },
            { id: "moisture_transport", label: "Moisture Transport Flux" },
            { id: "orography", label: "Static Orography" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setLayer(item.id as any)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                layer === item.id
                  ? "bg-sky-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {layer !== "orography" && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs font-bold text-slate-600">Day:</span>
            {Array.from({ length: 10 }, (_, i) => (
              <button
                key={i}
                onClick={() => setDay(i + 1)}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  day === i + 1 ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
        <div className={card}>
          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-slate-800">
              {layerInfo.name} Spatial Distribution
            </h3>
            <span className="rounded bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
              Unit: {layerInfo.unit}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
        <div className={`${card} text-center text-sm text-slate-500`}>
          Load an input window in Timeline Prime to view derived atmospheric fields.
        </div>
      )}

      {/* Monsoon Pulse Diagnostic */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">
              Monsoon Pulse Index — Kinetic Onset Diagnostic
            </h3>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
              PHYSICAL DIAGNOSTIC
            </span>
          </div>
          <p className="mb-2 text-xs text-slate-600">
            Domain-averaged lower-tropospheric zonal wind (u10) across Arabian Sea & Central India [10–25°N, 70–90°E]. Onset typically manifests as sustained westerlies &gt; 5–6 m/s.
          </p>
          <LineChart series={pulseSeries} unit="m/s" />
        </div>

        <div className={card}>
          <h3 className="mb-2 font-bold text-slate-800">Diagnostic Interpretations</h3>
          <div className="space-y-3 text-xs text-slate-700">
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="font-bold text-sky-900">Moisture Transport Jet (Findlater Jet):</span>
              <p className="mt-1 text-slate-600">
                Strong low-level cross-equatorial southwesterly flow transports precipitable water vapor from the Arabian Sea across the Western Ghats into central India.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="font-bold text-indigo-900">Monsoon Trough Pressure Anomaly:</span>
              <p className="mt-1 text-slate-600">
                Negative pressure anomalies along the Indo-Gangetic Plain and northern Bay of Bengal signal active monsoon trough depressions that steer rainfall clusters.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="font-bold text-emerald-900">Orographic Triggering:</span>
              <p className="mt-1 text-slate-600">
                Elevated terrain along the Western Ghats and Himalayan foothills generates intense mechanical lifting, driving localized heavy precipitation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
