export interface Series { name: string; values: number[]; color: string; dash?: string }

export function LineChart({ series, unit }: { series: Series[]; unit: string }) {
  const all = series.flatMap((s) => s.values);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const x = (i: number) => 60 + (i * 516) / 9, y = (v: number) => 165 - ((v - lo) / (hi - lo)) * 138;

  return (
    <div className="rounded-2xl border border-twilight-border bg-twilight-base/60 p-4 shadow-inner">
      <svg viewBox="0 0 600 200" className="w-full tabular-nums" role="img" aria-label={`Ten day series in ${unit}`}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}>
            <line x1={60} x2={576} y1={y(v)} y2={y(v)} stroke="#475D6B" strokeDasharray="3 3" strokeWidth={1} />
            <text x={52} y={y(v) + 4} fontSize={11} fill="#A9BDC8" textAnchor="end" fontWeight={500}>{v.toFixed(1)}</text>
          </g>
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <text key={i} x={x(i)} y={190} fontSize={11} fill="#829AA7" textAnchor="middle" fontWeight={600}>D{i + 1}</text>
        ))}
        {series.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dash}
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
          />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3.5 border-t border-twilight-border/80 pt-3 text-xs text-text-main">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 font-medium">
            <span className="inline-block h-1 w-4 rounded-full shadow-xs" style={{ backgroundColor: s.color }} />
            <span className="text-text-bright">{s.name}</span>
            <span className="font-mono text-text-subtle">({unit})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
