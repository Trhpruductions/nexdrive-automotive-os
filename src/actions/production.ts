"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, currentShopId, nextNumber } from "@/lib/db";
import { requireStaff, BILLING_ROLES, MANAGER_ROLES } from "@/lib/auth";
import { completeJob, jobNumber, shiftAt, shiftsFor, shipNumber } from "@/lib/production";
import { getSettings } from "@/lib/settings";
import { emitWebhook } from "@/lib/webhooks";
import type { DieStatus } from "@/generated/prisma/enums";

const opt = (v: FormDataEntryValue | null, max = 200) => { const s = String(v ?? "").trim().slice(0, max); return s || null; };
const int = (v: FormDataEntryValue | null) => { const n = Math.round(Number(String(v ?? "").replace(/[^0-9.-]/g, ""))); return Number.isFinite(n) ? n : 0; };
const dec = (v: FormDataEntryValue | null) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : null; };

// ───────── Products (parts this shop makes) ─────────
export async function saveProduct(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const id = opt(formData.get("id"));
  const sku = opt(formData.get("sku"), 60);
  const name = opt(formData.get("name"), 160);
  if (!sku || !name) redirect(`/parts/products${id ? `/${id}` : "/new"}?error=Part+number+and+name+are+required`);
  const data = {
    kind: "PRODUCT" as const, sku, name, description: opt(formData.get("description"), 500), category: opt(formData.get("category"), 80), unit: opt(formData.get("unit"), 12) ?? "ea",
    customerId: opt(formData.get("customerId")), customerPartNumber: opt(formData.get("customerPartNumber"), 80),
    dieId: opt(formData.get("dieId")), pressId: opt(formData.get("pressId")), materialPartId: opt(formData.get("materialPartId")),
    materialPerPiece: dec(formData.get("materialPerPiece")), stdRatePerHour: int(formData.get("stdRatePerHour")) || null, packQty: int(formData.get("packQty")) || null,
    price: dec(formData.get("price")) ?? 0, cost: dec(formData.get("cost")) ?? 0, reorderPoint: int(formData.get("reorderPoint")), location: opt(formData.get("location"), 80),
  };
  const row = id ? await db.part.update({ where: { id }, data }) : await db.part.create({ data: { ...data, shopId: await currentShopId() } });
  revalidatePath("/parts/products");
  redirect(`/parts/products/${row.id}?ok=Saved`);
}

// ───────── Dies / tooling ─────────
export async function saveDie(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const id = opt(formData.get("id"));
  const code = opt(formData.get("code"), 40)?.toUpperCase();
  const name = opt(formData.get("name"), 160) ?? code;
  if (!code || !name) redirect(`/tooling${id ? `/${id}` : ""}?error=Die+code+is+required`);
  const data = { code, name, location: opt(formData.get("location"), 80), machineId: opt(formData.get("machineId")), serviceIntervalHits: int(formData.get("serviceIntervalHits")) || null, notes: opt(formData.get("notes"), 2000), status: (opt(formData.get("status")) ?? "ACTIVE") as DieStatus };
  const row = id ? await db.die.update({ where: { id }, data }) : await db.die.create({ data: { ...data, shopId: await currentShopId(), hitCount: int(formData.get("hitCount")), hitsAtService: int(formData.get("hitCount")) } });
  revalidatePath("/tooling");
  redirect(`/tooling/${row.id}?ok=Saved`);
}

/** Record a sharpening / rebuild: resets the interval counter and logs it as a maintenance job on the die's asset. */
export async function serviceDie(id: string, formData: FormData) {
  const user = await requireStaff();
  const die = await db.die.findUniqueOrThrow({ where: { id } });
  const note = opt(formData.get("note"), 500) ?? "Serviced";
  await db.die.update({ where: { id }, data: { hitsAtService: die.hitCount, status: "ACTIVE", notes: `${die.notes ? die.notes + "\n" : ""}${new Date().toISOString().slice(0, 10)}: ${note} at ${die.hitCount.toLocaleString()} hits (${user.name})` } });
  revalidatePath(`/tooling/${id}`);
  redirect(`/tooling/${id}?ok=Service+recorded`);
}

export async function deleteDie(id: string) {
  await requireStaff(MANAGER_ROLES);
  await db.die.delete({ where: { id } });
  revalidatePath("/tooling");
  redirect("/tooling?ok=Die+removed");
}

