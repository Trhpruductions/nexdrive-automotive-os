"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, rawDb, withShop, currentShopId, nextNumber } from "@/lib/db";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { computeTotals } from "@/lib/money";
import { queueNotification } from "@/lib/notify";
import { renderTemplate } from "@/lib/templates";
import { emitWebhook } from "@/lib/webhooks";
import type { FormState } from "./customers";
import type { WorkOrderStatus } from "@/generated/prisma/enums";

const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// ───────── create / edit ─────────

const CreateSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  vehicleId: z.string().min(1, "Choose a vehicle"),
  complaint: z.string().trim().min(3, "Describe the customer's complaint"),
  technicianId: z.string().optional(),
  bayId: z.string().optional(),
  mileageIn: z.coerce.number().int().min(0).optional(),
  promisedAt: z.string().optional(),
  status: z.enum(["ESTIMATE", "APPROVED"]).default("ESTIMATE"),
  appointmentId: z.string().optional(),
});

export async function createWorkOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const parsed = CreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const vehicle = await db.vehicle.findUnique({ where: { id: d.vehicleId } });
  if (!vehicle || vehicle.customerId !== d.customerId) return { error: "That vehicle doesn't belong to the selected customer" };

  const wo = await db.workOrder.create({
    data: { shopId: await currentShopId(),
      number: await nextNumber("wo"),
      customerId: d.customerId,
      vehicleId: d.vehicleId,
      complaint: d.complaint,
      technicianId: opt(d.technicianId),
      bayId: opt(d.bayId),
      mileageIn: d.mileageIn ?? vehicle.mileage,
      promisedAt: d.promisedAt ? new Date(d.promisedAt) : null,
      status: d.status,
      approvedAt: d.status === "APPROVED" ? new Date() : null,
      approvedBy: d.status === "APPROVED" ? `${user.name} (in person)` : null,
    },
  });
  if (d.mileageIn && d.mileageIn > vehicle.mileage) await db.vehicle.update({ where: { id: vehicle.id }, data: { mileage: d.mileageIn } });
  if (d.appointmentId) await db.appointment.update({ where: { id: d.appointmentId }, data: { workOrderId: wo.id, status: "CHECKED_IN" } }).catch(() => null);
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "create", entity: "WorkOrder", entityId: wo.id, detail: `#${wo.number}` } });
  emitWebhook("work_order.created", { ...wo, vehicle, createdBy: user.name });
  revalidatePath("/work-orders");
  redirect(`/work-orders/${wo.id}`);
}

const DetailsSchema = z.object({
  complaint: z.string().trim().min(3),
  diagnosis: z.string().optional(),
  technicianNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  technicianId: z.string().optional(),
  bayId: z.string().optional(),
  mileageIn: z.coerce.number().int().min(0).optional(),
  mileageOut: z.coerce.number().int().min(0).optional(),
  promisedAt: z.string().optional(),
});

export async function updateWorkOrderDetails(id: string, formData: FormData) {
  await requireStaff();
  const parsed = DetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/work-orders/${id}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  const d = parsed.data;
  await db.workOrder.update({
    where: { id },
    data: {
      complaint: d.complaint,
      diagnosis: opt(d.diagnosis),
      technicianNotes: opt(d.technicianNotes),
      internalNotes: opt(d.internalNotes),
      technicianId: opt(d.technicianId),
      bayId: opt(d.bayId),
      mileageIn: d.mileageIn ?? null,
      mileageOut: d.mileageOut ?? null,
      promisedAt: d.promisedAt ? new Date(d.promisedAt) : null,
    },
  });
  revalidatePath(`/work-orders/${id}`);
  redirect(`/work-orders/${id}?ok=Saved`);
}

// ───────── lines ─────────

const LineSchema = z.object({
  kind: z.enum(["LABOR", "PART", "FEE", "DISCOUNT"]),
  description: z.string().trim().optional().default(""),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  hours: z.coerce.number().min(0).optional(),
  partId: z.string().optional(),
  taxable: z.coerce.boolean().optional(),
});

