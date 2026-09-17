import { db } from "@/lib/db";
import { ApiError, handler, json, num, readBody, str } from "@/lib/api";
import { emitWebhook } from "@/lib/webhooks";

async function find(idOrSku: string) {
  const part = (await db.part.findUnique({ where: { id: idOrSku } })) ?? (await db.part.findUnique({ where: { sku: idOrSku.toUpperCase() } }));
  if (!part) throw new ApiError(404, "Part not found", "not_found");
  return part;
}

export const GET = handler("read", async (_req, { params }) => {
  const part = await find(params.id);
  const full = await db.part.findUnique({ where: { id: part.id }, include: { supplier: true, movements: { orderBy: { createdAt: "desc" }, take: 50 } } });
  return json(full);
});

/** PATCH fields, or { adjust: <delta>, reason } / { quantityOnHand: <absolute> } to move stock. Accepts id or SKU. */
export const PATCH = handler("write", async (req, { params, key }) => {
  const b = await readBody(req);
  const part = await find(params.id);
  const data: Record<string, unknown> = {};
  for (const f of ["name", "description", "category", "brand", "location"] as const) if (f in b) data[f] = str(b[f], f, { max: 2000 }) ?? null;
  for (const f of ["cost", "price"] as const) if (f in b) data[f] = num(b[f], f, { required: true, min: 0 });
  if ("reorderPoint" in b) data.reorderPoint = num(b.reorderPoint, "reorderPoint", { required: true, int: true, min: 0 });
  if ("active" in b) data.active = Boolean(b.active);
  if ("sku" in b) {
    const sku = str(b.sku, "sku", { required: true, max: 60 })!.toUpperCase();
    const dupe = await db.part.findUnique({ where: { sku } });
    if (dupe && dupe.id !== part.id) throw new ApiError(409, "That SKU already exists.", "conflict");
    data.sku = sku;
  }
  let delta = 0;
  if ("adjust" in b) delta = num(b.adjust, "adjust", { required: true, int: true })!;
  else if ("quantityOnHand" in b) delta = num(b.quantityOnHand, "quantityOnHand", { required: true, int: true, min: 0 })! - part.quantityOnHand;
  if (part.quantityOnHand + delta < 0) throw new ApiError(422, "Stock cannot go below zero.", "validation");
  if (delta) data.quantityOnHand = { increment: delta };
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.part.update({ where: { id: part.id }, data });
    if (delta) await tx.stockMovement.create({ data: { partId: part.id, delta, reason: str(b.reason, "reason", { max: 200 }) ?? "API adjustment", reference: `api:${key.name}` } });
    return u;
  });
  if (delta && updated.quantityOnHand <= updated.reorderPoint && part.quantityOnHand > part.reorderPoint) emitWebhook("part.low_stock", updated);
  return json(updated);
});
