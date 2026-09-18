import "server-only";
import { endOfDay, startOfDay } from "date-fns";
import { db, rawDb, currentShopId } from "./db";
import { getSettings } from "./settings";

/**
 * Press-shop production: jobs run on presses with dies; live counts from the
 * machine feed land on the running job, its current run and the die's hit
 * counter; finished goods and material move through inventory.
 */

export const jobNumber = (n: number) => `JOB-${String(n).padStart(5, "0")}`;
export const shipNumber = (n: number) => `SH-${String(n).padStart(5, "0")}`;

export type Shift = { name: string; start: string; end: string };
export const DEFAULT_SHIFTS: Shift[] = [
  { name: "1st", start: "06:00", end: "14:00" },
  { name: "2nd", start: "14:00", end: "22:00" },
];

export async function shiftsFor(): Promise<Shift[]> {
  const s = await getSettings();
  const raw = (s as unknown as { shifts?: unknown }).shifts;
  return Array.isArray(raw) && raw.length ? (raw as Shift[]) : DEFAULT_SHIFTS;
}

/** Which shift a moment falls in (by shop-local clock). */
export function shiftAt(shifts: Shift[], d: Date): string | null {
  const m = d.getHours() * 60 + d.getMinutes();
  for (const s of shifts) {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const a = sh * 60 + sm;
    const b = eh * 60 + em;
    if (a <= b ? m >= a && m < b : m >= a || m < b) return s.name;
  }
  return null;
}

/**
 * Feed hook: a machine.count event on a press. Adds to the RUNNING job on that
 * press (and its open run), and to the die's hit counter. Returns what changed.
 */
export async function applyPressCount(machineId: string, good: number, scrap: number, at: Date) {
  const job = await db.productionJob.findFirst({ where: { machineId, status: "RUNNING" }, orderBy: { startedAt: "desc" } });
  if (!job) return null;
  const hits = good + scrap;
  await db.productionJob.update({ where: { id: job.id }, data: { good: { increment: good }, scrap: { increment: scrap } } });
  const run = await db.productionRun.findFirst({ where: { jobId: job.id, endedAt: null }, orderBy: { startedAt: "desc" } });
  if (run) await db.productionRun.update({ where: { id: run.id }, data: { good: { increment: good }, scrap: { increment: scrap } } });
  else {
    const shifts = await shiftsFor();
    await db.productionRun.create({ data: { jobId: job.id, machineId, dieId: job.dieId, shift: shiftAt(shifts, at), good, scrap, startedAt: at } });
  }
  if (job.dieId && hits > 0) await db.die.update({ where: { id: job.dieId }, data: { hitCount: { increment: hits } } });
  // auto-complete when the order quantity is reached
  const fresh = await db.productionJob.findUnique({ where: { id: job.id } });
  if (fresh && fresh.good >= fresh.quantity) await completeJob(job.id, "quantity reached");
  return { jobId: job.id, good, scrap };
}

/** Finish a job: close the open run, book finished goods and material, free the press. */
export async function completeJob(jobId: string, reason?: string) {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { part: true } });
  if (job.status === "COMPLETE" || job.status === "CANCELLED") return job;
  const now = new Date();
  await db.productionRun.updateMany({ where: { jobId, endedAt: null }, data: { endedAt: now } });
  // finished goods into stock
  if (job.good > 0) {
    await db.part.update({ where: { id: job.partId }, data: { quantityOnHand: { increment: job.good } } });
    await db.stockMovement.create({ data: { partId: job.partId, delta: job.good, reason: "Produced", reference: jobNumber(job.number) } });
  }
  // material consumed
  const perPiece = job.part.materialPerPiece ? Number(job.part.materialPerPiece) : 0;
  let materialUsed = job.materialUsed ? Number(job.materialUsed) : 0;
  if (job.part.materialPartId && perPiece > 0 && !job.materialUsed) {
    materialUsed = Math.round(perPiece * (job.good + job.scrap) * 10000) / 10000;
    await db.part.update({ where: { id: job.part.materialPartId }, data: { quantityOnHand: { decrement: Math.round(materialUsed) } } });
    await db.stockMovement.create({ data: { partId: job.part.materialPartId, delta: -Math.round(materialUsed), reason: "Consumed in production", reference: jobNumber(job.number) } });
  }
  const updated = await db.productionJob.update({ where: { id: jobId }, data: { status: "COMPLETE", completedAt: now, materialUsed, notes: reason ? `${job.notes ? job.notes + "\n" : ""}Completed: ${reason}` : job.notes } });
  if (job.machineId) {
    const other = await db.productionJob.findFirst({ where: { machineId: job.machineId, status: "RUNNING", id: { not: jobId } } });
    if (!other) await db.machine.updateMany({ where: { id: job.machineId, status: "RUNNING" }, data: { status: "IDLE", lastStatusChangeAt: now } });
  }
  return updated;
}