export async function addLine(workOrderId: string, formData: FormData) {
  await requireStaff();
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.taxable = formData.has("taxable");
  const parsed = LineSchema.safeParse(raw);
  if (!parsed.success) redirect(`/work-orders/${workOrderId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid line")}#lines`);
  const d = parsed.data;
  const settings = await getSettings();
  const count = await db.workOrderLine.count({ where: { workOrderId } });

  let description = d.description;
  let unitPrice = d.unitPrice;
  let partId: string | null = null;
  if (d.kind === "PART" && d.partId) {
    const part = await db.part.findUnique({ where: { id: d.partId } });
    if (part) {
      partId = part.id;
      if (!formData.get("description")) description = part.name;
      if (!formData.get("unitPrice")) unitPrice = Number(part.price);
    }
  }
  if (d.kind === "LABOR" && !formData.get("unitPrice")) unitPrice = settings.laborRate;
  if (!description) redirect(`/work-orders/${workOrderId}?error=Description+is+required#lines`);

  await db.workOrderLine.create({
    data: {
      workOrderId,
      kind: d.kind,
      description,
      quantity: d.kind === "LABOR" ? d.hours ?? d.quantity : d.quantity,
      hours: d.kind === "LABOR" ? d.hours ?? d.quantity : null,
      unitPrice,
      partId,
      taxable: d.kind === "LABOR" ? Boolean(d.taxable) : d.kind === "DISCOUNT" ? false : d.taxable ?? true,
      sortOrder: count,
    },
  });
  await touch(workOrderId);
  revalidatePath(`/work-orders/${workOrderId}`);
  redirect(`/work-orders/${workOrderId}#lines`);
}

export async function addCannedService(workOrderId: string, formData: FormData) {
  await requireStaff();
  const serviceId = String(formData.get("cannedServiceId") ?? "");
  const svc = await db.cannedService.findUnique({ where: { id: serviceId }, include: { parts: { include: { part: true } } } });
  if (!svc) redirect(`/work-orders/${workOrderId}?error=Service+not+found`);
  const settings = await getSettings();
  const count = await db.workOrderLine.count({ where: { workOrderId } });
  const rate = svc.laborRate ? Number(svc.laborRate) : settings.laborRate;
  await db.workOrderLine.create({
    data: { workOrderId, kind: "LABOR", description: svc.name, hours: svc.laborHours, quantity: svc.laborHours, unitPrice: rate, taxable: false, sortOrder: count },
  });
  let i = 1;
  for (const p of svc.parts) {
    await db.workOrderLine.create({
      data: { workOrderId, kind: "PART", description: p.part.name, quantity: p.quantity, unitPrice: p.part.price, partId: p.partId, taxable: true, sortOrder: count + i++ },
    });
  }
  await touch(workOrderId);
  revalidatePath(`/work-orders/${workOrderId}`);
  redirect(`/work-orders/${workOrderId}#lines`);
}

export async function updateLine(lineId: string, formData: FormData) {
  await requireStaff();
  const line = await db.workOrderLine.findUniqueOrThrow({ where: { id: lineId } });
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.kind = line.kind;
  raw.taxable = formData.has("taxable");
  const parsed = LineSchema.safeParse(raw);
  if (!parsed.success) redirect(`/work-orders/${line.workOrderId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid line")}#lines`);
  const d = parsed.data;
  if (!d.description) redirect(`/work-orders/${line.workOrderId}?error=Description+is+required#lines`);
  await db.workOrderLine.update({
    where: { id: lineId },
    data: {
      description: d.description,
      quantity: line.kind === "LABOR" ? d.hours ?? d.quantity : d.quantity,
      hours: line.kind === "LABOR" ? d.hours ?? d.quantity : null,
      unitPrice: d.unitPrice,
      taxable: line.kind === "DISCOUNT" ? false : Boolean(d.taxable),
      approved: formData.has("approved") ? formData.get("approved") === "true" : line.approved,
    },
  });
  await touch(line.workOrderId);
  revalidatePath(`/work-orders/${line.workOrderId}`);
  redirect(`/work-orders/${line.workOrderId}#lines`);
}

