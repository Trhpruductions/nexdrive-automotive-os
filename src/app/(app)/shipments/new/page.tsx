import Link from "next/link";
import { Truck } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Field, Flash, PageHeader } from "@/components/ui";
import { createShipment } from "@/actions/production";
import { money, num } from "@/lib/format";
import { jobNumber } from "@/lib/production";

export const metadata = { title: "New shipment" };

/** Pick a customer; their complete jobs with unshipped pieces are pre-filled. */
export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ customerId?: string; jobId?: string; ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  let customerId = sp.customerId;
  if (!customerId && sp.jobId) customerId = (await db.productionJob.findUnique({ where: { id: sp.jobId }, select: { customerId: true } }))?.customerId;
  const [customers, jobs, products, customer] = await Promise.all([
    db.customer.findMany({ where: { OR: [{ jobs: { some: {} } }, { products: { some: {} } }] }, orderBy: [{ company: "asc" }, { lastName: "asc" }], select: { id: true, company: true, firstName: true, lastName: true } }),
    customerId ? db.productionJob.findMany({ where: { customerId, status: "COMPLETE" }, include: { part: { select: { sku: true, name: true, price: true, customerPartNumber: true } } }, orderBy: { completedAt: "asc" } }) : Promise.resolve([]),
    customerId ? db.part.findMany({ where: { kind: "PRODUCT", active: true, quantityOnHand: { gt: 0 }, OR: [{ customerId }, { customerId: null }] }, orderBy: { sku: "asc" }, select: { id: true, sku: true, name: true, price: true, quantityOnHand: true } }) : Promise.resolve([]),
    customerId ? db.customer.findUnique({ where: { id: customerId } }) : Promise.resolve(null),
  ]);
  const unshipped = jobs.filter((j) => j.good - j.shipped > 0);
  const shipTo = customer ? [customer.company ?? `${customer.firstName} ${customer.lastName}`, customer.address, [customer.city, customer.state].filter(Boolean).join(", ") + (customer.zip ? ` ${customer.zip}` : "")].filter(Boolean).join("\n") : "";
  return (
    <div>
      <PageHeader title="New shipment" crumbs={[{ label: "Shipments", href: "/shipments" }, { label: "New" }]} />
      <Flash searchParams={sp} />
      <Card className="mb-4">
        <form className="flex flex-col sm:flex-row gap-2 max-w-xl">
          <select name="customerId" defaultValue={customerId ?? ""} className="select">
            <option value="" disabled>Choose the customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.company ?? `${c.firstName} ${c.lastName}`}</option>)}
          </select>
          <button className="btn btn-secondary shrink-0">Load</button>
        </form>
      </Card>
      {customerId ? (
        <Card>
          <form action={createShipment} className="space-y-5">
            <input type="hidden" name="customerId" value={customerId} />
            <div>
              <div className="card-title mb-2">From complete jobs</div>
              {unshipped.length ? (
                <table className="table">
                  <thead><tr><th>Job</th><th>Part</th><th className="text-right">Made</th><th className="text-right">Already shipped</th><th className="text-right w-40">Ship now</th></tr></thead>
                  <tbody>
                    {unshipped.map((j) => (
                      <tr key={j.id}>
                        <td className="text-sm"><Link href={`/jobs/${j.id}`} className="hover:text-accent">{jobNumber(j.number)}</Link>{j.customerPo ? <div className="text-[11px] text-muted">PO {j.customerPo}</div> : null}</td>
                        <td className="text-sm">{j.part.sku} <span className="text-muted">· {j.part.name}</span></td>
                        <td className="text-right tabular-nums">{num(j.good)}</td>
                        <td className="text-right tabular-nums text-muted">{num(j.shipped)}</td>
                        <td className="text-right"><input type="hidden" name="jobId" value={j.id} /><input name="qty" type="number" min={0} max={j.good - j.shipped} defaultValue={sp.jobId === j.id || !sp.jobId ? j.good - j.shipped : 0} className="input text-right w-32 inline-block" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-sm text-muted">No complete jobs with unshipped pieces for this customer.</p>}
            </div>
            {products.length ? (
              <div>
                <div className="card-title mb-2">From finished-goods stock</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {products.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-sm">
                      <input type="hidden" name="partId" value={p.id} />
                      <span className="flex-1 truncate">{p.sku} <span className="text-muted">· {num(p.quantityOnHand)} on hand · {money(p.price)}</span></span>
                      <input name="partQty" type="number" min={0} max={p.quantityOnHand} defaultValue={0} className="input w-24 text-right" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Ship to" className="sm:col-span-2"><textarea name="shipTo" rows={3} defaultValue={shipTo} className="textarea" /></Field>
              <Field label="Carrier"><input name="carrier" className="input" placeholder="UPS Freight, customer pickup…" /></Field>
              <Field label="Tracking / PRO #"><input name="tracking" className="input" /></Field>
              <Field label="Notes" className="sm:col-span-2"><input name="notes" className="input" placeholder="Pallets, skids, lot numbers…" /></Field>
            </div>
            <div className="flex gap-2"><button className="btn btn-primary"><Truck size={15} /> Create shipment</button><Link href="/shipments" className="btn btn-ghost">Cancel</Link></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