// ───────── Jobs ─────────
export async function createJob(formData: FormData) {
  const user = await requireStaff(BILLING_ROLES);
  const partId = opt(formData.get("partId"));
  const quantity = int(formData.get("quantity"));
  if (!partId || quantity <= 0) redirect("/jobs/new?error=Pick+a+product+and+a+quantity");
  const part = await db.part.findUniqueOrThrow({ where: { id: partId } });
  const customerId = opt(formData.get("customerId")) ?? part.customerId;
  if (!customerId) redirect("/jobs/new?error=Choose+the+customer");
  const dueRaw = opt(formData.get("dueAt"));
  const job = await db.productionJob.create({
    data: { shopId: await currentShopId(), number: await nextNumber("job"), partId, customerId, quantity, customerPo: opt(formData.get("customerPo"), 60), dueAt: dueRaw ? new Date(dueRaw) : null, priority: int(formData.get("priority")), machineId: opt(formData.get("machineId")) ?? part.pressId, dieId: opt(formData.get("dieId")) ?? part.dieId, notes: opt(formData.get("notes"), 2000), status: formData.get("release") ? "RELEASED" : "PLANNED" },
  });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "create", entity: "ProductionJob", entityId: job.id, detail: `#${job.number}` } });
  revalidatePath("/jobs");
  redirect(`/jobs/${job.id}?ok=${encodeURIComponent(`${jobNumber(job.number)} created`)}`);
}

export async function updateJob(id: string, formData: FormData) {
  await requireStaff(BILLING_ROLES);
  const dueRaw = opt(formData.get("dueAt"));
  await db.productionJob.update({ where: { id }, data: { quantity: int(formData.get("quantity")) || undefined, customerPo: opt(formData.get("customerPo"), 60), dueAt: dueRaw ? new Date(dueRaw) : null, priority: int(formData.get("priority")), machineId: opt(formData.get("machineId")), dieId: opt(formData.get("dieId")), notes: opt(formData.get("notes"), 2000) } });
  revalidatePath(`/jobs/${id}`);
  redirect(`/jobs/${id}?ok=Saved`);
}

/** Put the job on its press: mounts the die, starts a run for the current shift, press → RUNNING. */
export async function startJob(id: string, formData: FormData) {
  const user = await requireStaff();
  const job = await db.productionJob.findUniqueOrThrow({ where: { id } });
  const machineId = opt(formData.get("machineId")) ?? job.machineId;
  if (!machineId) redirect(`/jobs/${id}?error=Choose+a+press`);
  if (["COMPLETE", "CANCELLED"].includes(job.status)) redirect(`/jobs/${id}?error=Job+is+closed`);
  const busy = await db.productionJob.findFirst({ where: { machineId, status: "RUNNING", id: { not: id } } });
  if (busy) redirect(`/jobs/${id}?error=${encodeURIComponent(`${jobNumber(busy.number)} is already running on that press — pause it first`)}`);
  const now = new Date();
  const shifts = await shiftsFor();
  await db.productionJob.update({ where: { id }, data: { status: "RUNNING", machineId, startedAt: job.startedAt ?? now } });
  if (job.dieId) await db.die.update({ where: { id: job.dieId }, data: { machineId } });
  await db.productionRun.create({ data: { jobId: id, machineId, dieId: job.dieId, technicianId: user.technicianId, operator: user.name, shift: shiftAt(shifts, now), startedAt: now } });
  await db.machine.update({ where: { id: machineId }, data: { status: "RUNNING", lastStatusChangeAt: now } });
  await db.machineEvent.create({ data: { machineId, type: "STATUS", status: "RUNNING", message: `${jobNumber(job.number)} started by ${user.name}` } });
  const { bus } = await import("@/lib/integrations/bus");
  bus.emit("change", { machines: [machineId], parts: [] });
  revalidatePath("/jobs");
  revalidatePath("/production");
  redirect(`/jobs/${id}?ok=Running`);
}

