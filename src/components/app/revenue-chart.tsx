// Server-rendered SVG area chart (no client JS) — matches the mockup's blue revenue curve.
export function RevenueChart({ series, height = 180 }: { series: { label: string; value: number }[]; height?: number }) {
  const w = 640;
  const h = height;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const max = Math.max(1, ...series.map((s) => s.value));
  const niceMax = niceCeil(max);
  const n = series.length;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - v / niceMax) * (h - padT - padB);

  const pts = series.map((s, i) => [x(i), y(s.value)] as const);
  const line = pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const ticks = 4;
  const labelEvery = Math.max(1, Math.round(n / 6));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Revenue chart">
      <defs>
        <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = (niceMax / ticks) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)">
              {shortMoney(v)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#rev-fill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.length ? <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" /> : null}
      {series.map((s, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={x(i)} y={h - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="10" fill="var(--text-muted)">
            {s.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * p;
}

function shortMoney(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
  return `$${v.toFixed(0)}`;
}

/** Simple bar chart used on the reports page. */
export function BarChart({ series, height = 200, color = "var(--accent)" }: { series: { label: string; value: number }[]; height?: number; color?: string }) {
  const w = 640;
  const h = height;
  const padL = 44;
  const padB = 26;
  const padT = 10;
  const max = niceCeil(Math.max(1, ...series.map((s) => s.value)));
  const n = series.length;
  const slot = (w - padL - 8) / Math.max(1, n);
  const bw = Math.max(4, slot * 0.6);
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Bar chart">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={w - 8} y1={y(max * f)} y2={y(max * f)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(max * f) + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)">{shortMoney(max * f)}</text>
        </g>
      ))}
      {series.map((s, i) => (
        <g key={i}>
          <rect x={padL + i * slot + (slot - bw) / 2} y={y(s.value)} width={bw} height={Math.max(0, y(0) - y(s.value))} rx="3" fill={color} opacity="0.9" />
          <text x={padL + i * slot + slot / 2} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{s.label}</text>
        </g>
      ))}
    </svg>
  );
}
