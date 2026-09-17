import "server-only";
import { db, currentShopId } from "./db";
import { queueNotification } from "./notify";
import { renderTemplate } from "./templates";
import { emitWebhook } from "./webhooks";
import { round2 } from "./money";
import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Records a payment against an invoice, updates the balance/status, thanks the
 * customer when paid in full and fires the outbound webhooks. Used by the staff
 * "record payment" form and by the Stripe webhook. Must run inside shop context.
 */
export async function applyPayment(opts: { invoiceId: string; amount: number; method: PaymentMethod; reference?: string | null; userId?: string | null; by?: string }) {
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: opts.invoiceId } });
  if (inv.status === "VOID") throw new Error("Invoice is void");
  const amount = round2(opts.amount);
  const balance = round2(Number(inv.total) - Number(inv.amountPaid));
  if (!(amount > 0)) throw new Error("Amount must be positive");
  if (amount > balance + 0.005) throw new Error(`Amount exceeds balance of $${balance.toFixed(2)}`);
  const paid = round2(Number(inv.amountPaid) + amount);
  const full = paid >= Number(inv.total) - 0.005;
  await db.$transaction([
    db.payment.create({ data: { invoiceId: inv.id, amount, method: opts.method, reference: opts.reference ?? null } }),
    db.invoice.update({ where: { id: inv.id }, data: { amountPaid: paid, status: full ? "PAID" : "PARTIAL" } }),
  ]);
  if (full) {
    const c = await db.customer.findUnique({ where: { id: inv.customerId }, select: { firstName: true } });
    const t = await renderTemplate("payment_received", { customer: c?.firstName ?? "", amount: `$${amount.toFixed(2)}`, invoice: `INV-${String(inv.number).padStart(5, "0")}` });
    await queueNotification({ customerId: inv.customerId, workOrderId: inv.workOrderId, ...t });
  }
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: opts.userId ?? null, action: "payment", entity: "Invoice", entityId: inv.id, detail: `$${amount.toFixed(2)} ${opts.method}${opts.by ? ` via ${opts.by}` : ""}` } });
  emitWebhook("payment.recorded", { invoiceId: inv.id, invoiceNumber: inv.number, amount, method: opts.method, reference: opts.reference ?? null, amountPaid: paid, total: Number(inv.total), customerId: inv.customerId, by: opts.by ?? null });
  if (full) emitWebhook("invoice.paid", { id: inv.id, number: inv.number, total: Number(inv.total), customerId: inv.customerId, workOrderId: inv.workOrderId });
  return { paid, full };
}
