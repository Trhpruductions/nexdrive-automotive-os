import "server-only";
import { db, currentShopId, nextNumber } from "./db";
import { getSettings } from "./settings";
import { emitWebhook } from "./webhooks";

/**
 * Production ↔ maintenance. A machine on the live feed can be tied to an asset
 * record (the "vehicle" table, whatever the business type calls it) so alarms
 * open work orders, run-hours drive interval reminders, and the job history
 * lives in one place. Runs inside shop context.
 */

/** The shop's own customer record for in-house equipment (created on first use). */
export async function houseCustomer() {
  const s = await getSettings();
  const existing = await db.customer.findFirst({ where: { company: "In-house", lastName: s.name } });
  if (existing) return existing;
  return db.customer.create({ data: { shopId: await currentShopId(), firstName: "Maintenance", lastName: s.name, company: "In-house", email: s.email ?? null, phone: s.phone ?? null, notes: "Internal customer for the shop's own machines and equipment.", taxExempt: true } });
}

/** Ensure the machine has an asset record; create one from the machine if needed. */
export async function assetForMachine(machineId: string) {
  const m = await db.machine.findUniqueOrThrow({ where: { id: machineId }, include: { asset: true, line: true } });
  if (m.asset) return m.asset;
  const owner = await houseCustomer();
  const hours = (m.metrics as Record<string, { value?: number }>)[m.hoursMetric]?.value;
  const asset = await db.vehicle.create({
    data: {
      shopId: await currentShopId(), customerId: owner.id,
      year: m.createdAt.getFullYear(), make: m.type || "Machine", model: m.name, vin: m.code, licensePlate: m.line?.name ?? null,
      mileage: hours ? Math.round(hours) : 0, notes: `Asset record for machine ${m.code}${m.line ? ` on ${m.line.name}` : ""}.`,
    },
  });
  await db.machine.update({ where: { id: m.id }, data: { assetId: asset.id } });
  return asset;
}

/** Open a maintenance work order for the machine (one open job at a time). */
export async function openMaintenanceJob(machineId: string, opts: { complaint: string; by?: string | null; userId?: string | null; source?: string }) {
  const asset = await assetForMachine(machineId);
  const open = await db.workOrder.findFirst({ where: { vehicleId: asset.id, status: { notIn: ["INVOICED", "CANCELLED", "COMPLETED"] } } });
  if (open) return { workOrder: open, created: false };
  const wo = await db.workOrder.create({
    data: { shopId: await currentShopId(), number: await nextNumber("wo"), customerId: asset.customerId, vehicleId: asset.id, status: "APPROVED", approvedAt: new Date(), approvedBy: opts.by ?? "Auto (machine alarm)", complaint: opts.complaint, mileageIn: asset.mileage, internalNotes: opts.source ? `Opened from ${opts.source}` : null },
  });
  await db.machine.update({ where: { id: machineId }, data: { status: "MAINTENANCE", lastStatusChangeAt: new Date() } });
  await db.machineEvent.create({ data: { machineId, type: "STATUS", status: "MAINTENANCE", message: `Maintenance job WO-${String(wo.number).padStart(5, "0")} opened` } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: opts.userId ?? null, action: "create", entity: "WorkOrder", entityId: wo.id, detail: `#${wo.number} from machine` } });
  emitWebhook("work_order.created", { id: wo.id, number: wo.number, status: wo.status, complaint: wo.complaint, machineId, assetId: asset.id });
  return { workOrder: wo, created: true };
}

/** A run-hours reading updates the linked asset's counter so interval reminders fire. */
export async function syncRunHours(machineId: string, metric: string, value: number) {
  const m = await db.machine.findUnique({ where: { id: machineId }, select: { assetId: true, hoursMetric: true } });
  if (!m?.assetId || metric !== m.hoursMetric) return;
  const hours = Math.round(value);
  await db.vehicle.updateMany({ where: { id: m.assetId, mileage: { lt: hours } }, data: { mileage: hours } });
}
