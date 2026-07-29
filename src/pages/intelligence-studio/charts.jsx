// src/pages/intelligence-studio/charts.jsx
//
// Lightweight, dependency-free SVG/CSS visualizations for the Studio. Real charts over
// real data (no chart library, no placeholder art). Theme-aware via CSS variables.

export function Bars({ data = [], unit = "" }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-[11.5px] text-[color:var(--text-soft)] w-40 truncate">{d.label}</span>
          <div className="flex-1 h-3 rounded-full bg-[var(--surface-soft)] overflow-hidden">
            <div className="h-full brand-orange-bg" style={{ width: `${(100 * (Number(d.value) || 0)) / max}%` }} />
          </div>
          <span className="text-[11.5px] tabular-nums text-[color:var(--text)] w-14 text-right">{d.value}{unit}</span>
        </div>
      ))}
    </div>
  );
}

/** Deciles distribution (10 vertical bars). */
export function Distribution({ values = [] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1 h-28">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full brand-orange-bg rounded-t" style={{ height: `${(100 * v) / max}%`, minHeight: v ? 2 : 0 }} title={`${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}: ${v}`} />
          <span className="text-[9px] text-[color:var(--text-soft)]">{(i / 10).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

/** Calibration curve: predicted (x) vs observed (y), with the ideal diagonal. */
export function CalibrationCurve({ buckets = [] }) {
  const W = 260, H = 200, pad = 24;
  const sx = (x) => pad + x * (W - 2 * pad);
  const sy = (y) => H - pad - y * (H - 2 * pad);
  const pts = buckets.filter((b) => b.predicted != null && b.observed != null).map((b) => `${sx(b.predicted)},${sy(b.observed)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[320px]">
      <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="none" stroke="var(--border)" />
      <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--text-soft)" strokeDasharray="4 3" />
      {pts && <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2" />}
      {buckets.map((b, i) => b.predicted != null && <circle key={i} cx={sx(b.predicted)} cy={sy(b.observed)} r="3" fill="var(--primary)" />)}
      <text x={pad} y={H - 6} fontSize="9" fill="var(--text-soft)">predicted →</text>
      <text x={4} y={pad} fontSize="9" fill="var(--text-soft)">observed</text>
    </svg>
  );
}

/** Pipeline flow: Events → Evidence → … → Memory, with live counts. */
export function PipelineFlow({ stages = [] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-1.5">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1.5">
          <div className="rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-center min-w-[74px]">
            <div className="text-[15px] font-semibold text-[color:var(--text)] tabular-nums">{s.count ?? "—"}</div>
            <div className="text-[10px] text-[color:var(--text-soft)] tracking-tight">{s.label}</div>
          </div>
          {i < stages.length - 1 && <span className="text-[color:var(--text-soft)]">→</span>}
        </div>
      ))}
    </div>
  );
}
