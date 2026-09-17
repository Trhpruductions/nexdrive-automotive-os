import { db, currentShopId } from "@/lib/db";
import { ApiError, handler, json, num, pageResponse, paging, readBody, str } from "@/lib/api";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

export const GET = handler("read", async (req) => {
  const p = paging(req, 100);
  const where = {
    active: p.sp.get("includeArchived") ? undefined : true,
    ...(p.sp.get("category") ? { category: p.sp.get("category")! } : {}),
    ...(p.q ? { OR: [{ sku: ci(p.q) }, { name: ci(p.q) }, { brand: ci(p.q) }, { category: ci(p.q) }] } : {}),
  };
  const rows = await db.part.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }], include: { supplier: { select: { id: true, name: true } } } });
  const filtered = p.sp.get("low") ? rows.filter((r) => r.quantityOnHand <= r.reorderPoint) : rows;
  return pageResponse(filtered.slice(p.skip, p.skip + p.limit), filtered.length, p);
});

export const POST = handler("write", async (req) => {
  const b = await readBody(req);
  const sku = str(b.sku, "sku", { required: true, max: 60 })!.toUpperCase();
  if (await db.part.findFirst({ where: { sku } })) throw new ApiError(409, "That SKU already exists.", "conflict");
  let supplierId: string | null = null;
  const supplier = str(b.supplier, "supplier", { max: 120 });
  if (supplier) supplierId = (await db.supplier.upsert({ where: { shopId_name: { shopId: await currentShopId(), name: supplier } }, update: {}, create: { shopId: await currentShopId(), name: supplier } })).id;
  const qty = num(b.quantityOnHand, "quantityOnHand", { int: true, min: 0 }) ?? 0;
  const part = await db.part.create({
    data: { shopId: await currentShopId(),
      sku,
      name: str(b.name, "name", { required: true, max: 200 })!,
      description: str(b.description, "description", { max: 2000 }) ?? null,
      category: str(b.category, "category", { max: 80 }) ?? null,
      brand: str(b.brand, "brand", { max: 80 }) ?? null,
      location: str(b.location, "location", { max: 40 }) ?? null,
      quantityOnHand: qty,
      reorderPoint: num(b.reorderPoint, "reorderPoint", { int: true, min: 0 }) ?? 0,
      cost: num(b.cost, "cost", { min: 0 }) ?? 0,
      price: num(b.price, "price", { min: 0 }) ?? 0,
      supplierId,
      movements: qty ? { create: { delta: qty, reason: "Initial stock", reference: "api" } } : undefined,
    },
  });
  return json(part, { status: 201 });
});
