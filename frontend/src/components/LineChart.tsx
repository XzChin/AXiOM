export interface Series { name: string; values: number[]; color: string; dash?: string }
export function LineChart({ series, unit }: { series: Series[]; unit: string }) {
  const all = series.flatMap((s) => s.values);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const x = (i: number) => 52 + (i * 530) / 9, y = (v: number) => 170 - ((v - lo) / (hi - lo)) * 150;
  return (
    <div>
      <svg viewBox="0 0 600 200" className="w-full" role="img" aria-label={`Ten day series in ${unit}`}>
        {[lo, (lo + hi) / 2, hi].map((v) => (
          <g key={v}><line x1={52} x2={582} y1={y(v)} y2={y(v)} stroke="#e2e8f0" /><text x={46} y={y(v) + 4} fontSize={11} textAnchor="end">{v.toFixed(1)}</text></g>
        ))}
        {Array.from({ length: 10 }, (_, i) => <text key={i} x={x(i)} y={190} fontSize={11} textAnchor="middle">D{i + 1}</text>)}
        {series.map((s) => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />)}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs">{series.map((s) => <span key={s.name}><b style={{ color: s.color }}>━</b> {s.name} ({unit})</span>)}</div>
    </div>
  );
}
