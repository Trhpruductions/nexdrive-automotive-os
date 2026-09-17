import { db, currentShopId } from "@/lib/db";
import { ApiError, date, handler, json, readBody, str } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { computeTotals } from "@/lib/money";
import { emitWebhook } from "@/lib/webhooks";
import type { WorkOrderStatus } from "@/generated/prisma/enums";

// Status moves the API may make. Invoicing and customer approval go through the app / approval link.
const ALLOWED: Record<string, WorkOrderStatus[]> = {
  ESTIMATE: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["IN_PROGRESS"],
  AWAITING_APPROVAL: ["APPROVED", "CANCELLED"],
  CANCELLED: ["ESTIMATE"],
  INVOICED: [],
};

async function load(id: string) {
  const w = await db.workOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, taxExempt: true } },
      vehicle: { select: { id: true, year: true, make: true, model: true, licensePlate: true, vin: true, mileage: true } },
      technician: { select: { id: true, name: true } },
      bay: { select: { id: true, name: true } },
      lines: { orderBy: { sortOrder: "asc" } },
      inspection: { include: { items: true } },
      invoice: { select: { id: true, number: true, status: true, total: true, amountPaid: true, issuedAt: true } },
      photos: { select: { id: true, url: true, caption: true, kind: true } },
    },
  });
  if (!w) throw new ApiError(404, "Work order not found", "not_found");
  return w;
}

export const GET = handler("read", async (_req, { params }) => {
  const settings = await getSettings();
  const w = await load(params.id);
  return json({ ...w, totals: computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt }) });
});

export const PATCH = handler("write", async (req, { params, key }) => {
  const b = await readBody(req);
  const settings = await getSettings();
  const current = await load(params.id);
  const data: Record<string, unknown> = {};
  for (const f of ["complaint", "diagnosis", "technicianNotes", "internalNotes"] as const) if (f in b) data[f] = str(b[f], f, { max: 4000 }) ?? null;
  if ("technicianId" in b) data.technicianId = str(b.technicianId, "technicianId") ?? null;
  if ("promisedAt" in b) data.promisedAt = date(b.promisedAt, "promisedAt") ?? null;
  let statusChanged: WorkOrderStatus | null = null;
  if (b.status != null) {
    const to = String(b.status).toUpperCase() as WorkOrderStatus;
    if (!(ALLOWED[current.status] ?? []).includes(to)) throw new ApiError(422, `Cannot move from ${current.status} to ${to} via the API.`, "invalid_transition");
    data.status = to;
    statusChanged = to;
    const now = new Date();
    if (to === "APPROVED" && !current.approvedAt) Object.assign(data, { approvedAt: now, approvedBy: `API (${key.name})` });
    if (to === "IN_PROGRESS" && !current.startedAt) data.startedAt = now;
    if (to === "COMPLETED") data.completedAt = now;
    if (to === "ESTIMATE") Object.assign(data, { approvedAt: null, approvedBy: null, approvalToken: null });
  }
  await db.workOrder.update({ where: { id: params.id }, data });
  const w = await load(params.id);
  if (statusChanged) {
    await db.auditLog.create({ data: { shopId: await currentShopId(), action: `status:${statusChanged}`, entity: "WorkOrder", entityId: w.id, detail: `#${w.number} via API key ${key.name}` } });
    emitWebhook("work_order.status_changed", { id: w.id, number: w.number, from: current.status, to: statusChanged, vehicle: w.vehicle, customer: w.customer });
  }
  return json({ ...w, totals: computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt }) });
});
