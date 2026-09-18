import Link from "next/link";
import { Bell, Car, ChevronRight, ClipboardCheck, Receipt } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Flash } from "@/components/ui";
import { OrdersHome } from "./orders-home";
import { INVOICE_STATUS, WO_STATUS } from "@/lib/constants";
import { computeTotals } from "@/lib/money";
import { fmtDate, fmtDateTime, invNumber, money, num, vehicleName, woNumber } from "@/lib/format";

export async function generateMetadata() {
  const s = await getSettings();
  return { title: s.modules.includes("jobs") ? "My orders" : `My ${s.terms.assets.toLowerCase()}` };
}

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireCustomer();
  const s = await getSettings();
  const sp = await searchParams;
  if (s.modules.includes("jobs")) {
    const me = await db.customer.findUniqueOrThrow({ where: { id: user.customerId }, select: { firstName: true, company: true } });
    return (
      <div>
        <Flash searchParams={sp} />
        <OrdersHome customerId={user.customerId} firstName={me.firstName} company={me.company} />
      </div>
    );
  }
  const c = await db.customer.findUniqueOrThrow({
    where: { id: user.customerId },
    include: {
      vehicles: { orderBy: { createdAt: "asc" }, include: { reminders: { where: { completed: false } }, workOrders: { orderBy: { createdAt: "desc" }, take: 1 } } },
      workOrders: { where: { status: { notIn: ["CANCELLED"] } }, orderBy: { updatedAt: "desc" }, include: { vehicle: true, lines: true, invoice: true, inspection: { include: { items: true } } } },
      appointments: { where: { scheduledStart: { gte: new Date() }, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, orderBy: { scheduledStart: "asc" }, take: 3, include: { vehicle: true } },
      invoices: { where: { status: { in: ["SENT", "PARTIAL"] } }, orderBy: { issuedAt: "desc" } },
    },
  });
  const active = c.workOrders.filter((w) => !["INVOICED", "CANCELLED"].includes(w.status));
  const awaiting = active.filter((w) => w.status === "AWAITING_APPROVAL");
  const history = c.workOrders.filter((w) => w.status === "INVOICED").slice(0, 8);
  const due = c.invoices.reduce((sum, i) => sum + Number(i.total) - Number(i.amountPaid), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Hi {c.firstName}</h1>
        <p className="text-sm text-muted mt-1">{s.portalWelcome ?? `Track your ${s.terms.assets.toLowerCase()}, approve estimates and view your service history.`}</p>
      </div>
      <Flash searchParams={sp} />

      {awaiting.length ? (
        <div className="space-y-3">
          {awaiting.map((w) => {
            const t = computeTotals(w.lines, s.taxRate, { taxExempt: c.taxExempt });
            return (
              <div key={w.id} className="card p-5 border-amber-500/40 bg-amber-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Estimate ready for your approval</div>
                    <div className="font-semibold mt-1">{vehicleName(w.vehicle)} · {w.complaint}</div>
                    <div className="text-sm text-muted">{woNumber(w.number)} · {w.lines.length} items</div>
                  </div>
                  <div className="text-right"><div className="text-2xl font-semibold">{money(t.total)}</div><div className="text-xs text-muted">incl. tax</div></div>
                  <Link href={`/portal/service/${w.id}`} className="btn btn-primary">Review & approve</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {due > 0 ? (
        <div className="card p-4 border-accent/40 flex flex-col sm:flex-row sm:items-center gap-3">
          <Receipt className="text-accent" size={20} />
          <div className="flex-1 text-sm"><span className="font-semibold">Balance due: {money(due)}</span> across {c.invoices.length} invoice{c.invoices.length === 1 ? "" : "s"}.</div>
          <Link href={`/portal/invoices/${c.invoices[0].id}`} className="btn btn-secondary btn-sm">View invoice</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title={`My ${s.terms.assets.toLowerCase()}`}>
          <ul className="grid sm:grid-cols-2 gap-3">
            {c.vehicles.map((v) => {
              const overdue = v.reminders.filter((r) => (r.dueAtDate && r.dueAtDate < new Date()) || (r.dueAtMileage && r.dueAtMileage <= v.mileage));
              return (
                <li key={v.id}>
                  <Link href={`/portal/vehicles/${v.id}`} className="card card-hover p-4 flex items-center gap-3 transition-colors">
                    <span className="h-11 w-11 rounded-lg bg-accent-soft text-accent grid place-items-center"><Car size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{vehicleName(v)}</div>
                      <div className="text-xs text-muted">{v.licensePlate ?? "—"} · {num(v.mileage)} mi</div>
                      {overdue.length ? <div className="text-xs text-amber-400 mt-0.5">{overdue.length} service{overdue.length === 1 ? "" : "s"} due</div> : v.reminders.length ? <div className="text-xs text-faint mt-0.5">Next: {v.reminders[0].service}</div> : null}
                    </div>
                    <ChevronRight size={16} className="text-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Upcoming appointments" action={<Link href="/portal/book" className="text-xs text-accent hover:underline">Book</Link>}>
          {c.appointments.length ? (
            <ul className="space-y-3 text-sm">
              {c.appointments.map((a) => <li key={a.id}><div className="font-medium">{a.serviceRequested}</div><div className="text-xs text-muted">{vehicleName(a.vehicle)} · {fmtDateTime(a.scheduledStart)}</div><Badge tone={a.status === "CONFIRMED" ? "green" : "slate"} className="mt-1">{a.status.toLowerCase()}</Badge></li>)}
            </ul>
          ) : <p className="text-sm text-muted">Nothing scheduled. <Link href="/portal/book" className="text-accent">Request an appointment</Link>.</p>}
        </Card>
      </div>

      {active.length ? (
        <Card title="Current service">
          <ul className="divide-y divide-border -my-2">
            {active.map((w) => {
              const t = computeTotals(w.lines, s.taxRate, { taxExempt: c.taxExempt });
              const insp = w.inspection ? w.inspection.items.filter((i) => i.result === "URGENT" || i.result === "ATTENTION").length : 0;
              return (
                <li key={w.id}>
                  <Link href={`/portal/service/${w.id}`} className="flex items-center gap-3 py-3 group">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium group-hover:text-accent">{vehicleName(w.vehicle)} · {w.complaint}</div>
                      <div className="text-xs text-muted flex items-center gap-2 mt-0.5"><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge>{w.promisedAt ? <span>Ready by {fmtDateTime(w.promisedAt)}</span> : null}{insp ? <span className="flex items-center gap-1 text-amber-400"><ClipboardCheck size={12} /> {insp} inspection finding{insp === 1 ? "" : "s"}</span> : null}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{money(t.total)}</div>
                    <ChevronRight size={16} className="text-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card title="Service history" padded={false}>
        {history.length ? (
          <table className="table">
            <thead><tr><th>Date</th><th>Vehicle</th><th>Service</th><th>Invoice</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {history.map((w) => (
                <tr key={w.id} className="row-link">
                  <td className="text-xs text-muted">{fmtDate(w.createdAt)}</td>
                  <td className="text-sm">{vehicleName(w.vehicle)}</td>
                  <td><Link href={`/portal/service/${w.id}`} className="hover:text-accent">{w.complaint}</Link></td>
                  <td>{w.invoice ? <Link href={`/portal/invoices/${w.invoice.id}`} className="text-accent hover:underline text-sm">{invNumber(w.invoice.number)} <Badge tone={INVOICE_STATUS[w.invoice.status].tone}>{INVOICE_STATUS[w.invoice.status].label}</Badge></Link> : "—"}</td>
                  <td className="text-right tabular-nums">{w.invoice ? money(w.invoice.total) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="p-5 text-sm text-muted">No completed visits yet.</p>}
      </Card>
      <p className="text-xs text-faint flex items-center gap-1"><Bell size={12} /> We&apos;ll post updates here and by email/text as your service progresses.</p>
    </div>
  );
}
