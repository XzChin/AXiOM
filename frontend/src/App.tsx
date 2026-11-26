import { useEffect, useMemo, useState } from "react";
import { getMeta, getWindow, simulate, Meta, Run, Window_ } from "./api";
import { GridMap } from "./components/GridMap";
import { LineChart, Series } from "./components/LineChart";
import { CHANNELS, Grid, State, display, gaussianShock, latRmse, lat, lon, maxAbs, outsideResponse, presetShock, subtract } from "./utils/science";

const btn = "rounded bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40";
const input = "w-full rounded border border-slate-300 bg-white p-1.5 text-sm";
const card = "rounded-lg border border-slate-200 bg-white p-4";

export function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [date, setDate] = useState("2021-06-10");
  const [win, setWin] = useState<Window_ | null>(null);
  const [base, setBase] = useState<Run | null>(null);
  const [shocked, setShocked] = useState<{ run: Run; delta: State; label: string } | null>(null);
  const [ch, setCh] = useState(0);
  const [day, setDay] = useState(1);
  const [cell, setCell] = useState<[number, number]>([13, 12]);
  const [kind, setKind] = useState("warm_ocean");
  const [g, setG] = useState({ ch: 0, lat: 15, lon: 88, radius: 3, amp: 2 });
  const [cert, setCert] = useState<[string, boolean, string][] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { getMeta().then(setMeta).catch((e) => setError(String(e))); }, []);

  // All inputs are disabled while a request runs, so a late response cannot overwrite a newer selection.
  async function task(name: string, fn: () => Promise<void>) {
    setBusy(name); setError("");
    try { await fn(); } catch (e) { setError(String(e)); } finally { setBusy(""); }
  }
  const clear = () => { setBase(null); setShocked(null); setCert(null); };
  const forecast = (w: Window_) => task("Forecasting", async () => { clear(); setWin(w); setBase(await simulate(w, null)); });
  const loadDate = () => task("Loading", async () => { clear(); const w = await getWindow(date); setWin(w); setBase(await simulate(w, null)); });

  const makeDelta = (): State => kind === "custom" ? gaussianShock(g.ch, g.lat, g.lon, g.radius, g.amp) : presetShock(kind as "warm_ocean" | "monsoon_stall", win!.init_states[2]);
  const runShock = () => task("Running shock", async () => {
    const delta = makeDelta(); setCert(null);
    setShocked({ run: await simulate(win!, delta), delta, label: kind === "custom" ? `${CHANNELS[g.ch].id} ${g.amp} at ${g.lat}°N ${g.lon}°E` : kind });
  });
  const certify = () => task("Certifying", async () => {
    const s = shocked!;
    const zero = await simulate(win!, s.delta.map((x) => x.map((r) => r.map(() => 0))));
    const again = await simulate(win!, s.delta);
    const same = (a: State[], b: State[]) => JSON.stringify(a) === JSON.stringify(b);
    const out = outsideResponse(s.delta, base!.rollout[0], s.run.rollout[0]);
    const resp = Math.max(...s.run.rollout[0].map((x, c) => maxAbs(subtract(x, base!.rollout[0][c]))));
    setCert([
      ["Zero shock equals null shock", same(zero.rollout, base!.rollout), "exact comparison"],
      ["Repeat run is identical", same(again.rollout, s.run.rollout), "exact comparison"],
      ["Rainfall is non-negative", s.run.rollout.every((x) => x[1].every((r) => r.every((v) => v >= 0))), "all days, all cells"],
      ["Day-1 response is non-zero", resp > 0, "at least one cell differs from baseline"],
      ["Day-1 change stays within 2 cells of the shock", out === 0, `largest outside change ${out.toPrecision(3)}`],
    ]);
  });

  const unit = CHANNELS[ch].unit;
  const shown = (s: State): Grid => s[ch].map((r) => r.map((v) => display(v, ch)));
  const maps = useMemo(() => {
    if (!base) return [];
    const b = shown(base.rollout[day - 1]);
    const s = shocked ? shown(shocked.run.rollout[day - 1]) : null;
    const t = !shocked && win?.truth?.[day - 1] ? shown(win.truth[day - 1]) : null;
    const flat = [b, s ?? t ?? b].flat(2);
    const wind = ch === 2 || ch === 3;
    const m = Math.max(...flat.map(Math.abs));
    const range: [number, number] = wind ? [-m, m] : [Math.min(...flat), Math.max(...flat)];
    const list = [{ title: "Baseline (MODEL)", grid: b, range, diverging: wind }];
    if (s) {
      const d = subtract(s, b), k = maxAbs(d) || 1;
      list.push({ title: "Shocked (MODEL)", grid: s, range, diverging: wind }, { title: "Delta: shocked − baseline (DERIVED)", grid: d, range: [-k, k], diverging: true });
    } else if (t) {
      const d = subtract(b, t), k = maxAbs(d) || 1;
      list.push({ title: "Truth (from dataset)", grid: t, range, diverging: wind }, { title: "Error: model − truth (DERIVED)", grid: d, range: [-k, k], diverging: true });
    }
    return list;
  }, [base, shocked, win, ch, day]);

  const series: Series[] = [];
  if (base) {
    const at = (r: State[]) => r.map((s) => display(s[ch][cell[0]][cell[1]], ch));
    series.push({ name: "Baseline", values: at(base.rollout), color: "#0369a1" });
    if (shocked) series.push({ name: "Shocked", values: at(shocked.run.rollout), color: "#c2410c" });
    if (win?.truth?.length === 10) series.push({ name: "Truth", values: at(win.truth), color: "#15803d", dash: "6 4" });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header><h1 className="text-2xl font-bold">Multiverse of Monsoon</h1>
        <p className="text-sm text-slate-600">Climate digital twin of India. Outputs are model simulations, not official forecasts or warnings.</p></header>
      {error && <div role="alert" className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className={card}>
          <fieldset disabled={!!busy} className="space-y-3">
            <h2 className="font-semibold">Input window</h2>
            {meta?.has_data ? <><label className="block text-sm">Last input day<input type="date" className={input} value={date} min="2005-01-03" max="2021-12-31" onChange={(e) => setDate(e.target.value)} /></label>
              <button className={btn} onClick={loadDate}>Load and forecast</button>
              <p className="text-xs text-slate-500">Dates up to 2017 are training data. 2018–2019 guided model choices. Only 2020–2021 was held out.</p></>
              : <p className="text-xs text-slate-600">MONSOON_DATA is not set. Load a window JSON file instead.</p>}
            <label className="block text-sm">Or load window JSON<input type="file" accept=".json" className={input}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => forecast(JSON.parse(t))).catch((x) => setError(String(x))); }} /></label>
            <label className="block text-sm">Variable<select className={input} value={ch} onChange={(e) => setCh(+e.target.value)}>{CHANNELS.map((c, i) => <option key={c.id} value={i}>{c.label}</option>)}</select></label>
            <h2 className="border-t pt-3 font-semibold">Multiverse Lab</h2>
            <label className="block text-sm">Shock<select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="warm_ocean">Warm Bay of Bengal</option><option value="monsoon_stall">Monsoon stall (Arabian Sea)</option><option value="custom">Custom Gaussian</option></select></label>
            {kind === "custom" && <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="col-span-2">Channel<select className={input} value={g.ch} onChange={(e) => setG({ ...g, ch: +e.target.value })}>{CHANNELS.map((c, i) => <option key={c.id} value={i}>{c.id}</option>)}</select></label>
              {(["lat", "lon", "radius", "amp"] as const).map((k) => <label key={k}>{k === "amp" ? "amount (raw unit)" : k}<input type="number" className={input} value={g[k]} onChange={(e) => setG({ ...g, [k]: +e.target.value })} /></label>)}
              <p className="col-span-2 text-slate-500">Raw units: K, mm/day, m/s, Pa, kg/m². Large shocks may be outside the training range.</p></div>}
            <div className="flex flex-wrap gap-2"><button className={btn} disabled={!base} onClick={runShock}>Run shock</button>
              <button className={btn} disabled={!shocked} onClick={certify}>Run certificate</button></div>
          </fieldset>
          <p aria-live="polite" className="mt-2 text-sm">{busy && `${busy}…`}</p>
        </aside>
        <main className="min-w-0 space-y-4">
          {!base && <div className={card}>Load an input window to run a live 10-day forecast.</div>}
          {base && meta && <>
            <section className={card}>
              <div className="mb-3 flex flex-wrap items-center gap-1">{Array.from({ length: 10 }, (_, i) => <button key={i} onClick={() => setDay(i + 1)} aria-pressed={day === i + 1}
                className={`rounded px-2.5 py-1 text-sm ${day === i + 1 ? "bg-sky-700 text-white" : "bg-slate-100"}`}>Day {i + 1}</button>)}</div>
              <div className="grid gap-3 md:grid-cols-3">{maps.map((m) => <GridMap key={m.title} {...m} unit={unit} land={meta.land_mask} cell={cell} onCell={setCell} />)}</div>
              <p className="mt-2 text-xs text-slate-500">Black line: coarse land/sea boundary from the supplied mask. It is not a political boundary.</p>
            </section>
            <section className={card}><h2 className="mb-2 font-semibold">Cell {lat(cell[0])}°N, {lon(cell[1])}°E: {CHANNELS[ch].label}</h2><LineChart series={series} unit={unit} /></section>
            {win?.truth?.[day - 1] && <section className={card}><h2 className="font-semibold">Truth vs Twin, day {day} (this window only)</h2>
              <p className="text-sm">Latitude-weighted RMSE: model <b>{latRmse(shown(base.rollout[day - 1]), shown(win.truth[day - 1])).toFixed(2)}</b> {unit}; repeat-yesterday <b>{latRmse(shown(win.init_states[2]), shown(win.truth[day - 1])).toFixed(2)}</b> {unit}.</p></section>}
            {cert && <section className={card}><h2 className="font-semibold">Shock Behaviour Certificate: {shocked?.label}</h2>
              <ul className="text-sm">{cert.map(([n, ok, d]) => <li key={n}><b className={ok ? "text-green-700" : "text-red-700"}>{ok ? "PASS" : "FAIL"}</b> {n} <span className="text-slate-500">({d})</span></li>)}</ul>
              <p className="mt-1 text-xs text-slate-500">These test model behaviour only. They do not show physical causality. Spread and amplitude limits are scored by evaluation/evaluate.py.</p></section>}
            <footer className="text-xs text-slate-600">Baseline: {base.at}, inference {base.inference_ms.toFixed(0)} ms, round trip {base.wall_ms.toFixed(0)} ms.
              {shocked && ` Shock "${shocked.label}": ${shocked.run.at}, inference ${shocked.run.inference_ms.toFixed(0)} ms.`}</footer>
          </>}
        </main>
      </div>
    </div>
  );
}
