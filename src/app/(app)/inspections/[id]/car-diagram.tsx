// Top-down car outline with status dots placed by inspection category / item name
// (the tablet view in the mockup). Pure SVG — renders on the server.

type Item = { name: string; category: string; result: "GOOD" | "ATTENTION" | "URGENT" | "NA" };

const FILL: Record<Item["result"], string> = { GOOD: "#22c55e", ATTENTION: "#f59e0b", URGENT: "#ef4444", NA: "#475569" };

// where each zone sits on the 200×400 canvas
const ZONES: { key: RegExp; x: number; y: number }[] = [
  { key: /front.*brake|brake.*front|rotor/i, x: 48, y: 112 },
  { key: /rear.*brake|brake.*rear|drum/i, x: 152, y: 292 },
  { key: /tire|tread|pressure|wheel/i, x: 152, y: 112 },
  { key: /light|headl|tail/i, x: 100, y: 40 },
  { key: /wiper|windshield|glass/i, x: 100, y: 130 },
  { key: /mirror/i, x: 30, y: 150 },
  { key: /engine|oil|coolant|belt|battery|air filter|hood/i, x: 100, y: 85 },
  { key: /exhaust|muffler/i, x: 70, y: 370 },
  { key: /suspension|shock|strut|steering|cv/i, x: 48, y: 292 },
  { key: /body|paint|door|bumper/i, x: 170, y: 200 },
  { key: /interior|cabin|seat|horn|dash|hvac/i, x: 100, y: 220 },
  { key: /fluid|leak/i, x: 100, y: 330 },
];

export function CarDiagram({ items }: { items: Item[] }) {
  const worst = (its: Item[]): Item["result"] => (its.some((i) => i.result === "URGENT") ? "URGENT" : its.some((i) => i.result === "ATTENTION") ? "ATTENTION" : its.every((i) => i.result === "GOOD") && its.length ? "GOOD" : "NA");
  const dots = ZONES.map((z) => {
    const matched = items.filter((i) => z.key.test(i.name) || z.key.test(i.category));
    return { ...z, result: worst(matched), count: matched.length };
  }).filter((d) => d.count > 0);

  return (
    <svg viewBox="0 0 200 400" className="w-full max-w-[220px] mx-auto h-auto" role="img" aria-label="Vehicle inspection diagram">
      <defs>
        <linearGradient id="car-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* body */}
      <path d="M60 30 Q100 12 140 30 L152 80 Q160 140 158 200 Q160 300 150 360 Q100 385 50 360 Q40 300 42 200 Q40 140 48 80 Z" fill="url(#car-body)" stroke="#334155" strokeWidth="2" />
      {/* windshield / roof / rear glass */}
      <path d="M62 96 Q100 84 138 96 L146 140 Q100 132 54 140 Z" fill="#111827" stroke="#334155" strokeWidth="1.5" />
      <rect x="56" y="150" width="88" height="110" rx="12" fill="#111827" stroke="#334155" strokeWidth="1.5" />
      <path d="M58 270 Q100 262 142 270 L148 312 Q100 322 52 312 Z" fill="#111827" stroke="#334155" strokeWidth="1.5" />
      {/* wheels */}
      {[[36, 112], [164, 112], [36, 292], [164, 292]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x - 8} y={y - 22} width="16" height="44" rx="6" fill="#020617" stroke="#475569" strokeWidth="1.5" />
      ))}
      {/* mirrors */}
      <rect x="26" y="142" width="14" height="8" rx="3" fill="#1e293b" stroke="#334155" />
      <rect x="160" y="142" width="14" height="8" rx="3" fill="#1e293b" stroke="#334155" />
      {/* status dots */}
      {dots.map((d) => (
        <g key={`${d.x}-${d.y}`}>
          <circle cx={d.x} cy={d.y} r="9" fill={FILL[d.result]} opacity="0.25" />
          <circle cx={d.x} cy={d.y} r="5" fill={FILL[d.result]} stroke="#0f1521" strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}