export async function toggleLineApproved(lineId: string) {
  await requireStaff();
  const line = await db.workOrderLine.findUniqueOrThrow({ where: { id: lineId } });
  await db.workOrderLine.update({ where: { id: lineId }, data: { approved: !line.approved } });
  await touch(line.workOrderId);
  revalidatePath(`/work-orders/${line.workOrderId}`);
}

export async function removeLine(lineId: string) {
  await requireStaff();
  const line = await db.workOrderLine.delete({ where: { id: lineId } });
  await touch(line.workOrderId);
  revalidatePath(`/work-orders/${line.workOrderId}`);
}

// ───────── workflow ─────────

const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  ESTIMATE: ["AWAITING_APPROVAL", "APPROVED", "CANCELLED"],
  AWAITING_APPROVAL: ["APPROVED", "ESTIMATE", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "ON_HOLD", "ESTIMATE", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "APPROVED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["INVOICED", "IN_PROGRESS"],
  INVOICED: [],
  CANCELLED: ["ESTIMATE"],
};

export async function setWorkOrderStatus(id: string, status: WorkOrderStatus) {
  const user = await requireStaff();
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id }, include: { vehicle: true, customer: true } });
  if (!TRANSITIONS[wo.status].includes(status)) redirect(`/work-orders/${id}?error=${encodeURIComponent(`Can't move from ${wo.status} to ${status}`)}`);
  if (status === "INVOICED") redirect(`/work-orders/${id}?error=Use+Create+invoice`);

  const now = new Date();
  const data: Record<string, unknown> = { status };
  if (status === "APPROVED" && !wo.approvedAt) {
    data.approvedAt = now;
    data.approvedBy = `${user.name} (in person)`;
  }
  if (status === "IN_PROGRESS" && !wo.startedAt) data.startedAt = now;
  if (status === "COMPLETED") {
    data.completedAt = now;
    if (wo.mileageOut == null) data.mileageOut = wo.mileageIn;
  }
  if (status === "ESTIMATE") {
    data.approvedAt = null;
    data.approvedBy = null;
    data.approvalToken = null;
  }
  await db.workOrder.update({ where: { id }, data });

  if (status === "IN_PROGRESS" && wo.technicianId) {
    const open = await db.timeEntry.findFirst({ where: { workOrderId: id, technicianId: wo.technicianId, endedAt: null } });
    if (!open) await db.timeEntry.create({ data: { workOrderId: id, technicianId: wo.technicianId } });
  }
  if ((status === "ON_HOLD" || status === "COMPLETED") && wo.technicianId) {
    await db.timeEntry.updateMany({ where: { workOrderId: id, endedAt: null }, data: { endedAt: now } });
  }
  if (status === "COMPLETED") {
    await db.appointment.updateMany({ where: { workOrderId: id }, data: { status: "COMPLETED" } });
    const t = await renderTemplate("vehicle_ready", { customer: wo.customer.firstName, vehicle: `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}` });
    await queueNotification({ customerId: wo.customerId, workOrderId: id, ...t });
  }
  if (status === "ON_HOLD") {
    const t = await renderTemplate("waiting_parts", { customer: wo.customer.firstName, vehicle: `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}` });
    await queueNotification({ customerId: wo.customerId, workOrderId: id, ...t });
  }
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: `status:${status}`, entity: "WorkOrder", entityId: id, detail: `#${wo.number}` } });
  emitWebhook("work_order.status_changed", { id, number: wo.number, from: wo.status, to: status, vehicle: wo.vehicle, customer: { id: wo.customer.id, firstName: wo.customer.firstName, lastName: wo.customer.lastName }, by: user.name });
  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  redirect(`/work-orders/${id}?ok=${encodeURIComponent(`Status: ${status.replace("_", " ").toLowerCase()}`)}`);
}

