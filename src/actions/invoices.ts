"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, currentShopId } from "@/lib/db";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { queueNotification } from "@/lib/notify";
import { publicBase, renderTemplate } from "@/lib/templates";
import { randomBytes } from "node:crypto";
import { round2 } from "@/lib/money";
import { applyPayment } from "@/lib/payments";
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
  await applyPayment({ invoiceId, amount, method, reference, userId: user.id, by: user.name });
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
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "void", entity: "Invoice", entityId: invoiceId } });
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
  let inv = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (!inv.payToken) inv = await db.invoice.update({ where: { id: invoiceId }, data: { payToken: randomBytes(18).toString("base64url") } });
  const c = await db.customer.findUnique({ where: { id: inv.customerId }, select: { firstName: true } });
  const t = await renderTemplate("invoice_ready", { customer: c?.firstName ?? "", invoice: `INV-${String(inv.number).padStart(5, "0")}`, total: `$${Number(inv.total).toFixed(2)}`, link: `${await publicBase()}/pay/${inv.payToken}` });
  await queueNotification({ customerId: inv.customerId, workOrderId: inv.workOrderId, ...t });
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?ok=Invoice+sent`);
}
