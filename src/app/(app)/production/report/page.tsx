import Link from "next/link";
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, Gauge, Package } from "lucide-react";
import { addDays, format, parseISO, startOfDay, subDays } from "date-fns";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, KpiCard, PageHeader, Progress } from "@/components/ui";
import { num } from "@/lib/format";
import { pressDay, shiftsFor, shiftAt } from "@/lib/production";

export const metadata = { title: "Shift & OEE report" };

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const tone = (v: number | null): "green" | "amber" | "red" | "slate" => (v == null ? "slate" : v >= 0.85 ? "green" : v >= 0.6 ? "amber" : "red");

/** OEE per press for a day, shift output, downtime reasons, scrap. */
export default async function ProductionReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const day = sp.date ? startOfDay(parseISO(sp.date)) : startOfDay(new Date());
  const [presses, shifts] = await Promise.all([db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" } }), shiftsFor()]);
  const rows = await Promise.all(presses.map(async (p) => ({ press: p, d: await pressDay(p.id, day) })));
  const good = rows.reduce((s, r) => s + r.d.good, 0);
  const scrap = rows.reduce((s, r) => s + r.d.scrap, 0);
  const withOee = rows.filter((r) => r.d.oee != null);
  const avgOee = withOee.length ? withOee.reduce((s, r) => s + (r.d.oee ?? 0), 0) / withOee.length : null;
  const downtime = rows.reduce((s, r) => s + r.d.downtime, 0);
  // per-shift output from runs + downtime reasons
  const byShift: Record<string, { good: number; scrap: number; downtime: number }> = {};
  const reasons: Record<string, number> = {};
  for (const r of rows) for (const run of r.d.runs) {
    const key = run.shift ?? shiftAt(shifts, run.startedAt) ?? "unassigned";
    byShift[key] = byShift[key] ?? { good: 0, scrap: 0, downtime: 0 };
    byShift[key].good += run.good; byShift[key].scrap += run.scrap; byShift[key].downtime += run.downtimeMinutes;
    if (run.downtimeReason) reasons[run.downtimeReason] = (reasons[run.downtimeReason] ?? 0) + Math.max(run.downtimeMinutes, 1);
  }
  const d = (x: Date) => format(x, "yyyy-MM-dd");
  return (
    <div>
      <PageHeader
        title="Shift & OEE report"
        subtitle={format(day, "EEEE, MMMM d, yyyy")}
        crumbs={[{ label: "Production", href: "/production" }, { label: "Report" }]}
        actions={<div className="flex items-center rounded-lg border border-border overflow-hidden"><Link href={`/production/report?date=${d(subDays(day, 1))}`} className="px-2.5 py-2 hover:bg-card-hover"><ChevronLeft size={16} /></Link><Link href="/production/report" className="px-3 py-2 text-sm border-x border-border hover:bg-card-hover">Today</Link><Link href={`/production/report?date=${d(addDays(day, 1))}`} className="px-2.5 py-2 hover:bg-card-hover"><ChevronRight size={16} /></Link></div>}
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Good pieces" value={num(good)} icon={Package} tone="green" />
        <KpiCard label="Scrap" value={`${num(scrap)} (${good + scrap ? ((scrap / (good + scrap)) * 100).toFixed(1) : 0}%)`} icon={AlertTriangle} tone={good + scrap && scrap / (good + scrap) > 0.03 ? "amber" : "slate"} />
        <KpiCard label="Average OEE" value={pct(avgOee)} icon={Gauge} tone={tone(avgOee)} hint="availability × performance × quality" />
        <KpiCard label="Downtime" value={`${Math.round(downtime)} min`} icon={Activity} tone={downtime > 120 ? "amber" : "slate"} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Presses" padded={false}>
          <table className="table">
            <thead><tr><th>Press</th><th className="text-right">Run time</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th>Availability</th><th>Performance</th><th>Quality</th><th>OEE</th></tr></thead>
            <tbody>
              {rows.map(({ press, d: x }) => (
                <tr key={press.id}>
                  <td><Link href={`/production/${press.id}`} className="font-medium hover:text-accent">{press.code}</Link><div className="text-xs text-muted">{press.name}{x.idealRate ? ` · std ${num(x.idealRate)}/h` : ""}</div></td>
                  <td className="text-right tabular-nums text-xs">{(x.runMin / 60).toFixed(1)} / {(x.plannedMin / 60).toFixed(1)} h</td>
                  <td className="text-right tabular-nums">{num(x.good)}</td>
                  <td className="text-right tabular-nums text-muted">{x.scrap}</td>
                  <td><div className="flex items-center gap-2"><Progress value={x.availability} tone={tone(x.availability)} className="w-16" /><span className="text-xs tabular-nums">{pct(x.availability)}</span></div></td>
                  <td className="text-xs tabular-nums">{pct(x.performance)}</td>
                  <td className="text-xs tabular-nums">{pct(x.quality)}</td>
                  <td><Badge tone={tone(x.oee)}>{pct(x.oee)}</Badge></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8} className="text-center text-muted py-8">No presses yet.</td></tr> : null}
            </tbody>
          </table>
          <p className="px-5 py-3 text-[11px] text-faint border-t border-border">Planned time = the shifts under Settings → Rates &amp; hours ({shifts.map((s) => `${s.name} ${s.start}–${s.end}`).join(", ")}). Performance needs a standard rate on the product; quality needs counts with scrap.</p>
        </Card>
        <div className="space-y-4">
          <Card title="By shift" padded={false}>
            <table className="table">
              <thead><tr><th>Shift</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th className="text-right">Downtime</th></tr></thead>
              <tbody>
                {shifts.map((s) => { const v = byShift[s.name]; return <tr key={s.name}><td>{s.name} <span className="text-xs text-muted">{s.start}–{s.end}</span></td><td className="text-right tabular-nums">{num(v?.good ?? 0)}</td><td className="text-right tabular-nums text-muted">{v?.scrap ?? 0}</td><td className="text-right tabular-nums text-muted">{v?.downtime ? `${v.downtime} min` : "—"}</td></tr>; })}
              </tbody>
            </table>
          </Card>
          <Card title="Downtime reasons">
            {Object.keys(reasons).length ? (
              <ul className="text-sm space-y-1.5">{Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([r, m]) => <li key={r} className="flex justify-between"><span>{r}</span><span className="tabular-nums text-muted">{m} min</span></li>)}</ul>
            ) : <p className="text-sm text-muted">No downtime reasons logged — operators enter them when pausing a job or adding counts.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