/** Generate an approval link and notify the customer (email/SMS/portal). */
export async function sendForApproval(id: string) {
  const user = await requireStaff(BILLING_ROLES);
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id }, include: { vehicle: true, customer: true, lines: true } });
  if (!wo.lines.length) redirect(`/work-orders/${id}?error=Add+at+least+one+line+before+sending`);
  const token = wo.approvalToken ?? randomBytes(18).toString("base64url");
  const link = `${process.env.APP_URL ?? ""}/approve/${token}`;
  await db.workOrder.update({ where: { id }, data: { status: "AWAITING_APPROVAL", approvalToken: token, sentForApprovalAt: new Date(), approvedAt: null, approvedBy: null, declinedAt: null } });
  const settings = await getSettings();
  const totals = computeTotals(wo.lines, settings.taxRate, { taxExempt: wo.customer.taxExempt });
  const t = await renderTemplate("estimate_ready", { customer: wo.customer.firstName, vehicle: `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}`, total: totals.total.toLocaleString("en-US", { style: "currency", currency: "USD" }), link });
  await queueNotification({ customerId: wo.customerId, workOrderId: id, ...t, channels: ["EMAIL", "SMS", "PORTAL"] });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "send_for_approval", entity: "WorkOrder", entityId: id, detail: `#${wo.number}` } });
  emitWebhook("work_order.sent_for_approval", { id, number: wo.number, total: totals.total, approvalUrl: link, vehicle: wo.vehicle, customer: { id: wo.customer.id, firstName: wo.customer.firstName, lastName: wo.customer.lastName, email: wo.customer.email } });
  revalidatePath(`/work-orders/${id}`);
  redirect(`/work-orders/${id}?ok=Estimate+sent+to+customer`);
}

/** Public: customer approves / declines via token link (no login). */
export async function respondToEstimate(token: string, formData: FormData) {
  const found = await rawDb.workOrder.findUnique({ where: { approvalToken: token }, select: { shopId: true } });
  if (!found) redirect(`/approve/${token}?error=This+estimate+is+no+longer+open`);
  return withShop(found.shopId, () => respondToEstimateScoped(token, formData));
}

async function respondToEstimateScoped(token: string, formData: FormData) {
  const wo = await db.workOrder.findFirst({ where: { approvalToken: token }, include: { lines: true } });
  if (!wo || wo.status !== "AWAITING_APPROVAL") redirect(`/approve/${token}?error=This+estimate+is+no+longer+open`);
  const decision = String(formData.get("decision") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (decision === "decline") {
    await db.workOrder.update({ where: { id: wo.id }, data: { status: "ESTIMATE", declinedAt: new Date(), approvedBy: name || null } });
    await db.auditLog.create({ data: { shopId: await currentShopId(), action: "estimate_declined", entity: "WorkOrder", entityId: wo.id, detail: name } });
    emitWebhook("work_order.declined", { id: wo.id, number: wo.number, by: name || null });
    redirect(`/approve/${token}?done=declined`);
  }
  if (!name) redirect(`/approve/${token}?error=Please+type+your+name+to+approve`);
  // per-line approval
  const approvedIds = new Set(formData.getAll("line").map(String));
  for (const line of wo.lines) {
    const approved = approvedIds.size ? approvedIds.has(line.id) : true;
    if (line.approved !== approved) await db.workOrderLine.update({ where: { id: line.id }, data: { approved } });
  }
  await db.workOrder.update({ where: { id: wo.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedBy: name, declinedAt: null } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), action: "estimate_approved", entity: "WorkOrder", entityId: wo.id, detail: name } });
  emitWebhook("work_order.approved", { id: wo.id, number: wo.number, by: name, approvedLineIds: approvedIds.size ? [...approvedIds] : wo.lines.map((l) => l.id) });
  redirect(`/approve/${token}?done=approved`);
}

