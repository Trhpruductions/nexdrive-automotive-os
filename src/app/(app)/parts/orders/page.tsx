import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { fmtDate, money, poNumber } from "@/lib/format";
import type { PurchaseOrderStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Purchase orders" };
const TONE: Record<PurchaseOrderStatus, "slate" | "blue" | "amber" | "green" | "red"> = { DRAFT: "slate", SENT: "blue", PARTIAL: "amber", RECEIVED: "green", CANCELLED: "red" };

export default async function PurchaseOrdersPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; status?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const status = sp.status && sp.status in TONE ? (sp.status as PurchaseOrderStatus) : undefined;
  const [orders, low] = await Promise.all([
    db.purchaseOrder.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, include: { supplier: true, lines: true } }),
    db.part.count({ where: { active: true } }).then(async () => (await db.part.findMany({ where: { active: true } })).filter((p) => p.quantityOnHand <= p.reorderPoint).length),
  ]);
  return (
    <div>
      <PageHeader title="Purchase orders" subtitle={`${low} part${low === 1 ? "" : "s"} at or below reorder point`} crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Purchase orders" }]} actions={<Link href="/parts/orders/new" className="btn btn-primary"><Plus size={16} /> New order</Link>} />
      <Flash searchParams={sp} />
      <div className="flex gap-1.5 pb-3 overflow-x-auto">
        {[["", "All"], ["DRAFT", "Draft"], ["SENT", "Sent"], ["PARTIAL", "Partially received"], ["RECEIVED", "Received"], ["CANCELLED", "Cancelled"]].map(([k, l]) => (
          <Link key={k} href={`/parts/orders${k ? `?status=${k}` : ""}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${(sp.status ?? "") === k ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{l}</Link>
        ))}
      </div>
      <Card padded={false}>
        {orders.length ? (
          <table className="table">
            <thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th className="text-right">Lines</th><th className="text-right">Received</th><th className="text-right">Total</th><th>Expected</th><th>Created</th></tr></thead>
            <tbody>
              {orders.map((o) => {
                const total = o.lines.reduce((s, l) => s + l.quantity * Number(l.unitCost), 0);
                const recv = o.lines.reduce((s, l) => s + l.received, 0);
                const qty = o.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <tr key={o.id} className="row-link">
                    <td><Link href={`/parts/orders/${o.id}`} className="font-semibold hover:text-accent">{poNumber(o.number)}</Link></td>
                    <td>{o.supplier.name}</td>
                    <td><Badge tone={TONE[o.status]}>{o.status.toLowerCase()}</Badge></td>
                    <td className="text-right tabular-nums">{o.lines.length}</td>
                    <td className="text-right tabular-nums">{recv}/{qty}</td>
                    <td className="text-right tabular-nums">{money(total)}</td>
                    <td className="text-xs text-muted">{fmtDate(o.expectedAt)}</td>
                    <td className="text-xs text-muted">{fmtDate(o.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={ClipboardList} title="No purchase orders yet" hint="Start one from the reorder suggestions." action={<Link href="/parts/orders/new" className="btn btn-primary btn-sm">New order</Link>} />
        )}
      </Card>
    </div>
  );
}
