import "server-only";
import { db } from "./db";
import type { QcKind } from "@/generated/prisma/enums";

/**
 * Quality on the press floor: first-piece approval before a run gets going,
 * in-process checks every N pieces, a final check before it ships. What gets
 * measured comes from the product's check plan; a failed check puts the job on
 * hold. Scrap is logged with a reason so the Pareto says where pieces went.
 */

export const SCRAP_REASONS = ["Burr / edge", "Split / crack", "Dimension out", "Wrinkle / buckle", "Surface / scratch", "Slug mark", "Mis-feed", "Coil end / setup", "Material defect", "Die damage", "Other"] as const;

export type CheckItem = { name: string; nominal: number | null; tolerance: number | null; unit: string | null };
export type Measurement = CheckItem & { actual: number | null; ok: boolean };

export const QC_KIND: Record<QcKind, string> = { FIRST_PIECE: "First piece", IN_PROCESS: "In-process", FINAL: "Final" };

/** Parse a product's checkPlan JSON defensively (hand-edited imports happen). */
export function parseCheckPlan(raw: unknown): CheckItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const name = String(o.name ?? "").trim();
      if (!name) return null;
      const n = Number(o.nominal);
      const t = Number(o.tolerance);
      return { name: name.slice(0, 80), nominal: Number.isFinite(n) && o.nominal !== "" && o.nominal != null ? n : null, tolerance: Number.isFinite(t) && o.tolerance !== "" && o.tolerance != null ? t : null, unit: o.unit ? String(o.unit).slice(0, 12) : null };
    })
    .filter((x): x is CheckItem => !!x);
}

/** Evaluate actuals against the plan: numeric items pass when |actual − nominal| ≤ tolerance; others are pass/fail flags. */
export function evaluate(plan: CheckItem[], actuals: (number | null)[], flags: boolean[]): Measurement[] {
  return plan.map((item, i) => {
    const actual = actuals[i] ?? null;
    if (item.nominal != null) {
      const tol = item.tolerance ?? 0;
      const ok = actual != null && Math.abs(actual - item.nominal) <= tol + 1e-9;
      return { ...item, actual, ok };
    }
    return { ...item, actual, ok: !!flags[i] };
  });
}

export type QualityStatus = {
  plan: CheckItem[];
  firstPiece: "not_needed" | "needed" | "approved" | "failed";
  inProcessDue: boolean;
  nextCheckAt: number | null;
  lastCheck: { kind: QcKind; result: "PASS" | "FAIL"; pieceCount: number; checkedAt: Date } | null;
  onHold: boolean;
  holdReason: string | null;
};

/** Where a job stands on quality — used by the job page, operator station and reports. */
export async function qualityStatus(jobId: string): Promise<QualityStatus> {
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { part: { select: { checkPlan: true, checkEveryPieces: true } }, checks: { orderBy: { checkedAt: "desc" }, take: 20 } } });
  const plan = parseCheckPlan(job.part.checkPlan);
  const wantsFirst = plan.length > 0 || job.part.checkEveryPieces != null;
  const fp = job.checks.find((c) => c.kind === "FIRST_PIECE");
  const firstPiece: QualityStatus["firstPiece"] = job.firstPieceAt ? "approved" : !wantsFirst ? "not_needed" : fp?.result === "FAIL" ? "failed" : "needed";
  const every = job.part.checkEveryPieces ?? null;
  const lastPass = job.checks.find((c) => c.result === "PASS");
  const since = lastPass?.pieceCount ?? 0;
  const nextCheckAt = every ? since + every : null;
  const inProcessDue = !!every && job.firstPieceAt != null && job.good >= (nextCheckAt ?? Infinity) && !["COMPLETE", "CANCELLED"].includes(job.status);
  const last = job.checks[0] ?? null;
  return { plan, firstPiece, inProcessDue, nextCheckAt, lastCheck: last ? { kind: last.kind, result: last.result, pieceCount: last.pieceCount, checkedAt: last.checkedAt } : null, onHold: job.onHold, holdReason: job.holdReason };
}

/** Jobs that need an inspector right now: first piece outstanding on a running job, in-process check due, or on hold. */
export async function qualityQueue() {
  const jobs = await db.productionJob.findMany({ where: { status: { in: ["RUNNING", "PAUSED"] } }, include: { part: { select: { sku: true, name: true, checkPlan: true, checkEveryPieces: true } }, machine: { select: { code: true } }, checks: { orderBy: { checkedAt: "desc" }, take: 5 } } });
  return jobs
    .map((j) => {
      const plan = parseCheckPlan(j.part.checkPlan);
      const wants = plan.length > 0 || j.part.checkEveryPieces != null;
      const lastPass = j.checks.find((c) => c.result === "PASS");
      const every = j.part.checkEveryPieces ?? null;
      const due = !!every && !!j.firstPieceAt && j.good >= (lastPass?.pieceCount ?? 0) + every;
      const need: "hold" | "first_piece" | "in_process" | null = j.onHold ? "hold" : wants && !j.firstPieceAt ? "first_piece" : due ? "in_process" : null;
      return { job: j, need };
    })
    .filter((x) => x.need);
}

export type LineTrace = { lineId: string; lots: { id: string; lotNumber: string; heatNumber: string | null; supplier: string | null; certOnFile: boolean }[]; lastCheck: { kind: QcKind; result: "PASS" | "FAIL"; checkedAt: Date; inspector: string | null } | null; checks: number; fails: number };

/** Traceability for a shipment: per line, the coils its job ran on and the last check on that job. Feeds the packing slip, C of C and carton labels. */
export async function shipmentTrace(shipmentId: string): Promise<Map<string, LineTrace>> {
  const lines = await db.shipmentLine.findMany({ where: { shipmentId }, include: { job: { include: { runs: { include: { lot: { select: { id: true, lotNumber: true, heatNumber: true, supplier: true, certOnFile: true } } } }, lot: { select: { id: true, lotNumber: true, heatNumber: true, supplier: true, certOnFile: true } }, checks: { orderBy: { checkedAt: "desc" } } } } } });
  const out = new Map<string, LineTrace>();
  for (const l of lines) {
    const lots = new Map<string, LineTrace["lots"][number]>();
    for (const r of l.job?.runs ?? []) if (r.lot) lots.set(r.lot.id, r.lot);
    if (l.job?.lot && !lots.size) lots.set(l.job.lot.id, l.job.lot);
    const checks = l.job?.checks ?? [];
    const last = checks.find((c) => c.kind === "FINAL") ?? checks[0] ?? null;
    out.set(l.id, { lineId: l.id, lots: [...lots.values()], lastCheck: last ? { kind: last.kind, result: last.result, checkedAt: last.checkedAt, inspector: last.inspector } : null, checks: checks.length, fails: checks.filter((c) => c.result === "FAIL").length });
  }
  return out;
}
