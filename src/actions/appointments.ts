"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addMinutes, format } from "date-fns";
import { db, currentShopId } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { queueNotification } from "@/lib/notify";
import { renderTemplate } from "@/lib/templates";
import { emitWebhook } from "@/lib/webhooks";
import type { FormState } from "./customers";
import type { AppointmentStatus } from "@/generated/prisma/enums";

const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const Schema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  vehicleId: z.string().min(1, "Choose a vehicle"),
  scheduledStart: z.string().min(1, "Pick a date and time"),
  durationMinutes: z.coerce.number().int().min(15).max(24 * 60).default(60),
  serviceRequested: z.string().trim().min(2, "What is the appointment for?"),
  technicianId: z.string().optional(),
  bayId: z.string().optional(),
  notes: z.string().optional(),
  dropOff: z.coerce.boolean().default(true),
  status: z.enum(["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

async function conflicts(bayId: string | null, technicianId: string | null, start: Date, end: Date, excludeId?: string) {
  const overlap = { scheduledStart: { lt: end }, scheduledEnd: { gt: start }, status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] as AppointmentStatus[] }, ...(excludeId ? { id: { not: excludeId } } : {}) };
  const problems: string[] = [];
  if (bayId) {
    const c = await db.appointment.findFirst({ where: { ...overlap, bayId }, include: { bay: true, vehicle: true } });
    if (c) problems.push(`${c.bay?.name} is booked (${c.vehicle.year} ${c.vehicle.make} ${c.vehicle.model}, ${format(c.scheduledStart, "h:mm a")}–${format(c.scheduledEnd, "h:mm a")})`);
  }
  if (technicianId) {
    const c = await db.appointment.findFirst({ where: { ...overlap, technicianId }, include: { technician: true } });
    if (c) problems.push(`${c.technician?.name} already has an appointment ${format(c.scheduledStart, "h:mm a")}–${format(c.scheduledEnd, "h:mm a")}`);
  }
  return problems;
}

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.dropOff = formData.has("dropOff");
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const start = new Date(d.scheduledStart);
  const end = addMinutes(start, d.durationMinutes);
  const bayId = opt(d.bayId);
  const technicianId = opt(d.technicianId);
  const problems = await conflicts(bayId, technicianId, start, end);
  if (problems.length && !formData.has("force")) return { error: `${problems.join(". ")}. Tick "book anyway" to double-book.` };

  const appt = await db.appointment.create({
    data: { shopId: await currentShopId(), customerId: d.customerId, vehicleId: d.vehicleId, scheduledStart: start, scheduledEnd: end, serviceRequested: d.serviceRequested, technicianId, bayId, notes: opt(d.notes), dropOff: d.dropOff, status: d.status ?? "SCHEDULED" },
    include: { vehicle: true },
  });
  const cust = await db.customer.findUnique({ where: { id: d.customerId }, select: { firstName: true } });
  const t = await renderTemplate("appointment_booked", { customer: cust?.firstName ?? "", vehicle: `${appt.vehicle.year} ${appt.vehicle.make} ${appt.vehicle.model}`, date: format(start, "EEEE, MMM d"), time: format(start, "h:mm a"), service: d.serviceRequested });
  await queueNotification({ customerId: d.customerId, ...t });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "create", entity: "Appointment", entityId: appt.id } });
  emitWebhook("appointment.created", appt);
  revalidatePath("/schedule");
  redirect(`/schedule?date=${format(start, "yyyy-MM-dd")}&ok=Appointment+booked`);
}

export async function updateAppointment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.dropOff = formData.has("dropOff");
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const start = new Date(d.scheduledStart);
  const end = addMinutes(start, d.durationMinutes);
  const bayId = opt(d.bayId);
  const technicianId = opt(d.technicianId);
  const problems = await conflicts(bayId, technicianId, start, end, id);
  if (problems.length && !formData.has("force")) return { error: `${problems.join(". ")}. Tick "book anyway" to double-book.` };
  await db.appointment.update({
    where: { id },
    data: { customerId: d.customerId, vehicleId: d.vehicleId, scheduledStart: start, scheduledEnd: end, serviceRequested: d.serviceRequested, technicianId, bayId, notes: opt(d.notes), dropOff: d.dropOff, ...(d.status ? { status: d.status } : {}) },
  });
  revalidatePath("/schedule");
  redirect(`/schedule/${id}?ok=Appointment+updated`);
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  await requireStaff();
  const a = await db.appointment.update({ where: { id }, data: { status } });
  emitWebhook("appointment.status_changed", { id: a.id, status, scheduledStart: a.scheduledStart, vehicleId: a.vehicleId, customerId: a.customerId });
  if (status === "CONFIRMED") {
    const v = await db.vehicle.findUnique({ where: { id: a.vehicleId }, include: { customer: { select: { firstName: true } } } });
    const t = await renderTemplate("appointment_confirmed", { customer: v?.customer.firstName ?? "", vehicle: `${v?.year} ${v?.make} ${v?.model}`, date: format(a.scheduledStart, "EEEE, MMM d"), time: format(a.scheduledStart, "h:mm a") });
    await queueNotification({ customerId: a.customerId, ...t });
  }
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  redirect(`/schedule/${id}?ok=${encodeURIComponent(status.replace("_", " ").toLowerCase())}`);
}

/** Drag-and-drop reschedule from the day board: keeps the duration, moves bay + start. */
export async function moveAppointment(id: string, bayId: string | null, startIso: string, force = false): Promise<{ error?: string; conflict?: string }> {
  await requireStaff();
  const a = await db.appointment.findUnique({ where: { id } });
  if (!a) return { error: "Appointment not found" };
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return { error: "Invalid time" };
  const end = new Date(start.getTime() + (a.scheduledEnd.getTime() - a.scheduledStart.getTime()));
  if (bayId) {
    const bay = await db.bay.findUnique({ where: { id: bayId } });
    if (!bay) return { error: "Bay not found" };
  }
  const problems = await conflicts(bayId, a.technicianId, start, end, id);
  if (problems.length && !force) return { conflict: problems.join(". ") };
  const updated = await db.appointment.update({ where: { id }, data: { bayId, scheduledStart: start, scheduledEnd: end } });
  emitWebhook("appointment.rescheduled", { id: updated.id, bayId, scheduledStart: updated.scheduledStart, scheduledEnd: updated.scheduledEnd, vehicleId: updated.vehicleId, customerId: updated.customerId });
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${id}`);
  revalidatePath("/dashboard");
  return {};
}

export async function deleteAppointment(id: string) {
  await requireStaff();
  const a = await db.appointment.delete({ where: { id } });
  revalidatePath("/schedule");
  redirect(`/schedule?date=${format(a.scheduledStart, "yyyy-MM-dd")}&ok=Appointment+deleted`);
}
