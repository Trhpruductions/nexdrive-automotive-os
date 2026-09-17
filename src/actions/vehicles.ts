"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, currentShopId } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import type { FormState } from "./customers";

const VehicleSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  year: z.coerce.number().int().min(1900).max(2100),
  make: z.string().trim().min(1, "Make is required"),
  model: z.string().trim().min(1, "Model is required"),
  trim: z.string().trim().optional().transform((v) => v || null),
  color: z.string().trim().optional().transform((v) => v || null),
  vin: z.string().trim().toUpperCase().optional().transform((v) => v || null),
  licensePlate: z.string().trim().toUpperCase().optional().transform((v) => v || null),
  plateState: z.string().trim().toUpperCase().optional().transform((v) => v || null),
  mileage: z.coerce.number().int().min(0).default(0),
  engine: z.string().trim().optional().transform((v) => v || null),
  transmission: z.string().trim().optional().transform((v) => v || null),
  notes: z.string().trim().optional().transform((v) => v || null),
});

export async function createVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const parsed = VehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.vin) {
    const dupe = await db.vehicle.findFirst({ where: { vin: parsed.data.vin } });
    if (dupe) return { error: "A vehicle with that VIN already exists" };
  }
  const v = await db.vehicle.create({ data: { ...parsed.data, shopId: await currentShopId() } });
  await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "create", entity: "Vehicle", entityId: v.id, detail: `${v.year} ${v.make} ${v.model}` } });
  revalidatePath("/vehicles");
  const returnTo = formData.get("returnTo");
  redirect(typeof returnTo === "string" && returnTo.startsWith("/") ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}vehicleId=${v.id}` : `/vehicles/${v.id}`);
}

export async function updateVehicle(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = VehicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.vin) {
    const dupe = await db.vehicle.findFirst({ where: { vin: parsed.data.vin } });
    if (dupe && dupe.id !== id) return { error: "A vehicle with that VIN already exists" };
  }
  await db.vehicle.update({ where: { id }, data: parsed.data });
  revalidatePath(`/vehicles/${id}`);
  redirect(`/vehicles/${id}?ok=Vehicle+updated`);
}

export async function deleteVehicle(id: string) {
  await requireStaff(["OWNER", "ADMIN"]);
  const count = await db.workOrder.count({ where: { vehicleId: id } });
  if (count > 0) redirect(`/vehicles/${id}?error=Vehicles+with+work+orders+cannot+be+deleted`);
  await db.vehicle.delete({ where: { id } });
  revalidatePath("/vehicles");
  redirect("/vehicles?ok=Vehicle+deleted");
}

export async function addVehiclePhoto(vehicleId: string, formData: FormData) {
  await requireStaff();
  const file = formData.get("photo");
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "GENERAL") as "GENERAL" | "DAMAGE" | "INSPECTION" | "BEFORE" | "AFTER";
  const workOrderId = String(formData.get("workOrderId") ?? "") || null;
  const back = String(formData.get("returnTo") ?? `/vehicles/${vehicleId}`);
  if (!(file instanceof File) || file.size === 0) redirect(`${back}?error=Choose+a+photo`);
  const url = await saveUpload(file, "vehicles");
  if (!url) redirect(`${back}?error=Only+JPG%2C+PNG%2C+WEBP+or+HEIC+up+to+15MB`);
  await db.vehiclePhoto.create({ data: { vehicleId, url, caption, kind, workOrderId } });
  revalidatePath(back);
  redirect(`${back}?ok=Photo+added`);
}

export async function deleteVehiclePhoto(id: string, returnTo: string) {
  await requireStaff();
  await db.vehiclePhoto.delete({ where: { id } });
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function addReminder(vehicleId: string, formData: FormData) {
  await requireStaff();
  const service = String(formData.get("service") ?? "").trim();
  if (!service) redirect(`/vehicles/${vehicleId}?error=Describe+the+service`);
  const mileage = Number(formData.get("dueAtMileage")) || null;
  const dateRaw = String(formData.get("dueAtDate") ?? "");
  await db.maintenanceReminder.create({ data: { vehicleId, service, dueAtMileage: mileage, dueAtDate: dateRaw ? new Date(dateRaw) : null } });
  revalidatePath(`/vehicles/${vehicleId}`);
  redirect(`/vehicles/${vehicleId}?ok=Reminder+added`);
}

export async function toggleReminder(id: string, vehicleId: string) {
  await requireStaff();
  const r = await db.maintenanceReminder.findUniqueOrThrow({ where: { id } });
  await db.maintenanceReminder.update({ where: { id }, data: { completed: !r.completed } });
  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function deleteReminder(id: string, vehicleId: string) {
  await requireStaff();
  await db.maintenanceReminder.delete({ where: { id } });
  revalidatePath(`/vehicles/${vehicleId}`);
}
