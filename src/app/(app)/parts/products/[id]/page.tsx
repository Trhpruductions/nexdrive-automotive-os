import Link from "next/link";
import { notFound } from "next/navigation";
import { Factory } from "lucide-react";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { fmtDate, money, num } from "@/lib/format";
import { jobNumber } from "@/lib/production";
import { ProductForm } from "../product-form";
import { productOptions } from "../options";
import { parseCheckPlan } from "@/lib/quality";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const [p, opts] = await Promise.all([
    db.part.findUnique({ where: { id }, include: { customer: true, die: true, press: true, material: true, jobs: { orderBy: { createdAt: "desc" }, take: 12 }, movements: { orderBy: { createdAt: "desc" }, take: 8 } } }),
    productOptions(),
  ]);
  if (!p || p.kind !== "PRODUCT") notFound();
  const shipped = p.jobs.reduce((s, j) => s + j.shipped, 0);
  const price = Number(p.price);
  const cost = Number(p.cost);
  return (
    <div>
      <PageHeader
        title={p.sku}
        subtitle={<>{p.name}{p.customer ? <> · <Link href={`/customers/${p.customer.id}`} className="text-accent hover:underline">{p.customer.company ?? `${p.customer.firstName} ${p.customer.lastName}`}</Link></> : null}{p.customerPartNumber ? ` · cust. ${p.customerPartNumber}` : ""}</>}
        crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Products", href: "/parts/products" }, { label: p.sku }]}
        actions={<Link href={`/jobs/new?partId=${p.id}`} className="btn btn-primary"><Factory size={15} /> New job</Link>}
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Stat label="Finished goods on hand" value={num(p.quantityOnHand)} sub={p.reorderPoint ? `reorder at ${num(p.reorderPoint)}` : undefined} />
        <Stat label="Price" value={`${money(price)} / ${p.unit}`} sub={cost && price ? `cost ${money(cost)} · margin ${Math.round(((price - cost) / price) * 100)}%` : undefined} />
        <Stat label="Makes on" value={`${p.die?.code ?? "—"} / ${p.press?.code ?? "—"}`} sub={p.stdRatePerHour ? `${num(p.stdRatePerHour)} pcs/h standard` : undefined} />
        <Stat label="Shipped (recent jobs)" value={num(shipped)} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Jobs" padded={false}>
            <table className="table">
              <thead><tr><th>Job</th><th className="text-right">Qty</th><th className="text-right">Good</th><th className="text-right">Scrap</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {p.jobs.map((j) => (
                  <tr key={j.id}>
                    <td><Link href={`/jobs/${j.id}`} className="font-medium hover:text-accent">{jobNumber(j.number)}</Link>{j.customerPo ? <span className="text-xs text-muted"> · PO {j.customerPo}</span> : null}</td>
                    <td className="text-right tabular-nums">{num(j.quantity)}</td>
                    <td className="text-right tabular-nums">{num(j.good)}</td>
                    <td className="text-right tabular-nums text-muted">{j.scrap}</td>
                    <td className="text-xs text-muted">{fmtDate(j.dueAt)}</td>
                    <td><Badge tone={j.status === "RUNNING" ? "green" : j.status === "COMPLETE" ? "violet" : j.status === "PAUSED" ? "amber" : "slate"}>{j.status.toLowerCase()}</Badge></td>
                  </tr>
                ))}
                {!p.jobs.length ? <tr><td colSpan={6} className="text-center text-muted py-6">No jobs yet.</td></tr> : null}
              </tbody>
            </table>
          </Card>
          <Card title="Stock movements" padded={false}>
            <ul className="divide-y divide-border">
              {p.movements.map((m) => <li key={m.id} className="px-5 py-2 text-sm flex justify-between"><span>{m.reason}{m.reference ? <span className="text-muted"> · {m.reference}</span> : null}</span><span className={`tabular-nums ${m.delta > 0 ? "text-emerald-400" : "text-muted"}`}>{m.delta > 0 ? "+" : ""}{num(m.delta)}</span></li>)}
              {!p.movements.length ? <li className="px-5 py-6 text-center text-sm text-muted">No movements yet.</li> : null}
            </ul>
          </Card>
        </div>
        <div>
          {can(user, MANAGER_ROLES) ? (
            <Card title="Product details">
              <ProductForm values={{ ...p, materialPerPiece: p.materialPerPiece ? Number(p.materialPerPiece) : null, price, cost, checkPlan: parseCheckPlan(p.checkPlan) }} {...opts} />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
