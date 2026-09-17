import { db } from "@/lib/db";
import { ApiError, handler, json, num, readBody, str } from "@/lib/api";

export const GET = handler("read", async (_req, { params }) => {
  const v = await db.vehicle.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      workOrders: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, complaint: true, mileageIn: true, createdAt: true, completedAt: true, invoice: { select: { id: true, number: true, total: true, status: true } } } },
      reminders: { where: { completed: false } },
      photos: { select: { id: true, url: true, caption: true, kind: true, createdAt: true } },
    },
  });
  if (!v) throw new ApiError(404, "Vehicle not found", "not_found");
  return json(v);
});

export const PATCH = handler("write", async (req, { params }) => {
  const b = await readBody(req);
  const data: Record<string, unknown> = {};
  for (const f of ["make", "model", "trim", "color", "licensePlate", "plateState", "engine", "transmission", "notes"] as const) if (f in b) data[f] = str(b[f], f, { max: 2000 }) ?? null;
  if ("vin" in b) data.vin = str(b.vin, "vin", { max: 17 })?.toUpperCase() ?? null;
  if ("year" in b) data.year = num(b.year, "year", { required: true, int: true, min: 1900 });
  if ("mileage" in b) data.mileage = num(b.mileage, "mileage", { required: true, int: true, min: 0 });
  if (typeof data.licensePlate === "string") data.licensePlate = data.licensePlate.toUpperCase();
  const v = await db.vehicle.update({ where: { id: params.id }, data });
  return json(v);
});
