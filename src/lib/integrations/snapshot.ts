import "server-only";
import { startOfDay, subHours } from "date-fns";
import { db } from "@/lib/db";

/** Everything the live production floor view needs, in one serialisable object. */
export async function productionSnapshot() {
  const now = new Date();
  const dayStart = startOfDay(now);
  const [lines, machines, countsToday, countsHour, alarms, recent, lowStock, integrations] = await Promise.all([
    db.productionLine.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.machine.findMany({ where: { active: true }, orderBy: [{ lineId: "asc" }, { code: "asc" }], include: { line: { select: { name: true } } } }),
    db.machineEvent.groupBy({ by: ["machineId"], where: { type: "COUNT", occurredAt: { gte: dayStart } }, _sum: { count: true, good: true, scrap: true } }),
    db.machineEvent.groupBy({ by: ["machineId"], where: { type: "COUNT", occurredAt: { gte: subHours(now, 1) } }, _sum: { count: true } }),
    db.machineEvent.findMany({ where: { type: "ALARM", occurredAt: { gte: subHours(now, 24) } }, orderBy: { occurredAt: "desc" }, take: 12, include: { machine: { select: { code: true, name: true } } } }),
    db.machineEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 25, include: { machine: { select: { code: true, name: true } } } }),
    db.part.findMany({ where: { active: true }, orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, sku: true, name: true, quantityOnHand: true, reorderPoint: true, updatedAt: true } }),
    db.integration.findMany({ select: { id: true, name: true, type: true, enabled: true, lastSeenAt: true, lastError: true, eventCount: true } }),
  ]);
  const sumOf = (rows: { machineId: string; _sum: { count: number | null; good?: number | null; scrap?: number | null } }[], id: string) => rows.find((r) => r.machineId === id)?._sum;

  const machineRows = machines.map((m) => {
    const day = sumOf(countsToday, m.id);
    const hour = sumOf(countsHour, m.id);
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      type: m.type,
      line: m.line?.name ?? null,
      lineId: m.lineId,
      status: m.status,
      lastHeartbeatAt: m.lastHeartbeatAt?.toISOString() ?? null,
      lastStatusChangeAt: m.lastStatusChangeAt?.toISOString() ?? null,
      metrics: m.metrics as Record<string, { value: number; unit: string | null; at: string }>,
      today: { count: day?.count ?? 0, good: day?.good ?? 0, scrap: day?.scrap ?? 0 },
      lastHour: hour?.count ?? 0,
    };
  });

  const lineRows = lines.map((l) => {
    const ms = machineRows.filter((m) => m.lineId === l.id);
    const running = ms.filter((m) => m.status === "RUNNING").length;
    const total = ms.reduce((s, m) => s + m.today.count, 0);
    const scrap = ms.reduce((s, m) => s + m.today.scrap, 0);
    const lastHour = ms.reduce((s, m) => s + m.lastHour, 0);
    return { id: l.id, name: l.name, description: l.description, targetPerHour: l.targetPerHour, machines: ms.length, running, down: ms.filter((m) => m.status === "DOWN").length, today: total, scrap, lastHour, rate: l.targetPerHour ? lastHour / l.targetPerHour : null };
  });

  return {
    at: now.toISOString(),
    lines: lineRows,
    machines: machineRows,
    unassigned: machineRows.filter((m) => !m.lineId),
    totals: {
      machines: machineRows.length,
      running: machineRows.filter((m) => m.status === "RUNNING").length,
      idle: machineRows.filter((m) => m.status === "IDLE").length,
      down: machineRows.filter((m) => m.status === "DOWN").length,
      offline: machineRows.filter((m) => m.status === "OFFLINE").length,
      maintenance: machineRows.filter((m) => m.status === "MAINTENANCE").length,
      producedToday: machineRows.reduce((s, m) => s + m.today.count, 0),
      scrapToday: machineRows.reduce((s, m) => s + m.today.scrap, 0),
    },
    alarms: alarms.map((a) => ({ id: a.id, machine: a.machine.code, name: a.machine.name, code: a.code, message: a.message, at: a.occurredAt.toISOString() })),
    recent: recent.map((e) => ({ id: e.id, machine: e.machine.code, type: e.type, status: e.status, count: e.count, metric: e.metric, value: e.value, unit: e.unit, message: e.message, at: e.occurredAt.toISOString() })),
    inventory: lowStock.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString(), low: p.quantityOnHand <= p.reorderPoint })),
    integrations: integrations.map((i) => ({ ...i, lastSeenAt: i.lastSeenAt?.toISOString() ?? null })),
  };
}

export type ProductionSnapshot = Awaited<ReturnType<typeof productionSnapshot>>;
