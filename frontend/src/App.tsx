import { useCallback, useEffect, useState } from "react";
import {
  Meta,
  Run,
  Window_,
  checkHealth,
  getMeta,
  getModelHealth,
  getSampleWindows,
  getWindow,
  simulate,
} from "./api";
import { RegionId } from "./utils/india";
import { State } from "./utils/science";
import { ui } from "./theme";

// Sub-views
import { TimelinePrimeView } from "./components/TimelinePrimeView";
import { ShockLabView } from "./components/ShockLabView";
import { AtmosphereView } from "./components/AtmosphereView";
import { ConsequenceView } from "./components/ConsequenceView";
import { EnsembleSensitivityView } from "./components/EnsembleSensitivityView";
import { ReverseMemoryView } from "./components/ReverseMemoryView";
import { TrustPanelView } from "./components/TrustPanelView";
import { IntroSplash } from "./components/IntroSplash";

type MainNavTab = "forecast" | "shock_lab" | "explore" | "consequence" | "trust";
type ExploreSubTab = "ensemble_sens" | "reverse_mem" | "atmosphere";

function parseInputWindow(value: unknown): Window_ {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid JSON: Expected a simulation window object containing 'init_states' and 'doy_sincos'.");
  }

  const obj = value as Record<string, unknown>;

  // Check if user accidentally uploaded stats.json
  if (Array.isArray(obj.channels) && Array.isArray(obj.mean) && Array.isArray(obj.std)) {
    throw new Error(
      "Uploaded file is model statistics JSON ('stats.json'). This file contains model normalization parameters, not a simulation input. Please choose an archetype or upload an input window JSON."
    );
  }

  if (!Array.isArray(obj.init_states)) {
    throw new Error("Missing or invalid 'init_states': expected a 4D array of shape [3, 6, 32, 36].");
  }

  if (!Array.isArray(obj.doy_sincos)) {
    throw new Error("Missing or invalid 'doy_sincos': expected a 2-element array [sin, cos].");
  }

  // Validate complete nested 4D shape: 3 days, 6 channels, 32 lat, 36 lon
  const states = obj.init_states;
  if (states.length !== 3) {
    throw new Error(`Invalid 'init_states' time dimension: expected 3 consecutive days, got ${states.length}.`);
  }
  for (let t = 0; t < 3; t++) {
    const day = states[t];
    if (!Array.isArray(day) || day.length !== 6) {
      throw new Error(`Invalid 'init_states' channel dimension on day ${t}: expected 6 physical channels, got ${Array.isArray(day) ? day.length : typeof day}.`);
    }
    for (let c = 0; c < 6; c++) {
      const grid = day[c];
      if (!Array.isArray(grid) || grid.length !== 32) {
        throw new Error(`Invalid 'init_states' latitude grid dimension: expected 32 rows, got ${Array.isArray(grid) ? grid.length : typeof grid}.`);
      }
      for (let i = 0; i < 32; i++) {
        const row = grid[i];
        if (!Array.isArray(row) || row.length !== 36) {
          throw new Error(`Invalid 'init_states' longitude grid dimension: expected 36 columns, got ${Array.isArray(row) ? row.length : typeof row}.`);
        }
        for (let j = 0; j < 36; j++) {
          const val = row[j];
          if (typeof val !== "number" || !Number.isFinite(val)) {
            throw new Error(`Non-finite or invalid number at [day ${t}, channel ${c}, lat ${i}, lon ${j}].`);
          }
        }
      }
    }
  }

  // Validate doy_sincos
  const pair = obj.doy_sincos;
  if (pair.length !== 2 || typeof pair[0] !== "number" || typeof pair[1] !== "number" || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) {
    throw new Error("Invalid 'doy_sincos': expected [sin(2π doy/365), cos(2π doy/365)] as finite floats.");
  }

  const radius = Math.hypot(pair[0], pair[1]);
  if (Math.abs(radius - 1.0) > 0.08) {
    throw new Error(`Invalid 'doy_sincos' unit circle: hypot(sin, cos) = ${radius.toFixed(3)}, must be approximately 1.0.`);
  }

  return obj as unknown as Window_;
}

