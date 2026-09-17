import Link from "next/link";
import { notFound } from "next/navigation";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { subDays } from "date-fns";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { adjustStock, deletePart } from "@/actions/parts";
import { fmtDateTime, money, woNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.part.findUnique({ where: { id }, select: { name: true } });
  return { title: p?.name ?? "Part" };
}

export default async function PartPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.part.findUnique({
    where: { id },
    include: {
      supplier: true,
      movements: { orderBy: { createdAt: "desc" }, take: 30 },
      lines: { orderBy: { createdAt: "desc" }, take: 10, include: { workOrder: { include: { vehicle: true } } } },
      cannedUses: { include: { cannedService: true } },
    },
  });
  if (!p) notFound();
  const low = p.quantityOnHand <= p.reorderPoint;
  const cutoff = subDays(new Date(), 30);
  const used30 = p.movements.filter((m) => m.delta < 0 && m.createdAt > cutoff).reduce((s, m) => s + Math.abs(m.delta), 0);

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{p.name} {!p.active ? <Badge tone="slate">Archived</Badge> : low ? <Badge tone="amber">Low stock</Badge> : null}</span>}
        subtitle={<span className="font-mono">{p.sku}</span>}
        crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: p.name }]}
        actions={<Link href={`/parts/${p.id}/edit`} className="btn btn-primary"><Pencil size={15} /> Edit</Link>}
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Stock">
            <div className="text-4xl font-semibold tracking-tight">{p.quantityOnHand} <span className="text-base text-muted font-normal">on hand</span></div>
            <div className="text-xs text-muted mt-1">Reorder at {p.reorderPoint} · {used30} used in the last 30 days</div>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <form action={adjustStock.bind(null, p.id)} className="space-y-2">
                <input type="hidden" name="reason" value="Received stock" />
                <input name="delta" type="number" min="1" defaultValue={Math.max(1, p.reorderPoint * 2 - p.quantityOnHand)} className="input" />
                <button className="btn btn-success w-full"><Plus size={14} /> Receive</button>
              </form>
              <form action={adjustStock.bind(null, p.id)} className="space-y-2">
                <input type="hidden" name="reason" value="Pulled from stock" />
                <input name="delta" type="number" max="-1" defaultValue={-1} className="input" />
                <button className="btn btn-secondary w-full"><Minus size={14} /> Pull</button>
              </form>
            </div>
            <form action={adjustStock.bind(null, p.id)} className="flex gap-2 mt-3 pt-3 border-t border-border">
              <input name="delta" type="number" placeholder="± qty" className="input w-24" required />
              <input name="reason" placeholder="Reason (count correction, damaged…)" className="input" />
              <button className="btn btn-secondary btn-sm shrink-0">Adjust</button>
            </form>
          </Card>
          <Card title="Details">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Category" value={p.category ?? "—"} />
              <Stat label="Brand" value={p.brand ?? "—"} />
              <Stat label="Bin location" value={p.location ?? "—"} />
              <Stat label="Supplier" value={p.supplier?.name ?? "—"} sub={p.supplier?.phone ?? undefined} />
              <Stat label="Cost" value={money(p.cost)} />
              <Stat label="Sell price" value={money(p.price)} sub={Number(p.cost) > 0 ? `${(((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100).toFixed(0)}% margin` : undefined} />
            </div>
            {p.description ? <p className="text-sm text-muted mt-4 pt-4 border-t border-border">{p.description}</p> : null}
            {p.cannedUses.length ? <div className="text-xs text-muted mt-4 pt-3 border-t border-border">Used in: {p.cannedUses.map((c) => c.cannedService.name).join(", ")}</div> : null}
          </Card>
          {can(user, MANAGER_ROLES) ? (
            <form action={deletePart.bind(null, p.id)} className="text-right"><ConfirmButton message="Delete this part?"><Trash2 size={14} /> Delete part</ConfirmButton></form>
          ) : null}
        </div>
        <div className="xl:col-span-2 space-y-4">
          <Card title="Stock movements" padded={false}>
            {p.movements.length ? (
              <table className="table">
                <thead><tr><th>When</th><th>Reason</th><th>Reference</th><th className="text-right">Change</th></tr></thead>
                <tbody>
                  {p.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-xs text-muted">{fmtDateTime(m.createdAt)}</td>
                      <td className="text-sm">{m.reason}</td>
                      <td className="text-xs text-muted">{m.reference ?? "—"}</td>
                      <td className={`text-right tabular-nums font-medium ${m.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-5 text-sm text-muted">No movements yet.</p>}
          </Card>
          <Card title="Recent usage" padded={false}>
            {p.lines.length ? (
              <table className="table">
                <thead><tr><th>Work order</th><th>Vehicle</th><th className="text-right">Qty</th><th className="text-right">Price</th></tr></thead>
                <tbody>
                  {p.lines.map((l) => (
                    <tr key={l.id} className="row-link">
                      <td><Link href={`/work-orders/${l.workOrderId}`} className="hover:text-accent">{woNumber(l.workOrder.number)}</Link></td>
                      <td className="text-xs text-muted">{l.workOrder.vehicle.year} {l.workOrder.vehicle.make} {l.workOrder.vehicle.model}</td>
                      <td className="text-right tabular-nums">{Number(l.quantity)}</td>
                      <td className="text-right tabular-nums">{money(l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-5 text-sm text-muted">Not used on any work orders yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
