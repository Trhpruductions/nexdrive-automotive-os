"use server";

import { redirect } from "next/navigation";
import { parseISO } from "date-fns";
import { revalidatePath } from "next/cache";
import { db, currentShopId } from "@/lib/db";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { evaluate, parseCheckPlan } from "@/lib/quality";
import { jobNumber, shiftAt, shiftsFor } from "@/lib/production";
import { emitWebhook } from "@/lib/webhooks";
import type { QcKind } from "@/generated/prisma/enums";

const opt = (v: FormDataEntryValue | null, max = 200) => { const s = String(v ?? "").trim().slice(0, max); return s || null; };
const int = (v: FormDataEntryValue | null) => { const n = Math.round(Number(String(v ?? "").replace(/[^0-9.-]/g, ""))); return Number.isFinite(n) ? n : 0; };
const dec = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); if (!s) return null; const n = Number(s.replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : null; };

// ───────── Checks ─────────
/** Record a first-piece / in-process / final check. A fail puts the job on hold (and pauses it); a first-piece pass approves the run. */
export async function recordCheck(jobId: string, formData: FormData) {
  const user = await requireStaff();
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { part: { select: { checkPlan: true } }, runs: { where: { endedAt: null }, take: 1, orderBy: { startedAt: "desc" } } } });
  const kindRaw = String(formData.get("kind") ?? "IN_PROCESS");
  const kind = (["FIRST_PIECE", "IN_PROCESS", "FINAL"].includes(kindRaw) ? kindRaw : "IN_PROCESS") as QcKind;
  const plan = parseCheckPlan(job.part.checkPlan);
  const actuals = plan.map((_, i) => dec(formData.get(`actual_${i}`)));
  const flags = plan.map((_, i) => formData.get(`ok_${i}`) === "on");
  const measurements = evaluate(plan, actuals, flags);
  // no plan: the inspector's verdict stands; with a plan, every item must be in tolerance
  const result = plan.length ? (measurements.every((m) => m.ok) ? "PASS" : "FAIL") : formData.get("result") === "FAIL" ? "FAIL" : "PASS";
  const run = job.runs[0];
  const check = await db.qualityCheck.create({
    data: { shopId: await currentShopId(), jobId, kind, result, pieceCount: job.good, measurements: measurements as object[], notes: opt(formData.get("notes"), 1000), inspector: user.name, userId: user.id, runId: run?.id ?? null, dieId: job.dieId, lotId: run?.lotId ?? job.lotId },
  });
  const now = new Date();
  if (result === "PASS") {
    await db.productionJob.update({ where: { id: jobId }, data: { onHold: false, holdReason: null, firstPieceAt: kind === "FIRST_PIECE" && !job.firstPieceAt ? now : undefined } });
  } else {
    const bad = measurements.filter((m) => !m.ok).map((m) => m.name).join(", ");
    const reason = `${kind === "FIRST_PIECE" ? "First piece" : kind === "FINAL" ? "Final check" : "In-process check"} failed${bad ? `: ${bad}` : ""}`;
    await db.productionJob.update({ where: { id: jobId }, data: { onHold: true, holdReason: reason } });
    if (job.status === "RUNNING") {
      await db.productionRun.updateMany({ where: { jobId, endedAt: null }, data: { endedAt: now, downtimeReason: "Quality hold" } });
      await db.productionJob.update({ where: { id: jobId }, data: { status: "PAUSED" } });
      if (job.machineId) {
        await db.machine.updateMany({ where: { id: job.machineId, status: "RUNNING" }, data: { status: "IDLE", lastStatusChangeAt: now, lastHeartbeatAt: now } });
        await db.machineEvent.create({ data: { machineId: job.machineId, type: "STATUS", status: "IDLE", message: `${jobNumber(job.number)} on quality hold — ${reason}` } });
      }
    }
    emitWebhook("work_order.status_changed", { kind: "production_job", id: jobId, number: job.number, to: "HOLD", reason, checkId: check.id });
  }
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "check", entity: "ProductionJob", entityId: jobId, detail: `${kind} ${result} at ${job.good} pcs` } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  redirect(`/jobs/${jobId}?${result === "PASS" ? "ok=Check+passed" : "error=" + encodeURIComponent(`Check failed — job on hold`)}`);
}

/** Lift a quality hold without a new check (manager decision, noted). */
export async function releaseHold(jobId: string, formData: FormData) {
  const user = await requireStaff(MANAGER_ROLES);
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  const note = opt(formData.get("note"), 500);
  await db.productionJob.update({ where: { id: jobId }, data: { onHold: false, holdReason: null, notes: `${job.notes ? job.notes + "\n" : ""}Hold released by ${user.name}${note ? `: ${note}` : ""}` } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "release_hold", entity: "ProductionJob", entityId: jobId, detail: note ?? job.holdReason ?? "" } });
  revalidatePath(`/jobs/${jobId}`);
  redirect(`/jobs/${jobId}?ok=Hold+released`);
}

