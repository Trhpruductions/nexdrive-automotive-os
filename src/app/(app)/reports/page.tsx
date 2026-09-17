import Link from "next/link";
import { eachDayOfInterval, eachMonthOfInterval, endOfMonth, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { CircleDollarSign, Percent, Receipt, Users } from "lucide-react";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, KpiCard, PageHeader, Progress } from "@/components/ui";
import { BarChart, RevenueChart } from "@/components/app/revenue-chart";
import { money, num } from "@/lib/format";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireStaff(MANAGER_ROLES);
  const sp = await searchParams;
  const days = sp.range === "90" ? 90 : sp.range === "7" ? 7 : 30;
  const now = new Date();
  const since = subDays(startOfDay(now), days - 1);
  const prevSince = subDays(since, days);

  const [payments, prevPayments, invoices, lines, custCount, newCustomers, techs, byStatus, months] = await Promise.all([
    db.payment.findMany({ where: { paidAt: { gte: since } }, select: { amount: true, paidAt: true, method: true } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: prevSince, lt: since } } }),
    db.invoice.findMany({ where: { issuedAt: { gte: since }, status: { not: "VOID" } }, select: { total: true, tax: true, workOrder: { select: { technicianId: true, customerId: true } } } }),
    db.workOrderLine.findMany({ where: { approved: true, workOrder: { status: "INVOICED", invoice: { issuedAt: { gte: since }, status: { not: "VOID" } } } }, select: { kind: true, quantity: true, hours: true, unitPrice: true, part: { select: { cost: true } }, workOrder: { select: { technicianId: true } } } }),
    db.customer.count(),
    db.customer.count({ where: { createdAt: { gte: since } } }),
    db.technician.findMany({ where: { active: true } }),
    db.workOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    db.payment.findMany({ where: { paidAt: { gte: startOfMonth(subMonths(now, 11)) } }, select: { amount: true, paidAt: true } }),
  ]);

  const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
  const prevRevenue = Number(prevPayments._sum.amount ?? 0);
  const invoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
  const tax = invoices.reduce((s, i) => s + Number(i.tax), 0);
  const avgTicket = invoices.length ? invoiced / invoices.length : 0;
  const laborRev = lines.filter((l) => l.kind === "LABOR").reduce((s, l) => s + Number(l.hours ?? l.quantity) * Number(l.unitPrice), 0);
  const partsRev = lines.filter((l) => l.kind === "PART").reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
  const partsCost = lines.filter((l) => l.kind === "PART").reduce((s, l) => s + Number(l.quantity) * Number(l.part?.cost ?? 0), 0);
  const feesRev = lines.filter((l) => l.kind === "FEE").reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0);
  const laborHours = lines.filter((l) => l.kind === "LABOR").reduce((s, l) => s + Number(l.hours ?? l.quantity), 0);
  const partsMargin = partsRev > 0 ? (partsRev - partsCost) / partsRev : 0;

  const series = eachDayOfInterval({ start: since, end: startOfDay(now) }).map((d) => ({ date: d, label: format(d, days > 31 ? "MMM d" : "MMM d"), value: 0 }));
  for (const p of payments) {
    const idx = Math.floor((startOfDay(p.paidAt).getTime() - since.getTime()) / 86_400_000);
    if (series[idx]) series[idx].value += Number(p.amount);
  }
  const monthly = eachMonthOfInterval({ start: startOfMonth(subMonths(now, 11)), end: now }).map((m) => ({ label: format(m, "MMM"), value: months.filter((p) => p.paidAt >= m && p.paidAt <= endOfMonth(m)).reduce((s, p) => s + Number(p.amount), 0) }));
  const byMethod = ["CARD", "CASH", "CHECK", "ACH", "OTHER"].map((m) => ({ m, v: payments.filter((p) => p.method === m).reduce((s, p) => s + Number(p.amount), 0) })).filter((x) => x.v > 0);
  const techRows = techs
    .map((t) => {
      const mine = lines.filter((l) => l.workOrder.technicianId === t.id);
      const hrs = mine.filter((l) => l.kind === "LABOR").reduce((s, l) => s + Number(l.hours ?? l.quantity), 0);
      const rev = invoices.filter((i) => i.workOrder.technicianId === t.id).reduce((s, i) => s + Number(i.total), 0);
      return { ...t, hrs, rev, jobs: invoices.filter((i) => i.workOrder.technicianId === t.id).length };
    })
    .sort((a, b) => b.rev - a.rev);
  const topRev = techRows[0]?.rev || 1;
  const repeat = invoices.length ? new Set(invoices.map((i) => i.workOrder.customerId)).size : 0;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`Last ${days} days vs the ${days} before`}
        actions={
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {[7, 30, 90].map((d) => <Link key={d} href={`/reports?range=${d}`} className={`px-3 py-2 ${days === d ? "bg-accent text-white" : "hover:bg-card-hover"}`}>{d} days</Link>)}
          </div>
        }
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Collected" value={money(revenue)} icon={CircleDollarSign} tone="green" delta={{ value: prevRevenue ? (revenue - prevRevenue) / prevRevenue : 0, label: "vs prior period" }} />
        <KpiCard label="Invoiced" value={money(invoiced)} hint={`${invoices.length} invoices · avg ${money(avgTicket)}`} icon={Receipt} />
        <KpiCard label="Parts margin" value={`${(partsMargin * 100).toFixed(0)}%`} hint={`${money(partsRev)} parts sold`} icon={Percent} tone="violet" />
        <KpiCard label="Customers" value={num(custCount)} hint={`${newCustomers} new · ${repeat} served`} icon={Users} tone="amber" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="Collected by day"><RevenueChart series={series} height={220} /></Card>
        <Card title="Revenue mix">
          {[
            { label: "Labor", v: laborRev, tone: "blue" as const },
            { label: "Parts", v: partsRev, tone: "violet" as const },
            { label: "Fees & other", v: feesRev, tone: "slate" as const },
          ].map((r) => (
            <div key={r.label} className="mb-3">
              <div className="flex justify-between text-sm mb-1"><span>{r.label}</span><span className="tabular-nums">{money(r.v)} <span className="text-muted text-xs">{invoiced ? Math.round((r.v / (laborRev + partsRev + feesRev || 1)) * 100) : 0}%</span></span></div>
              <Progress value={r.v / (laborRev + partsRev + feesRev || 1)} tone={r.tone} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-border text-sm">
            <div><div className="text-[11px] uppercase tracking-wider text-muted">Labor hours</div><div className="font-medium">{laborHours.toFixed(1)} h</div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-muted">Effective rate</div><div className="font-medium">{money(laborHours ? laborRev / laborHours : 0)}/h</div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-muted">Sales tax collected</div><div className="font-medium">{money(tax)}</div></div>
            <div><div className="text-[11px] uppercase tracking-wider text-muted">Parts cost</div><div className="font-medium">{money(partsCost)}</div></div>
          </div>
        </Card>
        <Card className="xl:col-span-2" title="Monthly revenue (12 months)"><BarChart series={monthly} /></Card>
        <Card title="Payments by method">
          <ul className="space-y-2 text-sm">
            {byMethod.map((x) => <li key={x.m} className="flex justify-between"><span>{x.m[0] + x.m.slice(1).toLowerCase()}</span><span className="tabular-nums">{money(x.v)}</span></li>)}
            {!byMethod.length ? <li className="text-muted">No payments in range.</li> : null}
          </ul>
          <div className="mt-5 pt-4 border-t border-border">
            <div className="card-title mb-2">Work orders by status</div>
            <ul className="space-y-1 text-xs text-muted">
              {byStatus.map((s) => <li key={s.status} className="flex justify-between"><span>{s.status.replace("_", " ").toLowerCase()}</span><span className="tabular-nums">{s._count._all}</span></li>)}
            </ul>
          </div>
        </Card>
        <Card className="xl:col-span-3" title="Technician performance" padded={false}>
          <table className="table">
            <thead><tr><th>Technician</th><th className="text-right">Jobs invoiced</th><th className="text-right">Billed hours</th><th className="text-right">Revenue</th><th className="w-1/3">Share</th></tr></thead>
            <tbody>
              {techRows.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/technicians/${t.id}`} className="font-medium hover:text-accent">{t.name}</Link><div className="text-xs text-muted">{t.specialty}</div></td>
                  <td className="text-right tabular-nums">{t.jobs}</td>
                  <td className="text-right tabular-nums">{t.hrs.toFixed(1)}</td>
                  <td className="text-right tabular-nums font-medium">{money(t.rev)}</td>
                  <td><Progress value={t.rev / topRev} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
