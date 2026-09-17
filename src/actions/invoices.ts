"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { queueNotification } from "@/lib/notify";
import { round2 } from "@/lib/money";
import { emitWebhook } from "@/lib/webhooks";
import type { PaymentMethod } from "@/generated/prisma/enums";

export async function recordPayment(invoiceId: string, formData: FormData) {
  const user = await requireStaff(BILLING_ROLES);
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (inv.status === "VOID") redirect(`/invoices/${invoiceId}?error=Invoice+is+void`);
  const amount = round2(Number(formData.get("amount")));
  const method = String(formData.get("method") ?? "CARD") as PaymentMethod;
  const reference = String(formData.get("reference") ?? "").trim() || null;
  const balance = round2(Number(inv.total) - Number(inv.amountPaid));
  if (!(amount > 0)) redirect(`/invoices/${invoiceId}?error=Enter+an+amount`);
  if (amount > balance + 0.005) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(`Amount exceeds balance of $${balance.toFixed(2)}`)}`);
  const paid = round2(Number(inv.amountPaid) + amount);
  await db.$transaction([
    db.payment.create({ data: { invoiceId, amount, method, reference } }),
    db.invoice.update({ where: { id: invoiceId }, data: { amountPaid: paid, status: paid >= Number(inv.total) - 0.005 ? "PAID" : "PARTIAL" } }),
  ]);
  if (paid >= Number(inv.total) - 0.005) {
    await queueNotification({ customerId: inv.customerId, workOrderId: inv.workOrderId, subject: "Payment received — thank you", body: `We received your payment of $${amount.toFixed(2)}. Your invoice is paid in full.` });
  }
  await db.auditLog.create({ data: { userId: user.id, action: "payment", entity: "Invoice", entityId: invoiceId, detail: `$${amount.toFixed(2)} ${method}` } });
  emitWebhook("payment.recorded", { invoiceId, invoiceNumber: inv.number, amount, method, reference, amountPaid: paid, total: Number(inv.total), customerId: inv.customerId, by: user.name });
  if (paid >= Number(inv.total) - 0.005) emitWebhook("invoice.paid", { id: invoiceId, number: inv.number, total: Number(inv.total), customerId: inv.customerId, workOrderId: inv.workOrderId });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  redirect(`/invoices/${invoiceId}?ok=Payment+recorded`);
}

export async function voidInvoice(invoiceId: string) {
  const user = await requireStaff(["OWNER", "ADMIN"]);
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true } });
  if (inv.payments.length) redirect(`/invoices/${invoiceId}?error=Invoices+with+payments+cannot+be+voided`);
  await db.$transaction([
    db.invoice.update({ where: { id: invoiceId }, data: { status: "VOID" } }),
    db.workOrder.update({ where: { id: inv.workOrderId }, data: { status: "COMPLETED" } }),
  ]);
  await db.auditLog.create({ data: { userId: user.id, action: "void", entity: "Invoice", entityId: invoiceId } });
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?ok=Invoice+voided`);
}

export async function updateInvoiceNotes(invoiceId: string, formData: FormData) {
  await requireStaff(BILLING_ROLES);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const dueRaw = String(formData.get("dueAt") ?? "");
  await db.invoice.update({ where: { id: invoiceId }, data: { notes, dueAt: dueRaw ? new Date(dueRaw) : null } });
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?ok=Saved`);
}

export async function resendInvoice(invoiceId: string) {
  await requireStaff(BILLING_ROLES);
  const inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  await queueNotification({ customerId: inv.customerId, workOrderId: inv.workOrderId, subject: `Invoice ${String(inv.number).padStart(5, "0")}`, body: `Your invoice for $${Number(inv.total).toFixed(2)} is available in your portal. Balance due: $${(Number(inv.total) - Number(inv.amountPaid)).toFixed(2)}.` });
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?ok=Invoice+sent`);
}
