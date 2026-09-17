import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, Field, Flash, PageHeader } from "@/components/ui";
import { createPurchaseOrder } from "@/actions/purchasing";
import { money } from "@/lib/format";

export const metadata = { title: "New purchase order" };

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ supplierId?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const sp = await searchParams;
  const [suppliers, parts] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.part.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }], include: { supplier: { select: { id: true, name: true } } } }),
  ]);
  const supplierId = sp.supplierId ?? suppliers[0]?.id ?? "";
  const forSupplier = parts.filter((p) => !supplierId || p.supplierId === supplierId || !p.supplierId);
  const suggested = forSupplier.filter((p) => p.quantityOnHand <= p.reorderPoint);
  const others = forSupplier.filter((p) => p.quantityOnHand > p.reorderPoint);
  const suggestQty = (p: (typeof parts)[number]) => Math.max(1, p.reorderPoint * 2 - p.quantityOnHand);

  return (
    <div>
      <PageHeader title="New purchase order" subtitle="Low-stock parts are pre-filled with a quantity that restores twice the reorder point." crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Purchase orders", href: "/parts/orders" }, { label: "New" }]} />
      <Flash searchParams={sp} />
      {!suppliers.length ? <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">Add a supplier first under <Link href="/parts/suppliers" className="underline">Parts → Suppliers</Link>.</div> : null}
      <form action="/parts/orders/new" method="get" className="mb-4 flex items-end gap-2 max-w-md">
        <Field label="Supplier" className="flex-1">
          <select name="supplierId" defaultValue={supplierId} className="select">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </Field>
        <button className="btn btn-secondary">Show parts</button>
      </form>
      <form action={createPurchaseOrder} className="space-y-4">
        <input type="hidden" name="supplierId" value={supplierId} />
        <Card title={`Reorder suggestions (${suggested.length})`} padded={false}>
          <table className="table">
            <thead><tr><th>Part</th><th className="text-right">On hand</th><th className="text-right">Reorder at</th><th className="text-right">Cost</th><th className="w-32 text-right">Order qty</th></tr></thead>
            <tbody>
              {suggested.map((p) => (
                <tr key={p.id}>
                  <td><div className="font-medium">{p.name}</div><div className="text-[11px] font-mono text-faint">{p.sku}{p.supplier ? ` · ${p.supplier.name}` : ""}</div></td>
                  <td className="text-right tabular-nums text-amber-400">{p.quantityOnHand}</td>
                  <td className="text-right tabular-nums text-muted">{p.reorderPoint}</td>
                  <td className="text-right tabular-nums text-muted">{money(p.cost)}</td>
                  <td className="text-right"><input type="hidden" name="partId" value={p.id} /><input name="qty" type="number" min="0" defaultValue={suggestQty(p)} className="input py-1.5 text-right w-24 ml-auto" /></td>
                </tr>
              ))}
              {!suggested.length ? <tr><td colSpan={5} className="text-center text-muted py-6">Nothing below its reorder point for this supplier.</td></tr> : null}
            </tbody>
          </table>
        </Card>
        <Card title="Add other parts" padded={false}>
          <div className="max-h-80 overflow-y-auto">
            <table className="table">
              <thead><tr><th>Part</th><th className="text-right">On hand</th><th className="text-right">Cost</th><th className="w-32 text-right">Order qty</th></tr></thead>
              <tbody>
                {others.map((p) => (
                  <tr key={p.id}>
                    <td><div className="text-sm">{p.name}</div><div className="text-[11px] font-mono text-faint">{p.sku}</div></td>
                    <td className="text-right tabular-nums text-muted">{p.quantityOnHand}</td>
                    <td className="text-right tabular-nums text-muted">{money(p.cost)}</td>
                    <td className="text-right"><input type="hidden" name="partId" value={p.id} /><input name="qty" type="number" min="0" defaultValue={0} className="input py-1.5 text-right w-24 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Custom line & notes">
          <div className="grid sm:grid-cols-[1fr_100px_120px] gap-3">
            <Field label="Item not in inventory"><input name="customDescription" className="input" placeholder="e.g. Ignition coil, part # 12345" /></Field>
            <Field label="Qty"><input name="customQty" type="number" min="1" defaultValue={1} className="input" /></Field>
            <Field label="Unit cost"><input name="customCost" type="number" step="0.01" min="0" className="input" /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <Field label="Expected delivery"><input name="expectedAt" type="date" className="input" /></Field>
            <Field label="Notes to supplier"><input name="notes" className="input" placeholder="Account #, delivery instructions" /></Field>
          </div>
        </Card>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!suppliers.length}><ShoppingCart size={15} /> Create purchase order</button>
          <Link href="/parts/orders" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
