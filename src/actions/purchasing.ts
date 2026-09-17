"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, currentShopId, nextNumber } from "@/lib/db";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { emitWebhook } from "@/lib/webhooks";

const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Create a PO. `partIds[]` + `qtys[]` come from the reorder screen or the manual form. */
export async function createPurchaseOrder(formData: FormData) {
  const user = await requireStaff(BILLING_ROLES);
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!supplierId) redirect("/parts/orders/new?error=Choose+a+supplier");
  const partIds = formData.getAll("partId").map(String);
  const qtys = formData.getAll("qty").map((q) => Math.max(0, Math.trunc(Number(q))));
  const parts = await db.part.findMany({ where: { id: { in: partIds } } });
  const lines = partIds
    .map((id, i) => ({ part: parts.find((p) => p.id === id), qty: qtys[i] ?? 0 }))
    .filter((l): l is { part: (typeof parts)[number]; qty: number } => Boolean(l.part) && l.qty > 0)
    .map((l, i) => ({ partId: l.part.id, description: `${l.part.name} (${l.part.sku})`, quantity: l.qty, unitCost: l.part.cost, sortOrder: i }));
  const custom = String(formData.get("customDescription") ?? "").trim();
  if (custom) lines.push({ partId: null as unknown as string, description: custom, quantity: Math.max(1, Math.trunc(Number(formData.get("customQty")) || 1)), unitCost: Number(formData.get("customCost")) || 0, sortOrder: lines.length } as never);
  if (!lines.length) redirect(`/parts/orders/new?supplierId=${supplierId}&error=Add+at+least+one+line`);
  const po = await db.purchaseOrder.create({
    data: { shopId: await currentShopId(), number: await nextNumber("po"), supplierId, notes: opt(formData.get("notes")), expectedAt: formData.get("expectedAt") ? new Date(String(formData.get("expectedAt"))) : null, lines: { create: lines.map((l) => ({ ...l, partId: l.partId || null })) } },
  });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "create", entity: "PurchaseOrder", entityId: po.id, detail: `#${po.number}` } });
  revalidatePath("/parts/orders");
  redirect(`/parts/orders/${po.id}?ok=Purchase+order+created`);
}

export async function markPurchaseOrderSent(id: string) {
  await requireStaff(BILLING_ROLES);
  await db.purchaseOrder.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
  revalidatePath(`/parts/orders/${id}`);
  redirect(`/parts/orders/${id}?ok=Marked+as+sent+to+supplier`);
}

export async function cancelPurchaseOrder(id: string) {
  await requireStaff(BILLING_ROLES);
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status === "RECEIVED") redirect(`/parts/orders/${id}?error=Received+orders+cannot+be+cancelled`);
  await db.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/parts/orders");
  redirect(`/parts/orders/${id}?ok=Cancelled`);
}

/** Receive quantities per line (partial receipts allowed). Stock moves for lines tied to a part. */
export async function receivePurchaseOrder(id: string, formData: FormData) {
  const user = await requireStaff();
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (po.status === "CANCELLED" || po.status === "RECEIVED") redirect(`/parts/orders/${id}?error=This+order+is+closed`);
  const shopId = await currentShopId();
  let anything = false;
  for (const line of po.lines) {
    const qty = Math.max(0, Math.trunc(Number(formData.get(`recv_${line.id}`)) || 0));
    if (!qty) continue;
    const allowed = Math.min(qty, line.quantity - line.received);
    if (allowed <= 0) continue;
    anything = true;
    await db.purchaseOrderLine.update({ where: { id: line.id }, data: { received: { increment: allowed } } });
    if (line.partId) {
      await db.part.update({ where: { id: line.partId }, data: { quantityOnHand: { increment: allowed }, cost: line.unitCost } });
      await db.stockMovement.create({ data: { partId: line.partId, delta: allowed, reason: `Received PO-${String(po.number).padStart(5, "0")}`, reference: user.name } });
    }
  }
  if (!anything) redirect(`/parts/orders/${id}?error=Enter+received+quantities`);
  const fresh = await db.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  const complete = fresh.lines.every((l) => l.received >= l.quantity);
  await db.purchaseOrder.update({ where: { id }, data: { status: complete ? "RECEIVED" : "PARTIAL", receivedAt: complete ? new Date() : null } });
  await db.auditLog.create({ data: { shopId, userId: user.id, action: complete ? "received" : "partial_receive", entity: "PurchaseOrder", entityId: id, detail: `#${po.number}` } });
  emitWebhook("part.low_stock", { note: "purchase order received", purchaseOrder: po.number });
  revalidatePath(`/parts/orders/${id}`);
  revalidatePath("/parts");
  redirect(`/parts/orders/${id}?ok=${complete ? "Order+fully+received+%E2%80%94+stock+updated" : "Partial+receipt+recorded"}`);
}

export async function deletePurchaseOrder(id: string) {
  await requireStaff(["OWNER", "ADMIN"]);
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id } });
  if (po.status !== "DRAFT" && po.status !== "CANCELLED") redirect(`/parts/orders/${id}?error=Only+draft+or+cancelled+orders+can+be+deleted`);
  await db.purchaseOrder.delete({ where: { id } });
  revalidatePath("/parts/orders");
  redirect("/parts/orders?ok=Purchase+order+deleted");
}
