import { db, currentShopId } from "@/lib/db";
import { ApiError, handler, json, num, pageResponse, paging, readBody, str } from "@/lib/api";
import { emitWebhook } from "@/lib/webhooks";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

export const GET = handler("read", async (req) => {
  const p = paging(req);
  const customerId = p.sp.get("customerId") || undefined;
  const where = {
    ...(customerId ? { customerId } : {}),
    ...(p.q ? { OR: [{ make: ci(p.q) }, { model: ci(p.q) }, { vin: ci(p.q) }, { licensePlate: ci(p.q) }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.vehicle.count({ where }),
    db.vehicle.findMany({ where, orderBy: { updatedAt: "desc" }, skip: p.skip, take: p.limit, include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } } }),
  ]);
  return pageResponse(rows, total, p);
});

export const POST = handler("write", async (req) => {
  const b = await readBody(req);
  const customerId = str(b.customerId, "customerId", { required: true })!;
  if (!(await db.customer.findUnique({ where: { id: customerId } }))) throw new ApiError(422, "customerId does not exist.", "validation");
  const vin = str(b.vin, "vin", { max: 17 })?.toUpperCase() ?? null;
  if (vin && (await db.vehicle.findFirst({ where: { vin } }))) throw new ApiError(409, "A vehicle with that VIN already exists.", "conflict");
  const v = await db.vehicle.create({
    data: { shopId: await currentShopId(),
      customerId,
      year: num(b.year, "year", { required: true, int: true, min: 1900 })!,
      make: str(b.make, "make", { required: true, max: 60 })!,
      model: str(b.model, "model", { required: true, max: 60 })!,
      trim: str(b.trim, "trim", { max: 60 }) ?? null,
      color: str(b.color, "color", { max: 40 }) ?? null,
      vin,
      licensePlate: str(b.licensePlate, "licensePlate", { max: 16 })?.toUpperCase() ?? null,
      plateState: str(b.plateState, "plateState", { max: 4 })?.toUpperCase() ?? null,
      mileage: num(b.mileage, "mileage", { int: true, min: 0 }) ?? 0,
      engine: str(b.engine, "engine", { max: 80 }) ?? null,
      transmission: str(b.transmission, "transmission", { max: 80 }) ?? null,
      notes: str(b.notes, "notes", { max: 2000 }) ?? null,
    },
  });
  emitWebhook("vehicle.created", v);
  return json(v, { status: 201 });
});
