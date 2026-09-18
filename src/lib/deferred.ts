import "server-only";
import { db } from "./db";

export type DeferredItem =
  | { kind: "line"; id: string; description: string; amount: number; when: Date; source: string; workOrderId: string; lineKind: string }
  | { kind: "finding"; id: string; description: string; result: "URGENT" | "ATTENTION"; notes: string | null; when: Date; source: string; workOrderId: string };

/**
 * Work a vehicle still needs: lines the customer declined on finished jobs, and
 * inspection findings (urgent / attention) from the latest inspections. Items
 * already present as a line on `currentWorkOrderId` are left out.
 */
export async function deferredWork(vehicleId: string, currentWorkOrderId?: string): Promise<DeferredItem[]> {
  const [declined, inspections, current] = await Promise.all([
    db.workOrderLine.findMany({
      where: { approved: false, workOrder: { vehicleId, status: { in: ["COMPLETED", "INVOICED"] }, ...(currentWorkOrderId ? { id: { not: currentWorkOrderId } } : {}) } },
      include: { workOrder: { select: { id: true, number: true, completedAt: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.inspection.findMany({
      where: { vehicleId, ...(currentWorkOrderId ? { workOrderId: { not: currentWorkOrderId } } : {}) },
      include: { items: { where: { result: { in: ["URGENT", "ATTENTION"] } } }, workOrder: { select: { id: true, number: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    currentWorkOrderId ? db.workOrderLine.findMany({ where: { workOrderId: currentWorkOrderId }, select: { description: true } }) : Promise.resolve([]),
  ]);
  const present = new Set(current.map((l) => l.description.toLowerCase()));
  const seen = new Set<string>();
  const out: DeferredItem[] = [];
  for (const l of declined) {
    const key = l.description.toLowerCase();
    if (present.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "line", id: l.id, description: l.description, amount: Number(l.kind === "LABOR" ? Number(l.hours ?? l.quantity) * Number(l.unitPrice) : Number(l.quantity) * Number(l.unitPrice)), when: l.workOrder.completedAt ?? l.workOrder.createdAt, source: `declined on WO-${String(l.workOrder.number).padStart(5, "0")}`, workOrderId: l.workOrder.id, lineKind: l.kind });
  }
  for (const insp of inspections) {
    for (const it of insp.items) {
      const key = it.name.toLowerCase();
      if (seen.has(key) || [...present].some((p) => p.includes(key))) continue;
      seen.add(key);
      out.push({ kind: "finding", id: it.id, description: it.name, result: it.result as "URGENT" | "ATTENTION", notes: it.notes, when: insp.createdAt, source: `inspection on WO-${String(insp.workOrder.number).padStart(5, "0")}`, workOrderId: insp.workOrder.id });
    }
  }
  return out.sort((a, b) => (a.kind === "finding" && a.result === "URGENT" ? -1 : 0) - (b.kind === "finding" && b.result === "URGENT" ? -1 : 0) || b.when.getTime() - a.when.getTime());
}
