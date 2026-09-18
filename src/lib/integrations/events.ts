import "server-only";
import { z } from "zod";
import { db, rawDb, currentShopId } from "@/lib/db";
import { bus } from "./bus";
import { emitWebhook } from "@/lib/webhooks";
import { openMaintenanceJob, syncRunHours } from "@/lib/maintenance";
import { applyPressCount } from "@/lib/production";
import type { MachineStatus } from "@/generated/prisma/enums";

/**
 * Canonical event format every feed is normalised into. Machines, MES systems,
 * supplier APIs and CSV files all end up here, so the rest of the OS only ever
 * deals with one shape.
 */
const Status = z.preprocess(
  (v) => normaliseStatus(v),
  z.enum(["RUNNING", "IDLE", "DOWN", "MAINTENANCE", "OFFLINE"]),
);

const When = z.preprocess((v) => (v == null || v === "" ? undefined : typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v))), z.date().optional());

export const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("machine.status"), machine: z.string().min(1), name: z.string().optional(), line: z.string().optional(), status: Status, message: z.string().optional(), at: When }),
  z.object({ type: z.literal("machine.count"), machine: z.string().min(1), name: z.string().optional(), line: z.string().optional(), count: z.coerce.number().int().min(0), good: z.coerce.number().int().min(0).optional(), scrap: z.coerce.number().int().min(0).optional(), at: When }),
  z.object({ type: z.literal("machine.reading"), machine: z.string().min(1), name: z.string().optional(), line: z.string().optional(), metric: z.string().min(1), value: z.coerce.number(), unit: z.string().optional(), at: When }),
  z.object({ type: z.literal("machine.alarm"), machine: z.string().min(1), name: z.string().optional(), line: z.string().optional(), code: z.string().optional(), message: z.string().min(1), severity: z.enum(["info", "warning", "critical"]).optional(), at: When }),
  z.object({ type: z.literal("machine.heartbeat"), machine: z.string().min(1), name: z.string().optional(), line: z.string().optional(), at: When }),
  z.object({ type: z.literal("inventory.set"), sku: z.string().min(1), quantity: z.coerce.number().int().min(0), location: z.string().optional(), name: z.string().optional(), reason: z.string().optional() }),
  z.object({ type: z.literal("inventory.adjust"), sku: z.string().min(1), delta: z.coerce.number().int(), reason: z.string().optional(), reference: z.string().optional() }),
  z.object({ type: z.literal("inventory.price"), sku: z.string().min(1), cost: z.coerce.number().min(0).optional(), price: z.coerce.number().min(0).optional(), name: z.string().optional(), supplier: z.string().optional() }),
]);
export type CanonicalEvent = z.infer<typeof EventSchema>;

