"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireStaff, BILLING_ROLES } from "@/lib/auth";
import type { FormState } from "./customers";

const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const Schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().optional(),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  hourlyRate: z.coerce.number().min(0).default(0),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#3b82f6"),
  active: z.string().optional(),
  loginPassword: z.string().optional(),
});

export async function createTechnician(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(BILLING_ROLES);
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  let userId: string | null = null;
  if (d.loginPassword) {
    if (!d.email) return { error: "An email is required to create a login" };
    if (d.loginPassword.length < 8) return { error: "Password must be at least 8 characters" };
    if (await db.user.findUnique({ where: { email: d.email } })) return { error: "That email already has a login" };
    userId = (await db.user.create({ data: { email: d.email, name: d.name, role: "TECHNICIAN", passwordHash: await hashPassword(d.loginPassword) } })).id;
  }
  const t = await db.technician.create({ data: { name: d.name, email: opt(d.email), phone: opt(d.phone), specialty: opt(d.specialty), hourlyRate: d.hourlyRate, color: d.color, userId } });
  revalidatePath("/technicians");
  redirect(`/technicians/${t.id}`);
}

export async function updateTechnician(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff(BILLING_ROLES);
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const t = await db.technician.findUniqueOrThrow({ where: { id }, include: { user: true } });
  if (d.loginPassword) {
    if (!d.email) return { error: "An email is required to create a login" };
    if (d.loginPassword.length < 8) return { error: "Password must be at least 8 characters" };
    const passwordHash = await hashPassword(d.loginPassword);
    if (t.user) await db.user.update({ where: { id: t.user.id }, data: { passwordHash, email: d.email, name: d.name } });
    else {
      if (await db.user.findUnique({ where: { email: d.email } })) return { error: "That email already has a login" };
      const u = await db.user.create({ data: { email: d.email, name: d.name, role: "TECHNICIAN", passwordHash } });
      await db.technician.update({ where: { id }, data: { userId: u.id } });
    }
  } else if (t.user && d.email && t.user.email !== d.email) {
    await db.user.update({ where: { id: t.user.id }, data: { email: d.email, name: d.name } });
  }
  const active = d.active !== "false";
  await db.technician.update({ where: { id }, data: { name: d.name, email: opt(d.email), phone: opt(d.phone), specialty: opt(d.specialty), hourlyRate: d.hourlyRate, color: d.color, active } });
  if (t.user) await db.user.update({ where: { id: t.user.id }, data: { active } });
  revalidatePath(`/technicians/${id}`);
  redirect(`/technicians/${id}?ok=Saved`);
}

export async function clockTech(technicianId: string, workOrderId: string, formData: FormData) {
  await requireStaff();
  const open = await db.timeEntry.findFirst({ where: { technicianId, endedAt: null } });
  const note = opt(formData.get("note"));
  if (open) await db.timeEntry.update({ where: { id: open.id }, data: { endedAt: new Date(), note: note ?? open.note } });
  else await db.timeEntry.create({ data: { technicianId, workOrderId, note } });
  revalidatePath(`/technicians/${technicianId}`);
  revalidatePath(`/work-orders/${workOrderId}`);
  redirect(`/technicians/${technicianId}?ok=${open ? "Clocked+out" : "Clocked+in"}`);
}
