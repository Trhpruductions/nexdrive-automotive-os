import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { money, num } from "@/lib/format";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const products = await db.part.findMany({ where: { kind: "PRODUCT" }, include: { customer: { select: { company: true, firstName: true, lastName: true } }, die: { select: { code: true } }, press: { select: { code: true } }, material: { select: { name: true } }, jobs: { where: { status: { in: ["RELEASED", "RUNNING", "PAUSED", "PLANNED"] } }, select: { id: true } } }, orderBy: [{ sku: "asc" }] });
  return (
    <div>
      <PageHeader title="Products" subtitle="The parts you make — part numbers, customers, dies, presses and material." crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Products" }]} actions={<Link href="/parts/products/new" className="btn btn-primary"><Plus size={16} /> Add product</Link>} />
      <Flash searchParams={sp} />
      <Card padded={false}>
        {products.length ? (
          <table className="table">
            <thead><tr><th>Part number</th><th>Customer</th><th>Die / press</th><th>Material</th><th className="text-right">Std rate</th><th className="text-right">Price</th><th className="text-right">FG on hand</th><th>Open jobs</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="row-link">
                  <td><Link href={`/parts/products/${p.id}`} className="font-semibold hover:text-accent">{p.sku}</Link><div className="text-xs text-muted">{p.name}{p.customerPartNumber ? ` · cust. ${p.customerPartNumber}` : ""}</div></td>
                  <td className="text-sm">{p.customer ? (p.customer.company ?? `${p.customer.firstName} ${p.customer.lastName}`) : <span className="text-muted">stock</span>}</td>
                  <td className="text-xs text-muted">{p.die?.code ?? "—"} / {p.press?.code ?? "—"}</td>
                  <td className="text-xs text-muted">{p.material?.name ?? "—"}{p.materialPerPiece ? ` · ${Number(p.materialPerPiece)}/pc` : ""}</td>
                  <td className="text-right tabular-nums text-xs">{p.stdRatePerHour ? `${num(p.stdRatePerHour)}/h` : "—"}</td>
                  <td className="text-right tabular-nums">{money(p.price)}</td>
                  <td className="text-right tabular-nums">{num(p.quantityOnHand)}{p.quantityOnHand <= p.reorderPoint && p.reorderPoint ? <Badge tone="amber" className="ml-2">low</Badge> : null}</td>
                  <td className="text-xs">{p.jobs.length ? <Link href="/jobs" className="text-accent">{p.jobs.length} open</Link> : <Link href={`/jobs/new?partId=${p.id}`} className="text-muted hover:text-accent">new job</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={Boxes} title="No products yet" action={<Link href="/parts/products/new" className="btn btn-primary btn-sm">Add the parts you make</Link>} />
        )}
      </Card>
    </div>
  );
}