/** Pause: close the open run (with optional downtime reason), press → IDLE. */
export async function pauseJob(id: string, formData: FormData) {
  const user = await requireStaff();
  const job = await db.productionJob.findUniqueOrThrow({ where: { id } });
  const now = new Date();
  await db.productionRun.updateMany({ where: { jobId: id, endedAt: null }, data: { endedAt: now, downtimeReason: opt(formData.get("reason"), 200) ?? undefined, notes: opt(formData.get("notes"), 500) ?? undefined } });
  await db.productionJob.update({ where: { id }, data: { status: "PAUSED" } });
  if (job.machineId) {
    await db.machine.updateMany({ where: { id: job.machineId, status: "RUNNING" }, data: { status: "IDLE", lastStatusChangeAt: now } });
    await db.machineEvent.create({ data: { machineId: job.machineId, type: "STATUS", status: "IDLE", message: `${jobNumber(job.number)} paused by ${user.name}${formData.get("reason") ? ` — ${formData.get("reason")}` : ""}` } });
  }
  revalidatePath("/jobs");
  revalidatePath("/production");
  redirect(`/jobs/${id}?ok=Paused`);
}

/** Manual counts when the press has no feed (or to correct it). */
export async function addCounts(id: string, formData: FormData) {
  await requireStaff();
  const good = int(formData.get("good"));
  const scrap = int(formData.get("scrap"));
  const downtime = int(formData.get("downtime"));
  const job = await db.productionJob.findUniqueOrThrow({ where: { id } });
  if (good < 0 || scrap < 0) redirect(`/jobs/${id}?error=Counts+can%27t+be+negative`);
  await db.productionJob.update({ where: { id }, data: { good: { increment: good }, scrap: { increment: scrap } } });
  const run = await db.productionRun.findFirst({ where: { jobId: id, endedAt: null }, orderBy: { startedAt: "desc" } });
  if (run) await db.productionRun.update({ where: { id: run.id }, data: { good: { increment: good }, scrap: { increment: scrap }, downtimeMinutes: { increment: downtime }, downtimeReason: opt(formData.get("reason"), 200) ?? undefined } });
  else if (job.machineId) { const shifts = await shiftsFor(); await db.productionRun.create({ data: { jobId: id, machineId: job.machineId, dieId: job.dieId, good, scrap, downtimeMinutes: downtime, downtimeReason: opt(formData.get("reason"), 200), shift: shiftAt(shifts, new Date()), startedAt: new Date(), endedAt: new Date() } }); }
  if (job.dieId && good + scrap > 0) await db.die.update({ where: { id: job.dieId }, data: { hitCount: { increment: good + scrap } } });
  revalidatePath(`/jobs/${id}`);
  redirect(`/jobs/${id}?ok=Counts+added`);
}

export async function finishJob(id: string) {
  const user = await requireStaff();
  const job = await completeJob(id, `by ${user.name}`);
  emitWebhook("work_order.status_changed", { kind: "production_job", id: job.id, number: job.number, to: "COMPLETE", good: job.good, scrap: job.scrap });
  revalidatePath("/jobs");
  revalidatePath("/parts");
  redirect(`/jobs/${id}?ok=Complete+%E2%80%94+finished+goods+booked+into+stock`);
}

export async function cancelJob(id: string) {
  await requireStaff(BILLING_ROLES);
  const job = await db.productionJob.findUniqueOrThrow({ where: { id } });
  if (job.status === "RUNNING") redirect(`/jobs/${id}?error=Pause+the+job+first`);
  await db.productionJob.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/jobs");
  redirect(`/jobs?ok=Job+cancelled`);
}

