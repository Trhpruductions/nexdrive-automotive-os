import Link from "next/link";
import { Car, ClipboardList, Package, Receipt, Search, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { INVOICE_STATUS, WO_STATUS } from "@/lib/constants";
import { invNumber, vehicleName, woNumber } from "@/lib/format";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q: raw } = await searchParams;
  const q = raw?.trim() ?? "";
  const ci = { contains: q, mode: "insensitive" as const };
  const num = Number(q.replace(/^(wo|inv)-?/i, ""));
  const [customers, vehicles, workOrders, parts, invoices] = q
    ? await Promise.all([
        db.customer.findMany({ where: { OR: [{ firstName: ci }, { lastName: ci }, { company: ci }, { email: ci }, { phone: { contains: q } }] }, take: 8 }),
        db.vehicle.findMany({ where: { OR: [{ make: ci }, { model: ci }, { vin: ci }, { licensePlate: ci }] }, take: 8, include: { customer: true } }),
        db.workOrder.findMany({ where: { OR: [...(Number.isInteger(num) && num > 0 ? [{ number: num }] : []), { complaint: ci }, { diagnosis: ci }] }, take: 8, include: { vehicle: true, customer: true } }),
        db.part.findMany({ where: { OR: [{ sku: ci }, { name: ci }, { brand: ci }] }, take: 8 }),
        db.invoice.findMany({ where: Number.isInteger(num) && num > 0 ? { number: num } : { customer: { OR: [{ firstName: ci }, { lastName: ci }] } }, take: 5, include: { customer: true } }),
      ])
    : [[], [], [], [], []];
  const total = customers.length + vehicles.length + workOrders.length + parts.length + invoices.length;

  return (
    <div>
      <PageHeader title={q ? `Results for “${q}”` : "Search"} subtitle={q ? `${total} match${total === 1 ? "" : "es"}` : "Search customers, vehicles, work orders, parts and invoices from the bar above."} />
      {!q || !total ? (
        <Card><EmptyState icon={Search} title={q ? "Nothing matched" : "Type something to search"} hint="Try a name, plate, VIN, WO number, SKU or phone number." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {customers.length ? <Card title={<span className="flex items-center gap-2"><Users size={13} /> Customers</span>}><ul className="space-y-1.5 text-sm">{customers.map((c) => <li key={c.id}><Link href={`/customers/${c.id}`} className="hover:text-accent">{c.firstName} {c.lastName}</Link><span className="text-xs text-muted"> · {[c.phone, c.email].filter(Boolean).join(" · ")}</span></li>)}</ul></Card> : null}
          {vehicles.length ? <Card title={<span className="flex items-center gap-2"><Car size={13} /> Vehicles</span>}><ul className="space-y-1.5 text-sm">{vehicles.map((v) => <li key={v.id}><Link href={`/vehicles/${v.id}`} className="hover:text-accent">{vehicleName(v)}</Link><span className="text-xs text-muted"> · {v.licensePlate ?? v.vin} · {v.customer.firstName} {v.customer.lastName}</span></li>)}</ul></Card> : null}
          {workOrders.length ? <Card title={<span className="flex items-center gap-2"><ClipboardList size={13} /> Work orders</span>}><ul className="space-y-1.5 text-sm">{workOrders.map((w) => <li key={w.id} className="flex items-center gap-2"><Link href={`/work-orders/${w.id}`} className="hover:text-accent font-medium">{woNumber(w.number)}</Link><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge><span className="text-xs text-muted truncate">{vehicleName(w.vehicle)} · {w.complaint}</span></li>)}</ul></Card> : null}
          {parts.length ? <Card title={<span className="flex items-center gap-2"><Package size={13} /> Parts</span>}><ul className="space-y-1.5 text-sm">{parts.map((p) => <li key={p.id}><Link href={`/parts/${p.id}`} className="hover:text-accent">{p.name}</Link><span className="text-xs text-muted font-mono"> · {p.sku} · {p.quantityOnHand} on hand</span></li>)}</ul></Card> : null}
          {invoices.length ? <Card title={<span className="flex items-center gap-2"><Receipt size={13} /> Invoices</span>}><ul className="space-y-1.5 text-sm">{invoices.map((i) => <li key={i.id} className="flex items-center gap-2"><Link href={`/invoices/${i.id}`} className="hover:text-accent font-medium">{invNumber(i.number)}</Link><Badge tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</Badge><span className="text-xs text-muted">{i.customer.firstName} {i.customer.lastName}</span></li>)}</ul></Card> : null}
        </div>
      )}
    </div>
  );
}