// ───────── Coils / lots on jobs ─────────
/** Coil change: closes the current run and opens a new one on the new lot so counts stay traceable per coil. */
export async function setJobLot(jobId: string, formData: FormData) {
  const user = await requireStaff();
  const lotId = opt(formData.get("lotId"));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId }, include: { part: { select: { materialPartId: true } } } });
  if (lotId) {
    const lot = await db.materialLot.findUnique({ where: { id: lotId } });
    if (!lot || (job.part.materialPartId && lot.partId !== job.part.materialPartId)) redirect(`/jobs/${jobId}?error=That+lot+isn%27t+this+product%27s+material`);
  }
  if (lotId === job.lotId) redirect(`/jobs/${jobId}`);
  const now = new Date();
  await db.productionJob.update({ where: { id: jobId }, data: { lotId } });
  if (job.status === "RUNNING" && job.machineId) {
    const shifts = await shiftsFor();
    await db.productionRun.updateMany({ where: { jobId, endedAt: null }, data: { endedAt: now, notes: "Coil change" } });
    await db.productionRun.create({ data: { jobId, machineId: job.machineId, dieId: job.dieId, lotId, technicianId: user.technicianId, operator: user.name, shift: shiftAt(shifts, now), startedAt: now } });
  } else {
    // not running: stamp the lot on the open run if there is one, so the next counts carry it
    await db.productionRun.updateMany({ where: { jobId, endedAt: null }, data: { lotId } });
  }
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  redirect(`/jobs/${jobId}?ok=${lotId ? "Coil+changed" : "Lot+cleared"}`);
}

// ───────── Scrap ─────────
/** Log scrap with a reason (also bumps the job / run / die counters like a count would). */
export async function logScrap(jobId: string, formData: FormData) {
  await requireStaff();
  const quantity = int(formData.get("quantity"));
  const reason = opt(formData.get("reason"), 80) ?? "Other";
  if (quantity <= 0) redirect(`/jobs/${jobId}?error=How+many+pieces%3F`);
  const job = await db.productionJob.findUniqueOrThrow({ where: { id: jobId } });
  const run = await db.productionRun.findFirst({ where: { jobId, endedAt: null }, orderBy: { startedAt: "desc" } });
  await db.productionJob.update({ where: { id: jobId }, data: { scrap: { increment: quantity } } });
  if (run) await db.productionRun.update({ where: { id: run.id }, data: { scrap: { increment: quantity } } });
  if (job.dieId) await db.die.update({ where: { id: job.dieId }, data: { hitCount: { increment: quantity } } });
  await db.scrapEntry.create({ data: { shopId: await currentShopId(), jobId, runId: run?.id ?? null, dieId: job.dieId, lotId: run?.lotId ?? job.lotId, quantity, reason, notes: opt(formData.get("notes"), 500) } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  redirect(`/jobs/${jobId}?ok=Scrap+logged`);
}

// ───────── Material lots ─────────
/** Receive a coil / bundle: creates the lot and books the quantity into the material's stock. */
export async function receiveLot(formData: FormData) {
  const user = await requireStaff();
  const partId = opt(formData.get("partId"));
  const lotNumber = opt(formData.get("lotNumber"), 60);
  const quantity = dec(formData.get("quantity"));
  if (!partId || !lotNumber || !quantity || quantity <= 0) redirect("/parts/lots?error=Material%2C+lot+number+and+quantity+are+required");
  const part = await db.part.findUnique({ where: { id: partId } });
  if (!part || part.kind !== "MATERIAL") redirect("/parts/lots?error=Pick+a+material");
  const dup = await db.materialLot.findFirst({ where: { partId, lotNumber } });
  if (dup) redirect(`/parts/lots/${dup.id}?error=That+lot+number+is+already+on+file`);
  const receivedRaw = opt(formData.get("receivedAt"));
  const lot = await db.materialLot.create({
    data: { shopId: await currentShopId(), partId, lotNumber, heatNumber: opt(formData.get("heatNumber"), 60), supplier: opt(formData.get("supplier"), 120), quantity, remaining: quantity, unit: part.unit, receivedAt: receivedRaw ? parseISO(receivedRaw) : new Date(), certOnFile: formData.get("certOnFile") === "on", location: opt(formData.get("location"), 80), notes: opt(formData.get("notes"), 1000) },
  });
  await db.part.update({ where: { id: partId }, data: { quantityOnHand: { increment: Math.round(quantity) } } });
  await db.stockMovement.create({ data: { partId, delta: Math.round(quantity), reason: "Received", reference: `Lot ${lotNumber}` } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "receive", entity: "MaterialLot", entityId: lot.id, detail: `${part.sku} lot ${lotNumber} × ${quantity} ${part.unit}` } });
  revalidatePath("/parts");
  redirect(`/parts/lots/${lot.id}?ok=Lot+received`);
}

export async function updateLot(id: string, formData: FormData) {
  await requireStaff();
  const remaining = dec(formData.get("remaining"));
  await db.materialLot.update({ where: { id }, data: { heatNumber: opt(formData.get("heatNumber"), 60), supplier: opt(formData.get("supplier"), 120), certOnFile: formData.get("certOnFile") === "on", location: opt(formData.get("location"), 80), notes: opt(formData.get("notes"), 1000), remaining: remaining != null && remaining >= 0 ? remaining : undefined } });
  revalidatePath(`/parts/lots/${id}`);
  redirect(`/parts/lots/${id}?ok=Saved`);
}

export async function deleteLot(id: string) {
  await requireStaff(MANAGER_ROLES);
  const used = await db.productionRun.count({ where: { lotId: id } });
  if (used) redirect(`/parts/lots/${id}?error=This+lot+has+production+against+it`);
  await db.materialLot.delete({ where: { id } });
  revalidatePath("/parts/lots");
  redirect("/parts/lots?ok=Lot+removed");
}
