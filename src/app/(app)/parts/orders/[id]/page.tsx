import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCheck, Printer, Send, Trash2, XCircle } from "lucide-react";
import { requireStaff, can, BILLING_ROLES, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings, shopAddress } from "@/lib/settings";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { PrintButton } from "@/components/app/print-button";
import { cancelPurchaseOrder, deletePurchaseOrder, markPurchaseOrderSent, receivePurchaseOrder } from "@/actions/purchasing";
import { fmtDate, fmtDateTime, money, poNumber } from "@/lib/format";
import type { PurchaseOrderStatus } from "@/generated/prisma/enums";

const TONE: Record<PurchaseOrderStatus, "slate" | "blue" | "amber" | "green" | "red"> = { DRAFT: "slate", SENT: "blue", PARTIAL: "amber", RECEIVED: "green", CANCELLED: "red" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await db.purchaseOrder.findUnique({ where: { id }, select: { number: true } });
  return { title: po ? poNumber(po.number) : "Purchase order" };
}

export default async function PurchaseOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const settings = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { supplier: true, lines: { orderBy: { sortOrder: "asc" }, include: { part: { select: { id: true, sku: true, quantityOnHand: true } } } } } });
  if (!po) notFound();
  const total = po.lines.reduce((s, l) => s + l.quantity * Number(l.unitCost), 0);
  const open = po.status !== "RECEIVED" && po.status !== "CANCELLED";
  const billing = can(user, BILLING_ROLES);

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{poNumber(po.number)} <Badge tone={TONE[po.status]}>{po.status.toLowerCase()}</Badge></span>}
        subtitle={`${po.supplier.name}${po.supplier.phone ? ` · ${po.supplier.phone}` : ""}${po.supplier.email ? ` · ${po.supplier.email}` : ""} · created ${fmtDateTime(po.createdAt)}`}
        crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Purchase orders", href: "/parts/orders" }, { label: poNumber(po.number) }]}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            {po.status === "DRAFT" && billing ? <form action={markPurchaseOrderSent.bind(null, po.id)}><button className="btn btn-primary"><Send size={15} /> Mark as sent</button></form> : null}
            <PrintButton />
            {open && billing ? <form action={cancelPurchaseOrder.bind(null, po.id)}><ConfirmButton message="Cancel this purchase order?" className="btn btn-ghost text-red-400"><XCircle size={15} /> Cancel</ConfirmButton></form> : null}
          </div>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="print-sheet card p-6">
            <div className="flex justify-between gap-4 flex-wrap">
              <div><div className="text-lg font-semibold">{settings.name}</div><div className="text-xs text-muted">{shopAddress(settings).join(" · ")}<br />{[settings.phone, settings.email].filter(Boolean).join(" · ")}</div></div>
              <div className="text-right"><div className="text-[11px] tracking-[0.2em] text-accent font-bold">PURCHASE ORDER</div><div className="text-2xl font-semibold">{poNumber(po.number)}</div><div className="text-xs text-muted">{fmtDate(po.createdAt)}{po.expectedAt ? ` · expected ${fmtDate(po.expectedAt)}` : ""}</div></div>
            </div>
            <div className="mt-6"><div className="card-title mb-1">Supplier</div><div className="font-medium">{po.supplier.name}</div><div className="text-sm text-muted">{[po.supplier.phone, po.supplier.email, po.supplier.website].filter(Boolean).join(" · ")}</div></div>
            <form action={receivePurchaseOrder.bind(null, po.id)}>
              <table className="table mt-6">
                <thead><tr><th>Item</th><th className="text-right">Ordered</th><th className="text-right">Unit cost</th><th className="text-right">Amount</th><th className="text-right">Received</th>{open ? <th className="text-right no-print w-28">Receive now</th> : null}</tr></thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.description}{l.part ? <div className="text-[11px] font-mono text-faint">on hand {l.part.quantityOnHand}</div> : null}</td>
                      <td className="text-right tabular-nums">{l.quantity}</td>
                      <td className="text-right tabular-nums">{money(l.unitCost)}</td>
                      <td className="text-right tabular-nums">{money(l.quantity * Number(l.unitCost))}</td>
                      <td className={`text-right tabular-nums ${l.received >= l.quantity ? "text-emerald-400" : l.received ? "text-amber-400" : "text-muted"}`}>{l.received}</td>
                      {open ? <td className="text-right no-print"><input name={`recv_${l.id}`} type="number" min="0" max={l.quantity - l.received} defaultValue={l.quantity - l.received} className="input py-1 text-right w-24 ml-auto" /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-muted">{po.notes}</div>
                <div className="text-right"><div className="text-xs text-muted">Order total</div><div className="text-xl font-semibold tabular-nums">{money(total)}</div></div>
              </div>
              {open ? <div className="no-print mt-4 flex justify-end"><button className="btn btn-success"><PackageCheck size={15} /> Receive into stock</button></div> : null}
            </form>
          </div>
        </div>
        <div className="space-y-4 no-print">
          <Card title="Status">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Sent" value={fmtDateTime(po.sentAt)} />
              <Stat label="Received" value={fmtDateTime(po.receivedAt)} />
              <Stat label="Lines" value={po.lines.length} />
              <Stat label="Units" value={`${po.lines.reduce((s, l) => s + l.received, 0)} / ${po.lines.reduce((s, l) => s + l.quantity, 0)}`} />
            </div>
            <p className="text-xs text-faint mt-4">Receiving adds the quantities to stock, records a stock movement per part and updates each part&apos;s cost to the PO price. Partial receipts are fine — the order stays open until every line is complete.</p>
          </Card>
          {can(user, MANAGER_ROLES) && (po.status === "DRAFT" || po.status === "CANCELLED") ? (
            <form action={deletePurchaseOrder.bind(null, po.id)} className="text-right"><ConfirmButton message="Delete this purchase order?"><Trash2 size={14} /> Delete</ConfirmButton></form>
          ) : null}
          <p className="text-xs text-faint"><Printer size={12} className="inline" /> Print gives the supplier a clean order sheet. <Link href="/parts/orders" className="text-accent hover:underline">All orders</Link></p>
        </div>
      </div>
    </div>
  );
}