export function App() {
  const [showIntro, setShowIntro] = useState(true);
  const dismissIntro = useCallback(() => setShowIntro(false), []);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    status: "checking" | "online" | "offline";
    modelName?: string;
    error?: string;
  }>({ status: "checking" });

  const [sampleWindows, setSampleWindows] = useState<Window_[]>([]);
  const [selectedSample, setSelectedSample] = useState("monsoon_onset");
  const [date, setDate] = useState("2021-06-10");

  const [win, setWin] = useState<Window_ | null>(null);
  const [base, setBase] = useState<Run | null>(null);
  const [shocked, setShocked] = useState<{ run: Run; delta: State; label: string } | null>(null);

  // Main navigation tabs
  const [activeTab, setActiveTab] = useState<MainNavTab>("forecast");
  const [exploreTab, setExploreTab] = useState<ExploreSubTab>("ensemble_sens");

  // Shared forecast controls
  const [ch, setCh] = useState(1); // default to Rainfall (tp)
  const [day, setDay] = useState(1);
  const [cell, setCell] = useState<[number, number]>([14, 12]);
  const [selectedRegion, setSelectedRegion] = useState<RegionId>("all_india");

  // Snapshot / Time Machine
  const [snapshots, setSnapshots] = useState<{ name: string; time: string; run: Run; win: Window_ }[]>([]);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [modelStatus, setModelStatus] = useState<"checking" | "ready" | "offline">("checking");

  // Initial connection check & sample loading
  useEffect(() => {
    checkHealth()
      .then((h) => {
        setServerStatus({ status: "online", modelName: h.model_name });
      })
      .catch((e) => {
        setServerStatus({ status: "offline", error: String(e) });
      });

    getMeta()
      .then((m) => {
        setMeta(m);
        getSampleWindows()
          .then((sw) => {
            setSampleWindows(sw);
            if (sw.length > 0 && !m.has_data) {
              loadSample(sw[0]);
            }
          })
          .catch(() => {});
      })
      .catch((e) => setError(String(e)));
  }, []);

  async function task(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  const loadDate = () =>
    task("Simulating Historical ERA5 Window", async () => {
      const w = await getWindow(date);
      setShocked(null);
      setWin(w);
      const r = await simulate(w, null);
      setBase(r);
    });

  const loadSample = (w: Window_) =>
    task(`Simulating Climate Archetype: ${w.label || w.id}`, async () => {
      setShocked(null);
      setWin(w);
      const r = await simulate(w, null);
      setBase(r);
    });

  const handleCustomJson = (file: File) =>
    task("Validating & Forecasting Uploaded Window JSON", async () => {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Could not parse file as JSON. Please ensure it contains valid JSON text.");
      }
      // Strict pre-flight validation
      const validatedWindow = parseInputWindow(parsed);

      // Only applied after validation passes
      setShocked(null);
      setWin(validatedWindow);
      const r = await simulate(validatedWindow, null);
      setBase(r);
    });

  const saveSnapshot = () => {
    if (!base || !win) return;
    const name = win.label || win.date || `Forecast Run ${snapshots.length + 1}`;
    setSnapshots([
      ...snapshots,
      {
        name,
        time: new Date().toLocaleTimeString(),
        run: base,
        win,
      },
    ]);
  };

  const pageIntro = {
    forecast: { eyebrow: "INDIA · 1° GRID · 10-DAY OUTLOOK", title: "See the monsoon take shape.", copy: "Explore a live autoregressive forecast across India's temperature, rainfall, winds, pressure, and moisture." },
    shock_lab: { eyebrow: "COUNTERFACTUAL SCENARIO LAB", title: "Change the start. Trace what follows.", copy: "Apply a localized atmospheric shock and compare its forecast against the same initial conditions." },
    explore: { eyebrow: "ADVANCED MODEL EXPLORATION", title: "Look beyond the forecast.", copy: "Probe uncertainty, regional sensitivity, atmospheric memory, and derived circulation patterns." },
    consequence: { eyebrow: "IMPACT SCREENING · PROXY ONLY", title: "Translate rainfall into signals.", copy: "Explore transparent rainfall-threshold screening across the model grid and regional zones." },
    trust: { eyebrow: "MODEL, EVALUATION & LIMITS", title: "Understand what the twin can tell you.", copy: "Review the shipped evaluation results, live server connection, model details, and scientific limitations." },
  }[activeTab];

  return (
    <>
      {showIntro && <IntroSplash onDone={dismissIntro} />}
      <div className="app-shell min-h-screen bg-twilight-bg text-text-main selection:bg-teal-500/30 selection:text-teal-200">
      {/* Header & Atmospheric Top-Bar */}
      <header className="sticky top-0 z-30 border-b border-twilight-border bg-twilight-surface/95 backdrop-blur-md shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-steel-500 to-steel-700 text-text-bright shadow-sm border border-steel-400/40">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                <path d="M3 15c2.5-2 5-2 7.5 0s5 2 7.5 0 3-1 3-1" strokeLinecap="round" />
                <path d="M3 10c2.5-2 5-2 7.5 0s5 2 7.5 0 3-1 3-1" strokeLinecap="round" opacity="0.65" />
                <circle cx="17.5" cy="5.5" r="2.2" fill="#39BDAE" stroke="none" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-text-bright sm:text-lg">
                  Multiverse of Monsoon
                </h1>
                <span className={ui.badgePrimary}>
                  Digital Twin v1.0
                </span>
                {win?.synthetic_input && (
                  <span className={ui.badgeNeutral}>
                    Synthetic Archetype
                  </span>
                )}
                {win?.date && (
                  <span className={ui.badgeAccent}>
                    ERA5 Historical ({win.date})
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted">
                Autoregressive Climate Digital Twin of India &amp; Counterfactual Perturbation Engine
              </p>
            </div>
          </div>

          {/* Status & Latency Pills */}
          <div className="flex items-center gap-3 text-xs">
            {base && (
              <div className="hidden rounded-xl border border-twilight-border bg-twilight-base px-3 py-1.5 font-mono text-text-main tabular-nums md:block">
                Inference: <strong className="text-teal-300">{base.inference_ms.toFixed(0)} ms</strong> | Net: {base.wall_ms.toFixed(0)} ms
              </div>
            )}
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
                serverStatus.status === "online"
                  ? "bg-teal-500/20 border border-teal-400 text-teal-300"
                  : serverStatus.status === "checking"
                  ? "bg-twilight-raised border border-twilight-border text-text-muted"
                  : "bg-red-500/20 border border-red-400 text-red-300"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  serverStatus.status === "online"
                    ? "bg-teal-400 animate-pulse"
                    : serverStatus.status === "checking"
                    ? "bg-text-subtle animate-spin"
                    : "bg-red-400"
                }`}
              />
              {serverStatus.status === "online"
                ? "Model Online"
                : serverStatus.status === "checking"
                ? "Checking…"
                : "Model Offline"}
            </span>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="border-t border-twilight-border bg-twilight-base/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
            <nav className="flex space-x-1 py-1.5 overflow-x-auto" aria-label="Main Navigation">
              {/* Forecast */}
              <button
                onClick={() => setActiveTab("forecast")}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "forecast"
                    ? "bg-steel-500 text-text-bright shadow-sm"
                    : "text-text-muted hover:bg-twilight-hover hover:text-text-bright"
                }`}
              >
                <span>Forecast</span>
              </button>

              {/* Scenario Lab */}
              <button
                onClick={() => setActiveTab("shock_lab")}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "shock_lab"
                    ? "bg-teal-500 text-steel-950 shadow-sm font-extrabold"
                    : "text-text-muted hover:bg-twilight-hover hover:text-text-bright"
                }`}
              >
                <span>Scenario Lab</span>
                {shocked && (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    activeTab === "shock_lab" ? "bg-steel-950 text-teal-300" : "bg-teal-500/20 text-teal-300 border border-teal-400/40"
                  }`}>
                    Active
                  </span>
                )}
              </button>

              {/* Explore */}
              <button
                onClick={() => setActiveTab("explore")}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "explore"
                    ? "bg-steel-500 text-text-bright shadow-sm"
                    : "text-text-muted hover:bg-twilight-hover hover:text-text-bright"
                }`}
              >
                <span>Explore</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${
                  activeTab === "explore" ? "bg-steel-700 text-text-bright" : "bg-twilight-raised text-text-subtle"
                }`}>
                  3 Tools
                </span>
              </button>

              {/* Consequence / Impact Proxies */}
              <button
                onClick={() => setActiveTab("consequence")}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "consequence"
                    ? "bg-steel-500 text-text-bright shadow-sm"
                    : "text-text-muted hover:bg-twilight-hover hover:text-text-bright"
                }`}
              >
                <span>Impact Proxies</span>
                <span className="rounded-full bg-amber-500/20 border border-amber-400/50 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                  Proxy
                </span>
              </button>

              {/* Model & Trust */}
              <button
                onClick={() => setActiveTab("trust")}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "trust"
                    ? "bg-steel-500 text-text-bright shadow-sm"
                    : "text-text-muted hover:bg-twilight-hover hover:text-text-bright"
                }`}
              >
                <span>Model &amp; Trust</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        {/* Error notification banner */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-950/20 p-4 text-xs font-semibold text-red-200 shadow-md"
          >
            <div className="flex items-start gap-2.5">
              <span className="rounded bg-red-500/40 border border-red-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
                Notice
              </span>
              <span className="mt-0.5">{error}</span>
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-300 hover:text-red-100 font-bold px-1"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Busy spinner banner */}
        {busy && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-teal-500/40 bg-teal-950/20 px-4 py-3 text-xs font-semibold text-teal-200 shadow-md">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
            <span>{busy}…</span>
          </div>
        )}

        <section className="workspace-hero mb-6" aria-labelledby="workspace-title">
          <div className="workspace-hero-copy">
            <div className="workspace-eyebrow"><span className="eyebrow-pulse" />{pageIntro.eyebrow}</div>
            <h2 id="workspace-title">{pageIntro.title}</h2>
            <p>{pageIntro.copy}</p>
          </div>
          <div className="workspace-hero-stats" aria-label="Forecast configuration">
            <div className="hero-stat"><span>HORIZON</span><strong>10 <small>days</small></strong></div>
            <div className="hero-stat"><span>CHANNELS</span><strong>06 <small>fields</small></strong></div>
            <div className="hero-stat hero-stat-grid"><span>SPATIAL GRID</span><strong>32 × 36</strong></div>
          </div>
          <div className="hero-contour contour-one" aria-hidden="true" />
          <div className="hero-contour contour-two" aria-hidden="true" />
        </section>

        <div className={`workspace-layout grid gap-6 ${activeTab === "forecast" || activeTab === "shock_lab" ? "lg:grid-cols-[300px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
          {/* Left Sidebar: Unified Single Card Input & Time Machine */}
          <aside className="space-y-6">
            {/* Single Unified Atmosphere Initial State Card */}
            <div className={ui.card}>
              <h2 className="mb-3.5 text-xs font-bold uppercase tracking-wider text-teal-400">
                Atmosphere Initial State (Day 0)
              </h2>

              <fieldset disabled={!!busy} className="space-y-4">
                {/* 1. Pre-packaged Climate Archetypes */}
                {sampleWindows.length > 0 && (
                  <div className="space-y-1.5">
                    <label className={ui.label}>
                      Pre-packaged Climate Archetypes:
                    </label>
                    <select
                      className={ui.input}
                      value={selectedSample}
                      onChange={(e) => {
                        setSelectedSample(e.target.value);
                        const found = sampleWindows.find((s) => s.id === e.target.value);
                        if (found) loadSample(found);
                      }}
                    >
                      {sampleWindows.map((sw) => (
                        <option key={sw.id} value={sw.id} className="bg-twilight-surface text-text-bright">
                          {sw.label || sw.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 2. Historical ERA5 Date Picker */}
                {meta?.has_data ? (
                  <div className="space-y-1.5 border-t border-twilight-border pt-3">
                    <label className={ui.label}>
                      ERA5 Historical Window Date:
                    </label>
                    <input
                      type="date"
                      className={ui.input}
                      value={date}
                      min="2005-01-03"
                      max="2021-12-31"
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <button className={`${ui.btnPrimary} mt-1 w-full`} onClick={loadDate}>
                      Load Date &amp; Forecast
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-twilight-border bg-twilight-base p-2.5 text-[11px] leading-relaxed text-text-muted">
                    MONSOON_DATA netCDF is not mounted. Using verified synthetic archetypes or load JSON.
                  </div>
                )}

                {/* 3. Upload Input Window JSON */}
                <div className="space-y-1.5 border-t border-twilight-border pt-3">
                  <label className={ui.label}>
                    Upload Input Window JSON:
                  </label>
                  <p className="text-[11px] leading-relaxed text-text-subtle">
                    Requires init_states (3 × 6 × 32 × 36) and doy_sincos. Model stats files cannot be simulated.
                  </p>
                  <input
                    type="file"
                    accept=".json"
                    className="w-full text-xs text-text-muted file:mr-2.5 file:rounded-xl file:border file:border-twilight-border file:bg-twilight-raised file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text-bright hover:file:bg-twilight-hover cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCustomJson(f);
                    }}
                  />
                </div>
              </fieldset>
            </div>

            {/* Climate Time Machine & Snapshots */}
            <div className={ui.card}>
              <div className="mb-2.5 flex items-center justify-between border-b border-twilight-border pb-2">
                <h3 className={ui.titleSm}>
                  Climate Time Machine
                </h3>
                <button
                  className="rounded-xl border border-twilight-border bg-twilight-raised px-2.5 py-1 text-[11px] font-semibold text-text-bright hover:bg-twilight-hover disabled:opacity-40 transition"
                  disabled={!base}
                  onClick={saveSnapshot}
                >
                  + Snapshot
                </button>
              </div>

              {snapshots.length === 0 ? (
                <p className="text-xs text-text-muted leading-relaxed">
                  Capture snapshot states to replay and compare simulation runs across different archetypes.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {snapshots.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-twilight-border bg-twilight-base p-2.5 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="block truncate font-semibold text-text-bright">{s.name}</span>
                        <span className="block text-[10px] text-text-subtle tabular-nums">{s.time}</span>
                      </div>
                      <button
                        className="shrink-0 rounded-lg bg-steel-500 px-2.5 py-1 text-[11px] font-semibold text-text-bright hover:bg-steel-400 transition"
                        onClick={() => {
                          setWin(s.win);
                          setBase(s.run);
                        }}
                      >
                        Replay
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Model Architecture Pill */}
            <div className={ui.cardSubtle}>
              <span className="text-xs font-bold text-teal-300">Model Specifications</span>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                MonsoonNet-lite (219 features, 2×128 layers). Operates on pure NumPy with 1-degree subcontinent grid.
              </p>
            </div>
          </aside>

          {/* Central Main Workspaces */}
          <main className="min-w-0">
            {/* 1. Main Forecast Workspace */}
            {activeTab === "forecast" && (
              <TimelinePrimeView
                meta={meta}
                win={win}
                base={base}
                shocked={shocked}
                ch={ch}
                setCh={setCh}
                day={day}
                setDay={setDay}
                cell={cell}
                setCell={setCell}
                selectedRegion={selectedRegion}
                setSelectedRegion={setSelectedRegion}
              />
            )}

            {/* 2. Scenario Lab (Shocks) */}
            {activeTab === "shock_lab" && (
              <ShockLabView
                meta={meta}
                win={win}
                base={base}
                shocked={shocked}
                setShocked={setShocked}
                day={day}
                setDay={setDay}
                cell={cell}
                setCell={setCell}
                task={task}
                busy={busy}
              />
            )}

            {/* 3. Explore (Advanced Tools) */}
            {activeTab === "explore" && (
              <div className="space-y-6">
                {/* Explore Tool Switcher Bar */}
                <div className={`${ui.card} flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-teal-400`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={ui.titleSm}>Explore Tool:</span>
                    <button
                      onClick={() => setExploreTab("ensemble_sens")}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                        exploreTab === "ensemble_sens"
                          ? "bg-teal-500 text-steel-950 shadow-sm"
                          : "bg-twilight-raised text-text-main hover:bg-twilight-hover"
                      }`}
                    >
                      Ensemble &amp; Sensitivity Atlas
                    </button>
                    <button
                      onClick={() => setExploreTab("reverse_mem")}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                        exploreTab === "reverse_mem"
                          ? "bg-teal-500 text-steel-950 shadow-sm"
                          : "bg-twilight-raised text-text-main hover:bg-twilight-hover"
                      }`}
                    >
                      Reverse Simulator &amp; Memory Lab
                    </button>
                    <button
                      onClick={() => setExploreTab("atmosphere")}
                      className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                        exploreTab === "atmosphere"
                          ? "bg-teal-500 text-steel-950 shadow-sm"
                          : "bg-twilight-raised text-text-main hover:bg-twilight-hover"
                      }`}
                    >
                      Atmosphere &amp; Pulse Diagnostics
                    </button>
                  </div>
                </div>

                {exploreTab === "ensemble_sens" && (
                  <EnsembleSensitivityView
                    win={win}
                    meta={meta}
                    task={task}
                    busy={busy}
                  />
                )}

                {exploreTab === "reverse_mem" && (
                  <ReverseMemoryView
                    win={win}
                    meta={meta}
                    task={task}
                    busy={busy}
                  />
                )}

                {exploreTab === "atmosphere" && (
                  <AtmosphereView
                    meta={meta}
                    base={base}
                    shocked={shocked}
                    day={day}
                    setDay={setDay}
                    cell={cell}
                    setCell={setCell}
                  />
                )}
              </div>
            )}

            {/* 4. Consequence / Proxy Screening */}
            {activeTab === "consequence" && (
              <ConsequenceView
                meta={meta}
                base={base}
                shocked={shocked}
              />
            )}

            {/* 5. Model & Trust */}
            {activeTab === "trust" && (
              <TrustPanelView meta={meta} serverStatus={serverStatus} />
            )}
          </main>
        </div>
      </div>
      </div>
    </>
  );
}
