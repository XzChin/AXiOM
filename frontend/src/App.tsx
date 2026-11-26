import { useEffect, useState } from "react";
import {
  Meta,
  Run,
  Window_,
  getMeta,
  getSampleWindows,
  getWindow,
  simulate,
} from "./api";
import { RegionId } from "./utils/india";
import { State } from "./utils/science";

// Sub-views
import { TimelinePrimeView } from "./components/TimelinePrimeView";
import { ShockLabView } from "./components/ShockLabView";
import { AtmosphereView } from "./components/AtmosphereView";
import { ConsequenceView } from "./components/ConsequenceView";
import { EnsembleSensitivityView } from "./components/EnsembleSensitivityView";
import { ReverseMemoryView } from "./components/ReverseMemoryView";
import { TrustPanelView } from "./components/TrustPanelView";

type TabId =
  | "timeline"
  | "shock_lab"
  | "atmosphere"
  | "consequence"
  | "ensemble_sens"
  | "reverse_mem"
  | "trust";

const navTabs: { id: TabId; label: string; badge?: string }[] = [
  { id: "timeline", label: "Timeline Prime" },
  { id: "shock_lab", label: "Multiverse Shock Lab" },
  { id: "atmosphere", label: "Atmosphere & Pulse" },
  { id: "consequence", label: "Consequence Engine", badge: "Proxy" },
  { id: "ensemble_sens", label: "Ensemble & Sensitivity" },
  { id: "reverse_mem", label: "Reverse & Memory Lab" },
  { id: "trust", label: "Trust Panel & Audit" },
];

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const btnPrimary = "rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-40 transition";
const input = "w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 shadow-sm";

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [sampleWindows, setSampleWindows] = useState<Window_[]>([]);
  const [selectedSample, setSelectedSample] = useState("monsoon_onset");
  const [date, setDate] = useState("2021-06-10");
  const [win, setWin] = useState<Window_ | null>(null);
  const [base, setBase] = useState<Run | null>(null);
  const [shocked, setShocked] = useState<{ run: Run; delta: State; label: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("timeline");

  // Shared view settings
  const [ch, setCh] = useState(1); // default to Rainfall
  const [day, setDay] = useState(1);
  const [cell, setCell] = useState<[number, number]>([14, 12]);
  const [selectedRegion, setSelectedRegion] = useState<RegionId>("all_india");

  // Snapshot / Time Machine state
  const [snapshots, setSnapshots] = useState<{ name: string; time: string; run: Run; win: Window_ }[]>([]);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Initial load
  useEffect(() => {
    getMeta()
      .then((m) => {
        setMeta(m);
        // Also fetch sample windows for offline use
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

  const clear = () => {
    setBase(null);
    setShocked(null);
  };

  const loadDate = () =>
    task("Loading Date Window & Simulating", async () => {
      clear();
      const w = await getWindow(date);
      setWin(w);
      const r = await simulate(w, null);
      setBase(r);
    });

  const loadSample = (w: Window_) =>
    task(`Simulating Archetype: ${w.label || w.id}`, async () => {
      clear();
      setWin(w);
      const r = await simulate(w, null);
      setBase(r);
    });

  const handleCustomJson = (file: File) =>
    task("Loading Custom Window JSON", async () => {
      const text = await file.text();
      const w = JSON.parse(text) as Window_;
      clear();
      setWin(w);
      const r = await simulate(w, null);
      setBase(r);
    });

  const saveSnapshot = () => {
    if (!base || !win) return;
    const name = win.label || win.date || `Simulation ${snapshots.length + 1}`;
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-700 font-black text-white shadow-sm">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">
                  Multiverse of Monsoon
                </h1>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                  DIGITAL TWIN v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500">
                AI-Powered Climate Digital Twin of India & Autoregressive Perturbation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {base && (
              <div className="hidden rounded-lg bg-slate-100 px-3 py-1 font-mono text-slate-700 md:block">
                Inference: <strong>{base.inference_ms.toFixed(0)} ms</strong> | Net: {base.wall_ms.toFixed(0)} ms
              </div>
            )}
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Graded Model Ready
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mx-auto max-w-7xl px-4">
          <nav className="flex space-x-1 overflow-x-auto py-1" aria-label="Tabs">
            {navTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-sky-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                      activeTab === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-800 shadow-xs"
          >
            {error}
          </div>
        )}

        {/* Busy spinner banner */}
        {busy && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-xs font-semibold text-sky-800 shadow-xs">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-700 border-t-transparent" />
            <span>{busy}…</span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left Sidebar Controls */}
          <aside className="space-y-5">
            {/* Window selection card */}
            <div className={card}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Atmosphere Initial State (Day 0)
              </h2>

              <fieldset disabled={!!busy} className="space-y-3">
                {/* Sample Archetypes */}
                {sampleWindows.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Pre-packaged Climate Archetypes:
                    </label>
                    <select
                      className={input}
                      value={selectedSample}
                      onChange={(e) => {
                        setSelectedSample(e.target.value);
                        const found = sampleWindows.find((s) => s.id === e.target.value);
                        if (found) loadSample(found);
                      }}
                    >
                      {sampleWindows.map((sw) => (
                        <option key={sw.id} value={sw.id}>
                          {sw.label || sw.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ERA5 Date picker if dataset available */}
                {meta?.has_data ? (
                  <div className="space-y-1 border-t border-slate-100 pt-3">
                    <label className="text-xs font-semibold text-slate-700">
                      ERA5 Historical Window Date:
                    </label>
                    <input
                      type="date"
                      className={input}
                      value={date}
                      min="2005-01-03"
                      max="2021-12-31"
                      onChange={(e) => setDate(e.target.value)}
                    />
                    <button className={`${btnPrimary} mt-1 w-full`} onClick={loadDate}>
                      Load Date & Forecast
                    </button>
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500">
                    MONSOON_DATA netCDF is not mounted. Using verified synthetic archetypes or load JSON.
                  </div>
                )}

                {/* File Upload for custom JSON */}
                <div className="space-y-1 border-t border-slate-100 pt-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Upload Input Window JSON:
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    className="w-full text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCustomJson(f);
                    }}
                  />
                </div>
              </fieldset>
            </div>

            {/* Time Machine & Snapshots Card */}
            <div className={card}>
              <div className="mb-2 flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Climate Time Machine
                </h3>
                <button
                  className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                  disabled={!base}
                  onClick={saveSnapshot}
                >
                  + Snapshot
                </button>
              </div>

              {snapshots.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Save snapshot states to replay and compare simulation runs across different archetypes.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {snapshots.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{s.name}</span>
                        <span className="block text-[10px] text-slate-400">{s.time}</span>
                      </div>
                      <button
                        className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-200"
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

            {/* Quick Status Info */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-600">
              <span className="font-bold text-slate-800">Model Architecture:</span>
              <p className="mt-1">
                MonsoonNet-lite (219 features, 2×128 layers). Operates on pure NumPy with 1-degree contract grid.
              </p>
            </div>
          </aside>

          {/* Center Main Tab View */}
          <main className="min-w-0">
            {activeTab === "timeline" && (
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

            {activeTab === "atmosphere" && (
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

            {activeTab === "consequence" && (
              <ConsequenceView
                meta={meta}
                base={base}
                shocked={shocked}
              />
            )}

            {activeTab === "ensemble_sens" && (
              <EnsembleSensitivityView
                win={win}
                meta={meta}
                task={task}
                busy={busy}
              />
            )}

            {activeTab === "reverse_mem" && (
              <ReverseMemoryView
                win={win}
                meta={meta}
                task={task}
                busy={busy}
              />
            )}

            {activeTab === "trust" && (
              <TrustPanelView meta={meta} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
