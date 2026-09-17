"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { FormState } from "./customers";

const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const PartSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").toUpperCase(),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  location: z.string().optional(),
  supplierId: z.string().optional(),
  quantityOnHand: z.coerce.number().int().min(0).default(0),
  reorderPoint: z.coerce.number().int().min(0).default(0),
  cost: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
});

export async function createPart(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = PartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (await db.part.findUnique({ where: { sku: d.sku } })) return { error: "That SKU already exists" };
  const part = await db.part.create({ data: { ...d, description: opt(d.description), category: opt(d.category), brand: opt(d.brand), location: opt(d.location), supplierId: opt(d.supplierId) } });
  if (d.quantityOnHand) await db.stockMovement.create({ data: { partId: part.id, delta: d.quantityOnHand, reason: "Initial stock" } });
  revalidatePath("/parts");
  redirect(`/parts/${part.id}`);
}

export async function updatePart(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = PartSchema.omit({ quantityOnHand: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const dupe = await db.part.findUnique({ where: { sku: d.sku } });
  if (dupe && dupe.id !== id) return { error: "That SKU already exists" };
  await db.part.update({ where: { id }, data: { ...d, description: opt(d.description), category: opt(d.category), brand: opt(d.brand), location: opt(d.location), supplierId: opt(d.supplierId), active: formData.get("active") !== "false" } });
  revalidatePath(`/parts/${id}`);
  redirect(`/parts/${id}?ok=Part+updated`);
}

export async function adjustStock(id: string, formData: FormData) {
  const user = await requireStaff();
  const delta = Math.trunc(Number(formData.get("delta")));
  const reason = String(formData.get("reason") ?? "").trim() || "Manual adjustment";
  const returnTo = String(formData.get("returnTo") ?? `/parts/${id}`);
  if (!delta) redirect(`${returnTo}?error=Enter+a+quantity`);
  const part = await db.part.findUniqueOrThrow({ where: { id } });
  if (part.quantityOnHand + delta < 0) redirect(`${returnTo}?error=Stock+cannot+go+below+zero`);
  await db.$transaction([
    db.part.update({ where: { id }, data: { quantityOnHand: { increment: delta } } }),
    db.stockMovement.create({ data: { partId: id, delta, reason, reference: user.name } }),
  ]);
  revalidatePath(`/parts/${id}`);
  revalidatePath("/parts");
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}ok=${encodeURIComponent(`${part.name}: ${delta > 0 ? "+" : ""}${delta} → ${part.quantityOnHand + delta}`)}`);
}

/** Barcode / SKU scan: find the part by SKU and adjust. */
export async function scanAdjust(formData: FormData) {
  await requireStaff();
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const delta = Math.trunc(Number(formData.get("delta"))) || 1;
  const mode = String(formData.get("mode") ?? "receive");
  const part = await db.part.findUnique({ where: { sku } });
  if (!part) redirect(`/parts/scan?error=${encodeURIComponent(`No part with SKU ${sku}`)}&mode=${mode}`);
  const signed = mode === "pull" ? -Math.abs(delta) : Math.abs(delta);
  if (part.quantityOnHand + signed < 0) redirect(`/parts/scan?error=Stock+cannot+go+below+zero&mode=${mode}`);
  await db.$transaction([
    db.part.update({ where: { id: part.id }, data: { quantityOnHand: { increment: signed } } }),
    db.stockMovement.create({ data: { partId: part.id, delta: signed, reason: mode === "pull" ? "Scanned out" : "Scanned in", reference: "scanner" } }),
  ]);
  revalidatePath("/parts");
  redirect(`/parts/scan?ok=${encodeURIComponent(`${part.name}: ${signed > 0 ? "+" : ""}${signed} → ${part.quantityOnHand + signed}`)}&mode=${mode}`);
}

export async function deletePart(id: string) {
  await requireStaff(["OWNER", "ADMIN"]);
  const used = await db.workOrderLine.count({ where: { partId: id } });
  if (used) {
    await db.part.update({ where: { id }, data: { active: false } });
    redirect(`/parts/${id}?ok=Part+archived+(it+is+used+on+work+orders)`);
  }
  await db.part.delete({ where: { id } });
  revalidatePath("/parts");
  redirect("/parts?ok=Part+deleted");
}

export async function createSupplier(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/parts/suppliers?error=Name+is+required");
  await db.supplier.upsert({ where: { name }, update: { phone: opt(formData.get("phone")), email: opt(formData.get("email")), website: opt(formData.get("website")) }, create: { name, phone: opt(formData.get("phone")), email: opt(formData.get("email")), website: opt(formData.get("website")) } });
  revalidatePath("/parts/suppliers");
  redirect("/parts/suppliers?ok=Supplier+saved");
}

export async function deleteSupplier(id: string) {
  await requireStaff(["OWNER", "ADMIN"]);
  await db.supplier.delete({ where: { id } });
  revalidatePath("/parts/suppliers");
  redirect("/parts/suppliers?ok=Supplier+removed");
}
