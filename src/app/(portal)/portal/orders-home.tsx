import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, Progress } from "@/components/ui";
import { fmtDate, money, num } from "@/lib/format";
import { jobNumber, shipNumber } from "@/lib/production";

/**
 * Portal home for a manufacturing shop's B2B customer: open orders with live
 * progress, shipments with tracking, and invoices with pay links.
 */
export async function OrdersHome({ customerId, firstName, company }: { customerId: string; firstName: string; company: string | null }) {
  const [jobs, shipments, invoices, products] = await Promise.all([
    db.productionJob.findMany({ where: { customerId, status: { not: "CANCELLED" } }, include: { part: { select: { sku: true, name: true, customerPartNumber: true } } }, orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 30 }),
    db.shipment.findMany({ where: { customerId }, include: { lines: { include: { part: { select: { sku: true, customerPartNumber: true } } } }, invoice: { select: { id: true, number: true, status: true } } }, orderBy: { number: "desc" }, take: 10 }),
    db.invoice.findMany({ where: { customerId }, orderBy: { issuedAt: "desc" }, take: 12 }),
    db.part.findMany({ where: { customerId, kind: "PRODUCT", active: true }, orderBy: { sku: "asc" }, select: { id: true, sku: true, name: true, customerPartNumber: true, quantityOnHand: true, price: true } }),
  ]);
  const open = jobs.filter((j) => j.status !== "COMPLETE");
  const done = jobs.filter((j) => j.status === "COMPLETE").slice(0, 8);
  const due = invoices.filter((i) => i.status === "SENT" || i.status === "PARTIAL").reduce((s, i) => s + Number(i.total) - Number(i.amountPaid), 0);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Hi {firstName}{company ? ` — ${company}` : ""}</h1>
        <p className="text-sm text-muted mt-1">Your orders, shipments and invoices, live from the floor.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Open orders" padded={false}>
          <ul className="divide-y divide-border">
            {open.map((j) => {
              const pct = j.quantity ? Math.min(1, j.good / j.quantity) : 0;
              return (
                <li key={j.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{j.part.customerPartNumber ?? j.part.sku} <span className="text-muted font-normal">· {j.part.name}</span></div>
                    <Badge tone={j.status === "RUNNING" ? "green" : j.status === "PAUSED" ? "amber" : "slate"}>{j.status === "RUNNING" ? "in production" : j.status === "PAUSED" ? "paused" : "scheduled"}</Badge>
                  </div>
                  <div className="text-xs text-muted">{j.customerPo ? `PO ${j.customerPo} · ` : ""}{jobNumber(j.number)}{j.dueAt ? ` · due ${fmtDate(j.dueAt)}` : ""}</div>
                  <div className="flex items-center gap-2 mt-1.5"><Progress value={pct} tone={pct >= 1 ? "green" : "blue"} className="flex-1" /><span className="text-[11px] tabular-nums text-muted">{num(j.good)} / {num(j.quantity)}</span></div>
                </li>
              );
            })}
            {!open.length ? <li className="px-5 py-8 text-center text-sm text-muted">No open orders right now.</li> : null}
          </ul>
        </Card>
        <Card title="Balance">
          <div className="text-3xl font-semibold">{money(due)}</div>
          <p className="text-sm text-muted mt-1">{due > 0 ? "Open invoices — pay from the invoice page." : "Nothing outstanding. Thank you!"}</p>
          <ul className="mt-4 divide-y divide-border text-sm">
            {invoices.slice(0, 6).map((i) => (
              <li key={i.id} className="py-2 flex items-center justify-between gap-2">
                <Link href={`/portal/invoices/${i.id}`} className="hover:text-accent">INV-{String(i.number).padStart(5, "0")} <span className="text-xs text-muted">· {fmtDate(i.issuedAt)}</span></Link>
                <span className="flex items-center gap-2"><span className="tabular-nums">{money(i.total)}</span><Badge tone={i.status === "PAID" ? "green" : i.status === "VOID" ? "slate" : "amber"}>{i.status.toLowerCase()}</Badge></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Shipments" padded={false}>
          <ul className="divide-y divide-border">
            {shipments.map((s) => (
              <li key={s.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{shipNumber(s.number)}</span><Badge tone={s.status === "SHIPPED" ? "green" : "slate"}>{s.status === "SHIPPED" ? `shipped ${s.shipDate ? fmtDate(s.shipDate) : ""}` : "preparing"}</Badge></div>
                <div className="text-xs text-muted">{s.lines.map((l) => `${num(l.quantity)} × ${l.part.customerPartNumber ?? l.part.sku}`).join(", ")}{s.carrier ? ` · ${s.carrier}` : ""}{s.tracking ? ` · ${s.tracking}` : ""}{s.invoice ? ` · INV-${String(s.invoice.number).padStart(5, "0")}` : ""}</div>
              </li>
            ))}
            {!shipments.length ? <li className="px-5 py-6 text-center text-sm text-muted">No shipments yet.</li> : null}
          </ul>
        </Card>
        <Card title="Your parts" padded={false}>
          <table className="table">
            <thead><tr><th>Part</th><th className="text-right">In stock</th><th className="text-right">Price</th></tr></thead>
            <tbody>
              {products.map((p) => <tr key={p.id}><td className="text-sm">{p.customerPartNumber ?? p.sku}<div className="text-xs text-muted">{p.name}</div></td><td className="text-right tabular-nums">{num(p.quantityOnHand)}</td><td className="text-right tabular-nums">{money(p.price)}</td></tr>)}
              {!products.length ? <tr><td colSpan={3} className="text-center text-muted py-6">No parts on file.</td></tr> : null}
            </tbody>
          </table>
        </Card>
      </div>
      {done.length ? (
        <Card title="Completed orders" padded={false}>
          <table className="table">
            <thead><tr><th>Order</th><th>Part</th><th className="text-right">Made</th><th className="text-right">Shipped</th><th>Completed</th></tr></thead>
            <tbody>{done.map((j) => <tr key={j.id}><td className="text-sm">{jobNumber(j.number)}{j.customerPo ? <span className="text-xs text-muted"> · PO {j.customerPo}</span> : null}</td><td className="text-sm">{j.part.customerPartNumber ?? j.part.sku}</td><td className="text-right tabular-nums">{num(j.good)}</td><td className="text-right tabular-nums">{num(j.shipped)}</td><td className="text-xs text-muted">{fmtDate(j.completedAt)}</td></tr>)}</tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
