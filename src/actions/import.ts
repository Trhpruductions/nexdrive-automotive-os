"use server";

import { revalidatePath } from "next/cache";
import { db, currentShopId } from "@/lib/db";
import { requireStaff, MANAGER_ROLES } from "@/lib/auth";
import type { ImportEntity } from "@/lib/csv";

export type ImportSummary = { created: number; updated: number; skipped: number; errors: string[] };

type Row = Record<string, string>;
const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  if (full.includes(",")) { const [l, f] = full.split(",").map((x) => x.trim()); return { first: f ?? "", last: l }; }
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
};

/**
 * Bulk import from a mapped CSV (Settings → Import). Rows are already keyed by
 * target field. Existing records are matched (customers: email → phone → name;
 * vehicles: VIN → plate; parts: SKU) and updated with any non-empty values.
 */
export async function importRows(entity: ImportEntity, rows: Row[]): Promise<ImportSummary> {
  await requireStaff(MANAGER_ROLES);
  const shopId = await currentShopId();
  const out: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] };
  const batch = rows.slice(0, 500);
  const fail = (i: number, msg: string) => { out.skipped++; if (out.errors.length < 50) out.errors.push(`Row ${i + 2}: ${msg}`); };

  if (entity === "customers") {
    for (const [i, r] of batch.entries()) {
      let firstName = s(r.firstName, 60);
      let lastName = s(r.lastName, 60);
      if (!firstName && !lastName && r.fullName) ({ first: firstName, last: lastName } = splitName(s(r.fullName, 120)));
      // a full name that landed in the first-name column ("Nguyen, Bao" / "Bao Nguyen")
      if (firstName && !lastName && /[\s,]/.test(firstName)) ({ first: firstName, last: lastName } = splitName(firstName));
      if (!firstName && !lastName) { fail(i, "no name"); continue; }
      const email = s(r.email, 120).toLowerCase() || null;
      const phone = s(r.phone, 40) || null;
      const data = { firstName: firstName || "-", lastName, company: s(r.company, 120) || null, email, phone, address: s(r.address) || null, city: s(r.city, 80) || null, state: s(r.state, 40) || null, zip: s(r.zip, 20) || null, notes: s(r.notes, 2000) || null };
      const existing =
        (email ? await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null) ??
        (phone ? await db.customer.findFirst({ where: { phone } }) : null) ??
        (await db.customer.findFirst({ where: { firstName: { equals: data.firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" } } }));
      if (existing) {
        const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== ""));
        await db.customer.update({ where: { id: existing.id }, data: patch });
        out.updated++;
      } else {
        await db.customer.create({ data: { shopId, ...data } });
        out.created++;
      }
    }
  }

  if (entity === "vehicles") {
    for (const [i, r] of batch.entries()) {
      const year = Math.round(num(r.year));
      const make = s(r.make, 60);
      const model = s(r.model, 60);
      if (!year || !make || !model) { fail(i, "year, make and model are required"); continue; }
      const email = s(r.ownerEmail, 120).toLowerCase();
      const phone = s(r.ownerPhone, 40);
      const name = s(r.ownerName, 120);
      let owner =
        (email ? await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null) ??
        (phone ? await db.customer.findFirst({ where: { phone } }) : null) ?? null;
      if (!owner && name) {
        const { first, last } = splitName(name);
        owner = await db.customer.findFirst({ where: { firstName: { equals: first, mode: "insensitive" }, lastName: { equals: last, mode: "insensitive" } } });
        if (!owner) owner = await db.customer.create({ data: { shopId, firstName: first || "-", lastName: last, email: email || null, phone: phone || null, notes: "Created by vehicle import" } });
      }
      if (!owner) { fail(i, "no owner (need an owner email, phone or name)"); continue; }
      const vin = s(r.vin, 17).toUpperCase() || null;
      const licensePlate = s(r.licensePlate, 16).toUpperCase() || null;
      const data = { year, make, model, trim: s(r.trim, 60) || null, color: s(r.color, 40) || null, vin, licensePlate, plateState: s(r.plateState, 10) || null, mileage: Math.max(0, Math.round(num(r.mileage))), engine: s(r.engine, 80) || null, transmission: s(r.transmission, 80) || null, notes: s(r.notes, 2000) || null };
      const existing =
        (vin ? await db.vehicle.findFirst({ where: { vin } }) : null) ??
        (licensePlate ? await db.vehicle.findFirst({ where: { licensePlate, customerId: owner.id } }) : null);
      if (existing) {
        const patch = Object.fromEntries(Object.entries(data).filter(([k, v]) => v !== null && v !== "" && !(k === "mileage" && v === 0)));
        await db.vehicle.update({ where: { id: existing.id }, data: patch });
        out.updated++;
      } else {
        await db.vehicle.create({ data: { shopId, customerId: owner.id, ...data } });
        out.created++;
      }
    }
  }

  if (entity === "parts") {
    const supplierCache = new Map<string, string>();
    for (const [i, r] of batch.entries()) {
      const sku = s(r.sku, 60);
      const name = s(r.name, 160);
      if (!sku || !name) { fail(i, "SKU and name are required"); continue; }
      let supplierId: string | null = null;
      const supplierName = s(r.supplier, 120);
      if (supplierName) {
        const key = supplierName.toLowerCase();
        supplierId = supplierCache.get(key) ?? null;
        if (!supplierId) {
          const sup = (await db.supplier.findFirst({ where: { name: { equals: supplierName, mode: "insensitive" } } })) ?? (await db.supplier.create({ data: { shopId, name: supplierName } }));
          supplierId = sup.id;
          supplierCache.set(key, sup.id);
        }
      }
      const data = { name, brand: s(r.brand, 80) || null, category: s(r.category, 80) || null, location: s(r.location, 80) || null, quantityOnHand: Math.max(0, Math.round(num(r.quantityOnHand))), reorderPoint: Math.max(0, Math.round(num(r.reorderPoint))), cost: num(r.cost), price: num(r.price), supplierId };
      const existing = await db.part.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } } });
      if (existing) {
        const patch: Record<string, unknown> = { name };
        for (const [k, v] of Object.entries(data)) if (v !== null && v !== "" && !(typeof v === "number" && v === 0 && !(k in r))) patch[k] = v;
        const qtyBefore = existing.quantityOnHand;
        await db.part.update({ where: { id: existing.id }, data: patch });
        if (r.quantityOnHand !== undefined && data.quantityOnHand !== qtyBefore) await db.stockMovement.create({ data: { partId: existing.id, delta: data.quantityOnHand - qtyBefore, reason: "Import adjustment" } });
        out.updated++;
      } else {
        await db.part.create({ data: { shopId, sku, ...data } });
        out.created++;
      }
    }
  }

  revalidatePath("/customers");
  revalidatePath("/vehicles");
  revalidatePath("/parts");
  return out;
}
