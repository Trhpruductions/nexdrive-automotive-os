import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { fmtDate, money, num } from "@/lib/format";
import { shipNumber } from "@/lib/production";

export const metadata = { title: "Shipments" };

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const [shipments, ready] = await Promise.all([
    db.shipment.findMany({ include: { customer: { select: { company: true, firstName: true, lastName: true } }, lines: { select: { quantity: true, unitPrice: true } }, invoice: { select: { id: true, number: true, status: true } } }, orderBy: { number: "desc" }, take: 100 }),
    db.productionJob.findMany({ where: { status: "COMPLETE" }, select: { id: true, good: true, shipped: true } }),
  ]);
  const readyPcs = ready.reduce((s, j) => s + Math.max(0, j.good - j.shipped), 0);
  return (
    <div>
      <PageHeader title="Shipments" subtitle={`${num(readyPcs)} finished pieces from complete jobs are waiting to ship.`} actions={<Link href="/shipments/new" className="btn btn-primary"><Plus size={16} /> New shipment</Link>} />
      <Flash searchParams={sp} />
      <Card padded={false}>
        {shipments.length ? (
          <table className="table">
            <thead><tr><th>Shipment</th><th>Customer</th><th className="text-right">Pieces</th><th className="text-right">Value</th><th>Shipped</th><th>Invoice</th><th>Status</th></tr></thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id} className="row-link">
                  <td><Link href={`/shipments/${s.id}`} className="font-semibold hover:text-accent">{shipNumber(s.number)}</Link>{s.tracking ? <div className="text-[11px] text-muted">{s.carrier} {s.tracking}</div> : null}</td>
                  <td className="text-sm">{s.customer.company ?? `${s.customer.firstName} ${s.customer.lastName}`}</td>
                  <td className="text-right tabular-nums">{num(s.lines.reduce((a, l) => a + l.quantity, 0))}</td>
                  <td className="text-right tabular-nums">{money(s.lines.reduce((a, l) => a + l.quantity * Number(l.unitPrice), 0))}</td>
                  <td className="text-xs text-muted">{s.shipDate ? fmtDate(s.shipDate) : "—"}</td>
                  <td className="text-xs">{s.invoice ? <Link href={`/invoices/${s.invoice.id}`} className="text-accent hover:underline">INV-{String(s.invoice.number).padStart(5, "0")} · {s.invoice.status.toLowerCase()}</Link> : <span className="text-muted">not yet</span>}</td>
                  <td><Badge tone={s.status === "SHIPPED" ? "green" : "slate"}>{s.status.toLowerCase()}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={Truck} title="Nothing shipped yet" action={<Link href="/shipments/new" className="btn btn-primary btn-sm">New shipment</Link>} />
        )}
      </Card>
    </div>
  );
}
