import Link from "next/link";
import { AlertTriangle, CircleDollarSign, Factory, Gauge, Hammer, Package, Truck } from "lucide-react";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { db } from "@/lib/db";
import { Badge, Card, KpiCard, Progress, ViewAll } from "@/components/ui";
import { LiveFloor } from "@/app/(app)/production/live-floor";
import { productionSnapshot } from "@/lib/integrations/snapshot";
import { diesDueForService, jobNumber, pressDay } from "@/lib/production";
import { fmtDate, greeting, money, num } from "@/lib/format";
import type { ShopSettings } from "@/lib/settings";

/** Owner / manager dashboard for a manufacturing shop: presses, jobs, output, tooling, shipments, money. */
export async function ProductionDashboard({ settings, userName }: { settings: ShopSettings; userName: string }) {
  const now = new Date();
  const today = { gte: startOfDay(now), lte: endOfDay(now) };
  const [snap, presses, jobs, lateJobs, todayCounts, diesDue, shipmentsWeek, openInvoices, lowMaterial, readyToShip] = await Promise.all([
    productionSnapshot(),
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, status: true } }),
    db.productionJob.findMany({ where: { status: { in: ["RUNNING", "PAUSED", "RELEASED", "PLANNED"] } }, include: { part: { select: { sku: true, name: true } }, customer: { select: { company: true, firstName: true, lastName: true } }, machine: { select: { code: true } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 8 }),
    db.productionJob.count({ where: { status: { in: ["RUNNING", "PAUSED", "RELEASED", "PLANNED"] }, dueAt: { lt: now } } }),
    db.machineEvent.aggregate({ _sum: { good: true, scrap: true }, where: { type: "COUNT", occurredAt: today, machine: { active: true } } }),
    diesDueForService(),
    db.shipment.findMany({ where: { status: "SHIPPED", shipDate: { gte: subDays(now, 7) } }, include: { lines: { select: { quantity: true, unitPrice: true } } } }),
    db.invoice.aggregate({ _sum: { total: true, amountPaid: true }, _count: { _all: true }, where: { status: { in: ["SENT", "PARTIAL"] } } }),
    db.part.findMany({ where: { kind: "MATERIAL", active: true }, select: { id: true, sku: true, name: true, unit: true, quantityOnHand: true, reorderPoint: true } }),
    db.productionJob.findMany({ where: { status: "COMPLETE" }, select: { good: true, shipped: true } }),
  ]);
  const oee = await Promise.all(presses.map(async (p) => ({ code: p.code, ...(await pressDay(p.id, now)) })));
  const withOee = oee.filter((o) => o.oee != null);
  const avgOee = withOee.length ? withOee.reduce((s, o) => s + (o.oee ?? 0), 0) / withOee.length : null;
  const good = todayCounts._sum.good ?? 0;
  const scrap = todayCounts._sum.scrap ?? 0;
  const running = presses.filter((p) => p.status === "RUNNING").length;
  const down = presses.filter((p) => p.status === "DOWN").length;
  const shippedPcs = shipmentsWeek.reduce((s, sh) => s + sh.lines.reduce((a, l) => a + l.quantity, 0), 0);
  const shippedValue = shipmentsWeek.reduce((s, sh) => s + sh.lines.reduce((a, l) => a + l.quantity * Number(l.unitPrice), 0), 0);
  const arOpen = Number(openInvoices._sum.total ?? 0) - Number(openInvoices._sum.amountPaid ?? 0);
  const readyPcs = readyToShip.reduce((s, j) => s + Math.max(0, j.good - j.shipped), 0);
  const lowMat = lowMaterial.filter((m) => m.quantityOnHand <= m.reorderPoint);
  const order = { RUNNING: 0, PAUSED: 1, RELEASED: 2, PLANNED: 3, COMPLETE: 4, CANCELLED: 5 } as const;
  jobs.sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}, {userName}</h1>
        <p className="text-sm text-muted mt-1">The floor at {settings.name} right now.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard label="Presses running" value={`${running} / ${presses.length}`} hint={down ? `${down} down` : "none down"} icon={Factory} tone={down ? "red" : "green"} href="/production" />
        <KpiCard label="Pieces today" value={num(good)} hint={`${scrap} scrap · ${good + scrap ? ((scrap / (good + scrap)) * 100).toFixed(1) : "0.0"}%`} icon={Package} tone={good + scrap && scrap / (good + scrap) > 0.03 ? "amber" : "slate"} href="/production/report" />
        <KpiCard label="OEE today" value={avgOee == null ? "—" : `${Math.round(avgOee * 100)}%`} icon={Gauge} tone={avgOee == null ? "slate" : avgOee >= 0.85 ? "green" : avgOee >= 0.6 ? "amber" : "red"} href="/production/report" />
        <KpiCard label="Late jobs" value={lateJobs} icon={AlertTriangle} tone={lateJobs ? "red" : "green"} href="/jobs" />
        <KpiCard label="Ready to ship" value={num(readyPcs)} hint="pcs from complete jobs" icon={Truck} tone={readyPcs ? "blue" : "slate"} href="/shipments/new" />
        <KpiCard label="Open invoices" value={money(arOpen)} hint={`${openInvoices._count._all} unpaid`} icon={CircleDollarSign} tone={arOpen ? "amber" : "green"} href="/invoices" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-7" title="Live floor" action={<ViewAll href="/production" />}>
          <LiveFloor initial={snap} />
        </Card>
        <Card className="xl:col-span-5" title="Jobs on the floor" action={<ViewAll href="/jobs" />} padded={false}>
          <ul className="divide-y divide-border">
            {jobs.map((j) => {
              const pct = j.quantity ? Math.min(1, j.good / j.quantity) : 0;
              const late = j.dueAt && j.dueAt < now;
              return (
                <li key={j.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/jobs/${j.id}`} className="font-semibold text-sm hover:text-accent">{jobNumber(j.number)} <span className="font-normal text-muted">· {j.part.sku}</span></Link>
                    <Badge tone={j.status === "RUNNING" ? "green" : j.status === "PAUSED" ? "amber" : "slate"}>{j.status.toLowerCase()}</Badge>
                  </div>
                  <div className="text-xs text-muted truncate">{j.customer.company ?? `${j.customer.firstName} ${j.customer.lastName}`}{j.machine ? ` · ${j.machine.code}` : ""}{j.dueAt ? <span className={late ? " text-red-400 font-semibold" : ""}> · due {fmtDate(j.dueAt)}</span> : null}</div>
                  <div className="flex items-center gap-2 mt-1.5"><Progress value={pct} tone={pct >= 1 ? "green" : "blue"} className="flex-1" /><span className="text-[11px] tabular-nums text-muted">{num(j.good)} / {num(j.quantity)}</span></div>
                </li>
              );
            })}
            {!jobs.length ? <li className="px-5 py-8 text-center text-sm text-muted">No open jobs. <Link href="/jobs/new" className="text-accent">Create one</Link>.</li> : null}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Tooling" action={<ViewAll href="/tooling" />}>
          {diesDue.length ? (
            <ul className="text-sm space-y-2">{diesDue.map((d) => <li key={d.id} className="flex items-center justify-between"><Link href={`/tooling/${d.id}`} className="hover:text-accent"><Hammer size={13} className="inline mr-1 text-red-400" />{d.code} <span className="text-muted">· {d.name}</span></Link><Badge tone="red">service due</Badge></li>)}</ul>
          ) : <p className="text-sm text-muted">No dies past their service interval.</p>}
        </Card>
        <Card title="Material" action={<ViewAll href="/parts?filter=low" />}>
          {lowMat.length ? (
            <ul className="text-sm space-y-2">{lowMat.map((m) => <li key={m.id} className="flex items-center justify-between"><span>{m.name}</span><span className="text-amber-400 tabular-nums">{num(m.quantityOnHand)} {m.unit}</span></li>)}</ul>
          ) : <p className="text-sm text-muted">All coil and stock above reorder points.</p>}
        </Card>
        <Card title="Shipped this week" action={<ViewAll href="/shipments" />}>
          <div className="text-2xl font-semibold">{num(shippedPcs)} <span className="text-sm font-normal text-muted">pieces</span></div>
          <div className="text-sm text-muted">{money(shippedValue)} across {shipmentsWeek.length} shipment{shipmentsWeek.length === 1 ? "" : "s"}</div>
        </Card>
      </div>
    </div>
  );
}
