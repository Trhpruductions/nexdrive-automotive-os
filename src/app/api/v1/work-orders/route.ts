import { db, currentShopId, nextNumber } from "@/lib/db";
import { ApiError, date, handler, json, num, pageResponse, paging, readBody, str } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { computeTotals } from "@/lib/money";
import { emitWebhook } from "@/lib/webhooks";
import type { WorkOrderStatus } from "@/generated/prisma/enums";

const STATUSES: WorkOrderStatus[] = ["ESTIMATE", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "INVOICED", "CANCELLED"];

export const GET = handler("read", async (req) => {
  const p = paging(req);
  const settings = await getSettings();
  const status = p.sp.get("status")?.toUpperCase();
  const since = p.sp.get("since");
  const where = {
    ...(status === "OPEN" ? { status: { notIn: ["INVOICED", "CANCELLED"] as WorkOrderStatus[] } } : status && STATUSES.includes(status as WorkOrderStatus) ? { status: status as WorkOrderStatus } : {}),
    ...(p.sp.get("customerId") ? { customerId: p.sp.get("customerId")! } : {}),
    ...(p.sp.get("vehicleId") ? { vehicleId: p.sp.get("vehicleId")! } : {}),
    ...(since ? { updatedAt: { gte: new Date(since) } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.workOrder.count({ where }),
    db.workOrder.findMany({ where, orderBy: { updatedAt: "desc" }, skip: p.skip, take: p.limit, include: { customer: { select: { id: true, firstName: true, lastName: true, taxExempt: true } }, vehicle: { select: { id: true, year: true, make: true, model: true, licensePlate: true } }, technician: { select: { id: true, name: true } }, lines: true, invoice: { select: { id: true, number: true, status: true, total: true, amountPaid: true } } } }),
  ]);
  return pageResponse(
    rows.map((w) => ({ ...w, totals: computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt }) })),
    total,
    p,
  );
});

export const POST = handler("write", async (req, { key }) => {
  const b = await readBody(req);
  const settings = await getSettings();
  const vehicleId = str(b.vehicleId, "vehicleId", { required: true })!;
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new ApiError(422, "vehicleId does not exist.", "validation");
  const rawLines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
  const lines = rawLines.map((l, i) => {
    const kind = String(l.kind ?? "LABOR").toUpperCase();
    if (!["LABOR", "PART", "FEE", "DISCOUNT"].includes(kind)) throw new ApiError(422, `lines[${i}].kind must be LABOR, PART, FEE or DISCOUNT.`, "validation");
    const qty = kind === "LABOR" ? num(l.hours ?? l.quantity, `lines[${i}].hours`, { min: 0 }) ?? 1 : num(l.quantity, `lines[${i}].quantity`, { min: 0 }) ?? 1;
    return {
      kind: kind as "LABOR" | "PART" | "FEE" | "DISCOUNT",
      description: str(l.description, `lines[${i}].description`, { required: true, max: 300 })!,
      quantity: qty,
      hours: kind === "LABOR" ? qty : null,
      unitPrice: num(l.unitPrice, `lines[${i}].unitPrice`, { min: 0 }) ?? (kind === "LABOR" ? settings.laborRate : 0),
      taxable: kind === "DISCOUNT" ? false : l.taxable != null ? Boolean(l.taxable) : kind !== "LABOR",
      sortOrder: i,
    };
  });
  const wo = await db.workOrder.create({
    data: { shopId: await currentShopId(),
      number: await nextNumber("wo"),
      customerId: vehicle.customerId,
      vehicleId,
      complaint: str(b.complaint, "complaint", { required: true, max: 2000 })!,
      diagnosis: str(b.diagnosis, "diagnosis", { max: 4000 }) ?? null,
      technicianId: str(b.technicianId, "technicianId") ?? null,
      mileageIn: num(b.mileageIn, "mileageIn", { int: true, min: 0 }) ?? vehicle.mileage,
      promisedAt: date(b.promisedAt, "promisedAt") ?? null,
      lines: { create: lines },
    },
    include: { lines: true, customer: true, vehicle: true },
  });
  await db.auditLog.create({ data: { shopId: await currentShopId(), action: "create", entity: "WorkOrder", entityId: wo.id, detail: `#${wo.number} via API key ${key.name}` } });
  emitWebhook("work_order.created", wo);
  return json({ ...wo, totals: computeTotals(wo.lines, settings.taxRate, { taxExempt: wo.customer.taxExempt }) }, { status: 201 });
});