// ───────── Shipments ─────────
export async function createShipment(formData: FormData) {
  await requireStaff(BILLING_ROLES);
  const customerId = opt(formData.get("customerId"));
  if (!customerId) redirect("/shipments/new?error=Choose+the+customer");
  const jobIds = formData.getAll("jobId").map(String);
  const qtys = formData.getAll("qty").map((v) => int(v));
  const lines: { jobId: string | null; partId: string; quantity: number; unitPrice: number }[] = [];
  for (let i = 0; i < jobIds.length; i++) {
    if (!jobIds[i] || qtys[i] <= 0) continue;
    const job = await db.productionJob.findUnique({ where: { id: jobIds[i] }, include: { part: true } });
    if (!job) continue;
    lines.push({ jobId: job.id, partId: job.partId, quantity: Math.min(qtys[i], Math.max(0, job.good - job.shipped)), unitPrice: Number(job.part.price) });
  }
  // free-form product lines
  const partIds = formData.getAll("partId").map(String);
  const partQtys = formData.getAll("partQty").map((v) => int(v));
  for (let i = 0; i < partIds.length; i++) {
    if (!partIds[i] || partQtys[i] <= 0) continue;
    const part = await db.part.findUnique({ where: { id: partIds[i] } });
    if (part) lines.push({ jobId: null, partId: part.id, quantity: partQtys[i], unitPrice: Number(part.price) });
  }
  if (!lines.filter((l) => l.quantity > 0).length) redirect("/shipments/new?error=Nothing+to+ship");
  const sh = await db.shipment.create({ data: { shopId: await currentShopId(), number: await nextNumber("ship"), customerId, shipTo: opt(formData.get("shipTo"), 400), carrier: opt(formData.get("carrier"), 80), tracking: opt(formData.get("tracking"), 120), notes: opt(formData.get("notes"), 1000), lines: { create: lines.filter((l) => l.quantity > 0) } } });
  revalidatePath("/shipments");
  redirect(`/shipments/${sh.id}?ok=${encodeURIComponent(`${shipNumber(sh.number)} created`)}`);
}

/** Ship it: finished goods leave stock, jobs' shipped counters move. */
export async function markShipped(id: string) {
  const user = await requireStaff(BILLING_ROLES);
  const sh = await db.shipment.findUniqueOrThrow({ where: { id }, include: { lines: true } });
  if (sh.status === "SHIPPED") redirect(`/shipments/${id}`);
  const now = new Date();
  for (const l of sh.lines) {
    await db.part.update({ where: { id: l.partId }, data: { quantityOnHand: { decrement: l.quantity } } });
    await db.stockMovement.create({ data: { partId: l.partId, delta: -l.quantity, reason: "Shipped", reference: shipNumber(sh.number) } });
    if (l.jobId) await db.productionJob.update({ where: { id: l.jobId }, data: { shipped: { increment: l.quantity } } });
  }
  await db.shipment.update({ where: { id }, data: { status: "SHIPPED", shipDate: now } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "ship", entity: "Shipment", entityId: id, detail: `#${sh.number}` } });
  revalidatePath("/shipments");
  revalidatePath("/parts");
  redirect(`/shipments/${id}?ok=Shipped`);
}

/** Invoice the shipment (goods invoice, no work order). */
export async function invoiceShipment(id: string) {
  const user = await requireStaff(BILLING_ROLES);
  const sh = await db.shipment.findUniqueOrThrow({ where: { id }, include: { lines: true, customer: true, invoice: true } });
  if (sh.invoice) redirect(`/invoices/${sh.invoice.id}`);
  const settings = await getSettings();
  const subtotal = sh.lines.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0);
  const tax = sh.customer.taxExempt ? 0 : Math.round(subtotal * settings.taxRate * 100) / 100;
  const { randomBytes } = await import("node:crypto");
  const inv = await db.invoice.create({ data: { shopId: await currentShopId(), number: await nextNumber("inv"), shipmentId: id, customerId: sh.customerId, status: "SENT", payToken: randomBytes(18).toString("base64url"), dueAt: new Date(Date.now() + 30 * 86_400_000), subtotal, discount: 0, taxRate: settings.taxRate, tax, total: Math.round((subtotal + tax) * 100) / 100 } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "invoice", entity: "Invoice", entityId: inv.id, detail: shipNumber(sh.number) } });
  emitWebhook("invoice.created", { ...inv, shipmentNumber: sh.number, customer: { id: sh.customer.id, firstName: sh.customer.firstName, lastName: sh.customer.lastName, email: sh.customer.email } });
  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}?ok=Invoice+created`);
}

// ───────── Shifts (settings) ─────────
export async function saveShifts(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const names = formData.getAll("shiftName").map(String);
  const starts = formData.getAll("shiftStart").map(String);
  const ends = formData.getAll("shiftEnd").map(String);
  const shifts = names.map((n, i) => ({ name: n.trim(), start: starts[i], end: ends[i] })).filter((s) => s.name && /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end));
  await db.shopSettings.update({ where: { shopId: await currentShopId() }, data: { shifts } });
  revalidatePath("/", "layout");
  redirect("/settings?tab=rates&ok=Shifts+saved");
}
