import Link from "next/link";
import { subDays } from "date-fns";
import { AlertTriangle, ClipboardCheck, Package, Truck } from "lucide-react";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, KpiCard, PageHeader, Progress } from "@/components/ui";
import { fmtDate, num } from "@/lib/format";
import { jobNumber, shiftAt, shiftsFor } from "@/lib/production";
import { QC_KIND, qualityQueue } from "@/lib/quality";

export const metadata = { title: "Production reports" };

const RANGES = [7, 30, 90] as const;

/**
 * The manager's weekly look: where scrap goes (Pareto by reason, die and
 * product), how checks are going, whether orders ship on time, and output by
 * shift — over 7 / 30 / 90 days.
 */
export default async function ProductionReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const days = (RANGES as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 30;
  const since = subDays(new Date(), days);
  const [runs, scrap, checks, completed, shifts, queue, dies] = await Promise.all([
    db.productionRun.findMany({ where: { startedAt: { gte: since } }, include: { job: { select: { id: true, number: true, dieId: true, partId: true, part: { select: { sku: true } } } }, machine: { select: { code: true } } } }),
    db.scrapEntry.findMany({ where: { at: { gte: since } }, include: { job: { select: { partId: true, part: { select: { sku: true } } } } } }),
    db.qualityCheck.findMany({ where: { checkedAt: { gte: since } }, include: { job: { select: { id: true, number: true, part: { select: { sku: true } } } } }, orderBy: { checkedAt: "desc" } }),
    db.productionJob.findMany({ where: { status: "COMPLETE", completedAt: { gte: since } }, include: { part: { select: { sku: true } }, customer: { select: { company: true, firstName: true, lastName: true } }, shipmentLines: { include: { shipment: { select: { shipDate: true, status: true } } } } } }),
    shiftsFor(),
    qualityQueue(),
    db.die.findMany({ select: { id: true, code: true } }),
  ]);
  const dieCode = (id: string | null) => dies.find((d) => d.id === id)?.code ?? "no die";
  const good = runs.reduce((s, r) => s + r.good, 0);
  const scrapTotal = runs.reduce((s, r) => s + r.scrap, 0);
  const classified = scrap.reduce((s, e) => s + e.quantity, 0);
  const scrapRate = good + scrapTotal ? scrapTotal / (good + scrapTotal) : 0;

  // Pareto by reason (unclassified = counted scrap not logged with a reason)
  const byReason = Object.entries(scrap.reduce<Record<string, number>>((acc, e) => { acc[e.reason] = (acc[e.reason] ?? 0) + e.quantity; return acc; }, {}));
  if (scrapTotal > classified) byReason.push(["Unclassified", scrapTotal - classified]);
  byReason.sort((a, b) => b[1] - a[1]);
  let cum = 0;
  const pareto = byReason.map(([reason, qty]) => { cum += qty; return { reason, qty, share: scrapTotal ? qty / scrapTotal : 0, cum: scrapTotal ? cum / scrapTotal : 0 }; });

  // scrap % by die and by product from run counts
  const group = (key: (r: (typeof runs)[number]) => string) => {
    const m = new Map<string, { good: number; scrap: number }>();
    for (const r of runs) { const k = key(r); const v = m.get(k) ?? { good: 0, scrap: 0 }; v.good += r.good; v.scrap += r.scrap; m.set(k, v); }
    return [...m.entries()].map(([k, v]) => ({ k, ...v, rate: v.good + v.scrap ? v.scrap / (v.good + v.scrap) : 0 })).filter((x) => x.good + x.scrap > 0).sort((a, b) => b.scrap - a.scrap);
  };
  const byDie = group((r) => dieCode(r.dieId ?? r.job.dieId));
  const byProduct = group((r) => r.job.part.sku);
  const byShift = group((r) => r.shift ?? shiftAt(shifts, r.startedAt) ?? "unassigned");
  const byPress = group((r) => r.machine.code);

  // quality
  const passes = checks.filter((c) => c.result === "PASS").length;
  const fails = checks.filter((c) => c.result === "FAIL");

  // on-time delivery: completed before due, and first shipment on/before due
  const withDue = completed.filter((j) => j.dueAt);
  const onTime = withDue.filter((j) => {
    const shipped = j.shipmentLines.map((l) => l.shipment.shipDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
    const done = shipped ?? j.completedAt!;
    return done <= j.dueAt!;
  });
  const late = withDue.filter((j) => !onTime.includes(j));

  return (
    <div>
      <PageHeader
        title="Production reports"
        subtitle={`Last ${days} days · ${num(good)} good pieces, ${num(scrapTotal)} scrap across ${runs.length} runs`}
        crumbs={[{ label: "Production", href: "/production" }, { label: "Reports" }]}
        actions={<div className="flex gap-1.5">{RANGES.map((r) => <Link key={r} href={`/production/reports?days=${r}`} className={`rounded-full px-3 py-1 text-xs font-medium border ${days === r ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{r} days</Link>)}<Link href="/production/report" className="rounded-full px-3 py-1 text-xs font-medium border border-border text-muted hover:text-text">Shift & OEE by day</Link></div>}
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Scrap rate" value={`${(scrapRate * 100).toFixed(1)}%`} icon={AlertTriangle} tone={scrapRate > 0.03 ? "amber" : "green"} hint={`${num(scrapTotal)} of ${num(good + scrapTotal)} pieces`} />
        <KpiCard label="Checks passed" value={checks.length ? `${Math.round((passes / checks.length) * 100)}%` : "—"} icon={ClipboardCheck} tone={fails.length ? "amber" : "green"} hint={`${checks.length} checks · ${fails.length} failed`} />
        <KpiCard label="On-time delivery" value={withDue.length ? `${Math.round((onTime.length / withDue.length) * 100)}%` : "—"} icon={Truck} tone={late.length ? "amber" : "green"} hint={`${onTime.length} of ${withDue.length} orders with a due date`} />
        <KpiCard label="Needs an inspector" value={queue.length} icon={Package} tone={queue.length ? "red" : "slate"} hint="holds, first pieces, checks due" />
      </div>

      {queue.length ? (
        <Card className="mb-4" title="Needs an inspector now" padded={false}>
          <ul className="divide-y divide-border">
            {queue.map(({ job, need }) => (
              <li key={job.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <Badge tone={need === "hold" ? "red" : need === "first_piece" ? "amber" : "blue"}>{need === "hold" ? "on hold" : need === "first_piece" ? "first piece" : "check due"}</Badge>
                <Link href={`/jobs/${job.id}`} className="font-medium hover:text-accent">{jobNumber(job.number)}</Link>
                <span className="text-muted">· {job.part.sku}{job.machine ? ` · ${job.machine.code}` : ""}{need === "hold" && job.holdReason ? ` · ${job.holdReason}` : ""}</span>
                <Link href={`/jobs/${job.id}/check${need === "first_piece" ? "?kind=FIRST_PIECE" : ""}`} className="ml-auto btn btn-secondary btn-sm">Check</Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title="Scrap Pareto — by reason" padded={false} action={<span className="text-xs text-muted">{scrapTotal > classified ? `${num(scrapTotal - classified)} pcs without a reason` : "all scrap has a reason"}</span>}>
          <table className="table">
            <thead><tr><th>Reason</th><th className="w-48">Share</th><th className="text-right">Pieces</th><th className="text-right">Cum.</th></tr></thead>
            <tbody>
              {pareto.map((p) => (
                <tr key={p.reason}>
                  <td className={`text-sm ${p.reason === "Unclassified" ? "text-muted italic" : ""}`}>{p.reason}</td>
                  <td><Progress value={p.share} tone={p.cum <= 0.8 ? "amber" : "slate"} /></td>
                  <td className="text-right tabular-nums">{num(p.qty)}</td>
                  <td className="text-right tabular-nums text-xs text-muted">{Math.round(p.cum * 100)}%</td>
                </tr>
              ))}
              {!pareto.length ? <tr><td colSpan={4} className="text-center text-muted py-6">No scrap in this period.</td></tr> : null}
            </tbody>
          </table>
          {pareto.length ? <p className="px-5 py-2 text-xs text-muted border-t border-border">Highlighted reasons make up the first 80% — fix those first.</p> : null}
        </Card>

        <Card title="Scrap by die" padded={false}>
          <table className="table">
            <thead><tr><th>Die</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th className="w-40">Rate</th></tr></thead>
            <tbody>
              {byDie.slice(0, 12).map((x) => (
                <tr key={x.k}>
                  <td className="font-medium">{x.k}</td>
                  <td className="text-right tabular-nums">{num(x.good)}</td>
                  <td className="text-right tabular-nums">{num(x.scrap)}</td>
                  <td><div className="flex items-center gap-2"><Progress value={Math.min(1, x.rate / 0.1)} tone={x.rate > 0.03 ? "red" : "green"} className="flex-1" /><span className={`text-xs tabular-nums w-12 text-right ${x.rate > 0.03 ? "text-red-400" : "text-muted"}`}>{(x.rate * 100).toFixed(1)}%</span></div></td>
                </tr>
              ))}
              {!byDie.length ? <tr><td colSpan={4} className="text-center text-muted py-6">No runs in this period.</td></tr> : null}
            </tbody>
          </table>
        </Card>

        <Card title="Scrap by product" padded={false}>
          <table className="table">
            <thead><tr><th>Product</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th className="w-40">Rate</th></tr></thead>
            <tbody>
              {byProduct.slice(0, 12).map((x) => (
                <tr key={x.k}>
                  <td className="font-medium">{x.k}</td>
                  <td className="text-right tabular-nums">{num(x.good)}</td>
                  <td className="text-right tabular-nums">{num(x.scrap)}</td>
                  <td><div className="flex items-center gap-2"><Progress value={Math.min(1, x.rate / 0.1)} tone={x.rate > 0.03 ? "red" : "green"} className="flex-1" /><span className={`text-xs tabular-nums w-12 text-right ${x.rate > 0.03 ? "text-red-400" : "text-muted"}`}>{(x.rate * 100).toFixed(1)}%</span></div></td>
                </tr>
              ))}
              {!byProduct.length ? <tr><td colSpan={4} className="text-center text-muted py-6">No runs in this period.</td></tr> : null}
            </tbody>
          </table>
        </Card>

        <Card title="Output by shift and press" padded={false}>
          <table className="table">
            <thead><tr><th>Shift</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th className="text-right">Rate</th></tr></thead>
            <tbody>
              {byShift.sort((a, b) => a.k.localeCompare(b.k)).map((x) => <tr key={x.k}><td className="font-medium">{x.k}</td><td className="text-right tabular-nums">{num(x.good)}</td><td className="text-right tabular-nums text-muted">{num(x.scrap)}</td><td className={`text-right tabular-nums text-xs ${x.rate > 0.03 ? "text-red-400" : "text-muted"}`}>{(x.rate * 100).toFixed(1)}%</td></tr>)}
              {!byShift.length ? <tr><td colSpan={4} className="text-center text-muted py-6">No runs in this period.</td></tr> : null}
            </tbody>
          </table>
          <table className="table border-t border-border">
            <thead><tr><th>Press</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th className="text-right">Rate</th></tr></thead>
            <tbody>
              {byPress.sort((a, b) => a.k.localeCompare(b.k)).map((x) => <tr key={x.k}><td className="font-medium">{x.k}</td><td className="text-right tabular-nums">{num(x.good)}</td><td className="text-right tabular-nums text-muted">{num(x.scrap)}</td><td className={`text-right tabular-nums text-xs ${x.rate > 0.03 ? "text-red-400" : "text-muted"}`}>{(x.rate * 100).toFixed(1)}%</td></tr>)}
            </tbody>
          </table>
        </Card>

        <Card title="Failed checks" padded={false} action={<span className="text-xs text-muted">{checks.length} checks · {passes} passed</span>}>
          <table className="table">
            <thead><tr><th>When</th><th>Job</th><th>Check</th><th className="text-right">At pcs</th><th>Out of tolerance</th></tr></thead>
            <tbody>
              {fails.slice(0, 15).map((c) => {
                const bad = (c.measurements as { name: string; ok: boolean; actual: number | null }[]).filter((m) => !m.ok);
                return (
                  <tr key={c.id}>
                    <td className="text-xs whitespace-nowrap">{fmtDate(c.checkedAt)}</td>
                    <td><Link href={`/jobs/${c.job.id}`} className="font-medium hover:text-accent">{jobNumber(c.job.number)}</Link><div className="text-xs text-muted">{c.job.part.sku}</div></td>
                    <td className="text-xs">{QC_KIND[c.kind]}</td>
                    <td className="text-right tabular-nums">{num(c.pieceCount)}</td>
                    <td className="text-xs text-muted">{bad.map((m) => `${m.name}${m.actual != null ? ` ${m.actual}` : ""}`).join(", ") || c.notes || "—"}</td>
                  </tr>
                );
              })}
              {!fails.length ? <tr><td colSpan={5} className="text-center text-muted py-6">{checks.length ? "Every check passed." : "No checks recorded in this period."}</td></tr> : null}
            </tbody>
          </table>
        </Card>

        <Card title="Late orders" padded={false} action={<span className="text-xs text-muted">{onTime.length} on time · {late.length} late · {completed.length - withDue.length} without a due date</span>}>
          <table className="table">
            <thead><tr><th>Job</th><th>Customer</th><th>Due</th><th>Done</th><th className="text-right">Days late</th></tr></thead>
            <tbody>
              {late.slice(0, 15).map((j) => {
                const shipped = j.shipmentLines.map((l) => l.shipment.shipDate).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0];
                const done = shipped ?? j.completedAt!;
                return (
                  <tr key={j.id}>
                    <td><Link href={`/jobs/${j.id}`} className="font-medium hover:text-accent">{jobNumber(j.number)}</Link><div className="text-xs text-muted">{j.part.sku}{j.customerPo ? ` · PO ${j.customerPo}` : ""}</div></td>
                    <td className="text-xs">{j.customer.company ?? `${j.customer.firstName} ${j.customer.lastName}`}</td>
                    <td className="text-xs text-muted">{fmtDate(j.dueAt)}</td>
                    <td className="text-xs text-muted">{fmtDate(done)}{shipped ? "" : " (made)"}</td>
                    <td className="text-right tabular-nums text-red-400">{Math.ceil((done.getTime() - j.dueAt!.getTime()) / 86_400_000)}</td>
                  </tr>
                );
              })}
              {!late.length ? <tr><td colSpan={5} className="text-center text-muted py-6">{withDue.length ? "Everything shipped on time." : "No completed orders with a due date in this period."}</td></tr> : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