/** Dies needing service: hits since last service ≥ interval. */
export async function diesDueForService() {
  const dies = await db.die.findMany({ where: { status: "ACTIVE", serviceIntervalHits: { not: null } } });
  return dies.filter((d) => d.serviceIntervalHits && d.hitCount - d.hitsAtService >= d.serviceIntervalHits);
}

/**
 * OEE for one press over a day: availability from RUNNING time vs planned
 * shift time, performance from actual vs ideal rate, quality from good/(good+scrap).
 */
export async function pressDay(machineId: string, day: Date) {
  const start = startOfDay(day);
  const end = endOfDay(day);
  const shifts = await shiftsFor();
  const plannedMin = shifts.reduce((s, sh) => {
    const [a, b] = [sh.start, sh.end].map((t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; });
    return s + (b >= a ? b - a : 24 * 60 - a + b);
  }, 0);
  const [statusEvents, prior, runs, counts] = await Promise.all([
    rawDb.machineEvent.findMany({ where: { machineId, type: "STATUS", occurredAt: { gte: start, lte: end } }, orderBy: { occurredAt: "asc" } }),
    rawDb.machineEvent.findFirst({ where: { machineId, type: "STATUS", occurredAt: { lt: start } }, orderBy: { occurredAt: "desc" } }),
    db.productionRun.findMany({ where: { machineId, startedAt: { gte: start, lte: end } }, include: { job: { include: { part: { select: { name: true, stdRatePerHour: true } } } } } }),
    rawDb.machineEvent.aggregate({ _sum: { good: true, scrap: true }, where: { machineId, type: "COUNT", occurredAt: { gte: start, lte: end } } }),
  ]);
  // run-time from status timeline (clipped to the day)
  const now = new Date();
  const clipEnd = end < now ? end : now;
  let cursor = start;
  let status = prior?.status ?? "OFFLINE";
  const byStatus: Record<string, number> = {};
  for (const e of [...statusEvents, { occurredAt: clipEnd, status }]) {
    const mins = Math.max(0, (e.occurredAt.getTime() - cursor.getTime()) / 60000);
    byStatus[status] = (byStatus[status] ?? 0) + mins;
    cursor = e.occurredAt;
    status = e.status ?? status;
  }
  const runMin = byStatus.RUNNING ?? 0;
  const good = counts._sum.good ?? 0;
  const scrap = counts._sum.scrap ?? 0;
  const idealRate = runs.find((r) => r.job.part.stdRatePerHour)?.job.part.stdRatePerHour ?? null;
  const availability = plannedMin ? Math.min(1, runMin / plannedMin) : 0;
  const performance = idealRate && runMin ? Math.min(1, (good + scrap) / (idealRate * (runMin / 60))) : null;
  const quality = good + scrap ? good / (good + scrap) : null;
  const oee = performance != null && quality != null ? availability * performance * quality : null;
  const downtime = runs.reduce((s, r) => s + r.downtimeMinutes, 0) + (byStatus.DOWN ?? 0);
  return { plannedMin, runMin, byStatus, good, scrap, idealRate, availability, performance, quality, oee, downtime, runs };
}

export async function shopHasProduction() {
  const shopId = await currentShopId();
  return (await rawDb.productionJob.count({ where: { shopId } })) > 0;
}