export const PayloadSchema = z.union([
  z.object({ events: z.array(z.unknown()) }),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

const STATUS_WORDS: Record<string, MachineStatus> = {
  running: "RUNNING", run: "RUNNING", active: "RUNNING", on: "RUNNING", producing: "RUNNING", auto: "RUNNING", cycle: "RUNNING", "1": "RUNNING", true: "RUNNING",
  idle: "IDLE", waiting: "IDLE", standby: "IDLE", ready: "IDLE", starved: "IDLE", blocked: "IDLE", "0": "IDLE", false: "IDLE",
  down: "DOWN", fault: "DOWN", faulted: "DOWN", error: "DOWN", alarm: "DOWN", stopped: "DOWN", stop: "DOWN", estop: "DOWN", "e-stop": "DOWN", failed: "DOWN",
  maintenance: "MAINTENANCE", maint: "MAINTENANCE", service: "MAINTENANCE", setup: "MAINTENANCE", changeover: "MAINTENANCE", pm: "MAINTENANCE",
  offline: "OFFLINE", off: "OFFLINE", disconnected: "OFFLINE", unknown: "OFFLINE",
};

export function normaliseStatus(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.toUpperCase() in { RUNNING: 1, IDLE: 1, DOWN: 1, MAINTENANCE: 1, OFFLINE: 1 }) return s.toUpperCase();
  return STATUS_WORDS[s] ?? s.toUpperCase();
}

export type ApplyResult = { applied: number; errors: string[]; touchedMachines: string[]; touchedParts: string[] };

/** Validate + apply a batch of canonical events. Unknown machines/lines are auto-created. */
export async function applyEvents(rawEvents: unknown[], ctx: { integrationId?: string; source: string }): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, errors: [], touchedMachines: [], touchedParts: [] };
  for (const raw of rawEvents) {
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) {
      result.errors.push(`${parsed.error.issues[0]?.path.join(".") ?? "event"}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      continue;
    }
    try {
      await applyOne(parsed.data, ctx, result);
      result.applied++;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (ctx.integrationId) {
    await db.integration.update({ where: { id: ctx.integrationId }, data: { lastSeenAt: new Date(), eventCount: { increment: result.applied }, lastError: result.errors[0] ?? null } }).catch(() => null);
  }
  await db.ingestLog.create({
    data: { shopId: await currentShopId(),
      integrationId: ctx.integrationId ?? null,
      source: ctx.source,
      ok: result.errors.length === 0,
      summary: `${result.applied} event${result.applied === 1 ? "" : "s"} applied${result.errors.length ? `, ${result.errors.length} rejected` : ""}`,
      error: result.errors.length ? result.errors.slice(0, 5).join(" | ") : null,
      payload: rawEvents.length <= 20 ? (rawEvents as object) : { truncated: true, count: rawEvents.length, first: rawEvents[0] as object },
    },
  });
  if (result.applied) bus.emit("change", { machines: result.touchedMachines, parts: result.touchedParts });
  return result;
}

async function ensureMachine(ev: { machine: string; name?: string; line?: string }, integrationId?: string) {
  const code = ev.machine.trim().toUpperCase();
  let lineId: string | undefined;
  if (ev.line) {
    const line = await db.productionLine.upsert({ where: { shopId_name: { shopId: await currentShopId(), name: ev.line.trim() } }, update: {}, create: { shopId: await currentShopId(), name: ev.line.trim() } });
    lineId = line.id;
  }
  const machine = await db.machine.upsert({
    where: { shopId_code: { shopId: await currentShopId(), code } },
    update: { lastHeartbeatAt: new Date(), ...(lineId ? { lineId } : {}), ...(ev.name ? { name: ev.name } : {}) },
    create: { shopId: await currentShopId(), code, name: ev.name ?? code, lineId, integrationId, lastHeartbeatAt: new Date(), status: "IDLE", lastStatusChangeAt: new Date() },
  });
  return machine;
}

async function applyOne(ev: CanonicalEvent, ctx: { integrationId?: string; source: string }, result: ApplyResult) {
  const at = "at" in ev && ev.at ? ev.at : new Date();
  switch (ev.type) {
    case "machine.heartbeat": {
      const m = await ensureMachine(ev, ctx.integrationId);
      if (m.status === "OFFLINE") await db.machine.update({ where: { id: m.id }, data: { status: "IDLE", lastStatusChangeAt: at } });
      result.touchedMachines.push(m.code);
      return;
    }
    case "machine.status": {
      const m = await ensureMachine(ev, ctx.integrationId);
      const changed = m.status !== ev.status;
      await db.machine.update({ where: { id: m.id }, data: { status: ev.status, ...(changed ? { lastStatusChangeAt: at } : {}) } });
      if (changed) emitWebhook("machine.status_changed", { machineId: m.id, code: m.code, name: m.name, from: m.status, to: ev.status, message: ev.message ?? null, at });
      await db.machineEvent.create({ data: { machineId: m.id, type: "STATUS", status: ev.status, message: ev.message, occurredAt: at, raw: ev as object } });
      result.touchedMachines.push(m.code);
      return;
    }
    case "machine.count": {
      const m = await ensureMachine(ev, ctx.integrationId);
      await db.machineEvent.create({ data: { machineId: m.id, type: "COUNT", count: ev.count, good: ev.good ?? ev.count, scrap: ev.scrap ?? 0, occurredAt: at, raw: ev as object } });
      if (m.status === "OFFLINE" || m.status === "IDLE") await db.machine.update({ where: { id: m.id }, data: { status: "RUNNING", lastStatusChangeAt: at } });
      // press shop: counts land on the job running on this press (and the die's hit counter)
      await applyPressCount(m.id, ev.good ?? ev.count, ev.scrap ?? 0, at).catch((e) => console.error("[nexdrive] press count failed", e));
      result.touchedMachines.push(m.code);
      return;
    }
    case "machine.reading": {
      const m = await ensureMachine(ev, ctx.integrationId);
      const metrics = { ...(m.metrics as Record<string, unknown>), [ev.metric]: { value: ev.value, unit: ev.unit ?? null, at: at.toISOString() } };
      await db.machine.update({ where: { id: m.id }, data: { metrics: metrics as object } });
      await db.machineEvent.create({ data: { machineId: m.id, type: "READING", metric: ev.metric, value: ev.value, unit: ev.unit, occurredAt: at } });
      await syncRunHours(m.id, ev.metric, ev.value).catch(() => null);
      result.touchedMachines.push(m.code);
      return;
    }
    case "machine.alarm": {
      const m = await ensureMachine(ev, ctx.integrationId);
      await db.machineEvent.create({ data: { machineId: m.id, type: "ALARM", code: ev.code, message: ev.message, occurredAt: at, raw: ev as object } });
      emitWebhook("machine.alarm", { machineId: m.id, code: m.code, name: m.name, alarmCode: ev.code ?? null, message: ev.message, severity: ev.severity ?? "warning", at });
      if (ev.severity === "critical") await db.machine.update({ where: { id: m.id }, data: { status: "DOWN", lastStatusChangeAt: at } });
      if (m.autoWorkOrder && ev.severity === "critical") {
        await openMaintenanceJob(m.id, { complaint: `Alarm${ev.code ? ` ${ev.code}` : ""}: ${ev.message}`, source: `${ctx.source} alarm` }).catch((e) => console.error("[nexdrive] auto work order failed", e));
      }
      result.touchedMachines.push(m.code);
      return;
    }
    case "inventory.set": {
      const sku = ev.sku.trim().toUpperCase();
      const part = await db.part.findFirst({ where: { sku } });
      if (!part) {
        if (!ev.name) throw new Error(`Unknown SKU ${sku} (include "name" to auto-create)`);
        await db.part.create({ data: { shopId: await currentShopId(), sku, name: ev.name, quantityOnHand: ev.quantity, location: ev.location, movements: { create: { delta: ev.quantity, reason: ev.reason ?? "Feed: initial", reference: ctx.source } } } });
      } else {
        const delta = ev.quantity - part.quantityOnHand;
        await db.part.update({ where: { id: part.id }, data: { quantityOnHand: ev.quantity, ...(ev.location ? { location: ev.location } : {}) } });
        if (delta !== 0) await db.stockMovement.create({ data: { partId: part.id, delta, reason: ev.reason ?? "Feed: stock sync", reference: ctx.source } });
      }
      result.touchedParts.push(sku);
      return;
    }
    case "inventory.adjust": {
      const sku = ev.sku.trim().toUpperCase();
      const part = await db.part.findFirst({ where: { sku } });
      if (!part) throw new Error(`Unknown SKU ${sku}`);
      if (part.quantityOnHand + ev.delta < 0) throw new Error(`SKU ${sku}: adjustment would go below zero`);
      await db.$transaction([
        db.part.update({ where: { id: part.id }, data: { quantityOnHand: { increment: ev.delta } } }),
        db.stockMovement.create({ data: { partId: part.id, delta: ev.delta, reason: ev.reason ?? "Feed: adjustment", reference: ev.reference ?? ctx.source } }),
      ]);
      result.touchedParts.push(sku);
      return;
    }
    case "inventory.price": {
      const sku = ev.sku.trim().toUpperCase();
      const part = await db.part.findFirst({ where: { sku } });
      let supplierId: string | undefined;
      if (ev.supplier) supplierId = (await db.supplier.upsert({ where: { shopId_name: { shopId: await currentShopId(), name: ev.supplier } }, update: {}, create: { shopId: await currentShopId(), name: ev.supplier } })).id;
      if (!part) {
        if (!ev.name) throw new Error(`Unknown SKU ${sku} (include "name" to auto-create)`);
        await db.part.create({ data: { shopId: await currentShopId(), sku, name: ev.name, cost: ev.cost ?? 0, price: ev.price ?? 0, supplierId } });
      } else {
        await db.part.update({ where: { id: part.id }, data: { ...(ev.cost != null ? { cost: ev.cost } : {}), ...(ev.price != null ? { price: ev.price } : {}), ...(supplierId ? { supplierId } : {}) } });
      }
      result.touchedParts.push(sku);
      return;
    }
  }
}

/** Machines that haven't reported within `staleMinutes` are flipped to OFFLINE. */
export async function sweepOfflineMachines(staleMinutes = 5) {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000);
  // runs from a timer with no request — unscoped on purpose, across every shop
  const stale = await rawDb.machine.findMany({ where: { active: true, status: { not: "OFFLINE" }, OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null }] } });
  for (const m of stale) {
    await rawDb.machine.update({ where: { id: m.id }, data: { status: "OFFLINE", lastStatusChangeAt: new Date() } });
    await rawDb.machineEvent.create({ data: { machineId: m.id, type: "STATUS", status: "OFFLINE", message: `No data for ${staleMinutes} min` } });
  }
  if (stale.length) bus.emit("change", { machines: stale.map((m) => m.code), parts: [] });
  return stale.length;
}
