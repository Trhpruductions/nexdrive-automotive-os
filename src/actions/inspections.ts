"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { InspectionResult } from "@/generated/prisma/enums";

/** Create an inspection for a work order from the shop's checklist template. */
export async function startInspection(workOrderId: string) {
  const user = await requireStaff();
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, include: { inspection: true } });
  if (wo.inspection) redirect(`/inspections/${wo.inspection.id}`);
  const template = await db.inspectionTemplateItem.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const inspection = await db.inspection.create({
    data: {
      workOrderId,
      vehicleId: wo.vehicleId,
      technicianId: wo.technicianId ?? user.technicianId,
      items: { create: template.map((t, i) => ({ category: t.category, name: t.name, sortOrder: i })) },
    },
  });
  revalidatePath(`/work-orders/${workOrderId}`);
  redirect(`/inspections/${inspection.id}`);
}

export async function setInspectionItem(itemId: string, result: InspectionResult) {
  await requireStaff();
  const item = await db.inspectionItem.update({ where: { id: itemId }, data: { result } });
  await db.inspection.update({ where: { id: item.inspectionId }, data: { updatedAt: new Date() } });
  revalidatePath(`/inspections/${item.inspectionId}`);
}

export async function setInspectionItemNote(itemId: string, formData: FormData) {
  await requireStaff();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const item = await db.inspectionItem.update({ where: { id: itemId }, data: { notes } });
  revalidatePath(`/inspections/${item.inspectionId}`);
}

export async function addInspectionItem(inspectionId: string, formData: FormData) {
  await requireStaff();
  const category = String(formData.get("category") ?? "").trim() || "Other";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/inspections/${inspectionId}?error=Name+the+item`);
  const count = await db.inspectionItem.count({ where: { inspectionId } });
  await db.inspectionItem.create({ data: { inspectionId, category, name, sortOrder: count } });
  revalidatePath(`/inspections/${inspectionId}`);
  redirect(`/inspections/${inspectionId}?cat=${encodeURIComponent(category)}`);
}

export async function saveInspectionSummary(inspectionId: string, formData: FormData) {
  await requireStaff();
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const technicianId = String(formData.get("technicianId") ?? "") || null;
  await db.inspection.update({ where: { id: inspectionId }, data: { summary, technicianId } });
  revalidatePath(`/inspections/${inspectionId}`);
  redirect(`/inspections/${inspectionId}?ok=Saved`);
}

export async function markAllGood(inspectionId: string) {
  await requireStaff();
  await db.inspectionItem.updateMany({ where: { inspectionId, result: "NA" }, data: { result: "GOOD" } });
  revalidatePath(`/inspections/${inspectionId}`);
}

export async function deleteInspection(inspectionId: string) {
  await requireStaff(["OWNER", "ADMIN", "SERVICE_ADVISOR"]);
  const insp = await db.inspection.delete({ where: { id: inspectionId } });
  revalidatePath(`/work-orders/${insp.workOrderId}`);
  redirect(`/work-orders/${insp.workOrderId}?ok=Inspection+deleted`);
}