/** Portal: logged-in customer approves from their account. */
export async function portalApprove(workOrderId: string, formData: FormData) {
  const { requireCustomer } = await import("@/lib/auth");
  const user = await requireCustomer();
  const wo = await db.workOrder.findUnique({ where: { id: workOrderId }, include: { lines: true } });
  if (!wo || wo.customerId !== user.customerId || wo.status !== "AWAITING_APPROVAL") redirect("/portal?error=Estimate+not+available");
  const decision = String(formData.get("decision") ?? "approve");
  if (decision === "decline") {
    await db.workOrder.update({ where: { id: wo.id }, data: { status: "ESTIMATE", declinedAt: new Date(), approvedBy: user.name } });
    redirect(`/portal/service/${wo.id}?ok=Estimate+declined`);
  }
  const approvedIds = new Set(formData.getAll("line").map(String));
  for (const line of wo.lines) {
    const approved = approvedIds.size ? approvedIds.has(line.id) : true;
    if (line.approved !== approved) await db.workOrderLine.update({ where: { id: line.id }, data: { approved } });
  }
  await db.workOrder.update({ where: { id: wo.id }, data: { status: "APPROVED", approvedAt: new Date(), approvedBy: `${user.name} (portal)`, declinedAt: null } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "estimate_approved", entity: "WorkOrder", entityId: wo.id, detail: "portal" } });
  emitWebhook("work_order.approved", { id: wo.id, number: wo.number, by: `${user.name} (portal)` });
  revalidatePath("/portal");
  redirect(`/portal/service/${wo.id}?ok=Estimate+approved`);
}

// ───────── invoice ─────────

export async function createInvoice(workOrderId: string) {
  const user = await requireStaff(BILLING_ROLES);
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, include: { lines: true, customer: true, invoice: true } });
  if (wo.invoice) redirect(`/invoices/${wo.invoice.id}`);
  if (!["COMPLETED", "IN_PROGRESS", "APPROVED", "ON_HOLD"].includes(wo.status)) redirect(`/work-orders/${workOrderId}?error=Approve+the+work+before+invoicing`);
  const settings = await getSettings();
  const t = computeTotals(wo.lines, settings.taxRate, { taxExempt: wo.customer.taxExempt });
  const invoice = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: { shopId: await currentShopId(),
        number: await nextNumber("inv"),
        workOrderId,
        customerId: wo.customerId,
        status: "SENT",
        dueAt: new Date(Date.now() + 14 * 86_400_000),
        subtotal: t.subtotal,
        discount: Math.abs(t.discount),
        taxRate: settings.taxRate,
        tax: t.tax,
        total: t.total,
      },
    });
    await tx.workOrder.update({ where: { id: workOrderId }, data: { status: "INVOICED", completedAt: wo.completedAt ?? new Date() } });
    // consume parts from stock
    for (const line of wo.lines) {
      if (line.kind === "PART" && line.partId && line.approved) {
        const qty = Math.round(Number(line.quantity));
        await tx.part.update({ where: { id: line.partId }, data: { quantityOnHand: { decrement: qty } } });
        await tx.stockMovement.create({ data: { partId: line.partId, delta: -qty, reason: "Used on work order", reference: `WO-${wo.number}` } });
      }
    }
    await tx.timeEntry.updateMany({ where: { workOrderId, endedAt: null }, data: { endedAt: new Date() } });
    return inv;
  });
  const tpl = await renderTemplate("invoice_ready", { customer: wo.customer.firstName, invoice: `INV-${String(invoice.number).padStart(5, "0")}`, total: t.total.toLocaleString("en-US", { style: "currency", currency: "USD" }) });
  await queueNotification({ customerId: wo.customerId, workOrderId, ...tpl });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "invoice", entity: "Invoice", entityId: invoice.id, detail: `WO-${wo.number}` } });
  emitWebhook("invoice.created", { ...invoice, workOrderNumber: wo.number, customer: { id: wo.customer.id, firstName: wo.customer.firstName, lastName: wo.customer.lastName, email: wo.customer.email } });
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}?ok=Invoice+created`);
}

export async function deleteWorkOrder(id: string) {
  await requireStaff(["OWNER", "ADMIN"]);
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id }, include: { invoice: true } });
  if (wo.invoice) redirect(`/work-orders/${id}?error=Invoiced+work+orders+cannot+be+deleted`);
  await db.workOrder.delete({ where: { id } });
  revalidatePath("/work-orders");
  redirect("/work-orders?ok=Work+order+deleted");
}

async function touch(workOrderId: string) {
  await db.workOrder.update({ where: { id: workOrderId }, data: { updatedAt: new Date() } });
}
