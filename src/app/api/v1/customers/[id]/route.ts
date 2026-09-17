import { db } from "@/lib/db";
import { ApiError, handler, json, readBody, str } from "@/lib/api";

export const GET = handler("read", async (_req, { params }) => {
  const c = await db.customer.findUnique({
    where: { id: params.id },
    include: {
      vehicles: true,
      workOrders: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, number: true, status: true, complaint: true, createdAt: true, vehicleId: true } },
      invoices: { orderBy: { issuedAt: "desc" }, take: 20, select: { id: true, number: true, status: true, total: true, amountPaid: true, issuedAt: true, dueAt: true } },
      portalUser: { select: { email: true, active: true } },
    },
  });
  if (!c) throw new ApiError(404, "Customer not found", "not_found");
  return json(c);
});

export const PATCH = handler("write", async (req, { params }) => {
  const b = await readBody(req);
  const data: Record<string, unknown> = {};
  for (const f of ["firstName", "lastName", "company", "email", "phone", "address", "city", "state", "zip", "notes"] as const) {
    if (f in b) data[f] = str(b[f], f, { max: 2000 }) ?? null;
  }
  if (typeof data.email === "string") data.email = data.email.toLowerCase();
  if ("taxExempt" in b) data.taxExempt = Boolean(b.taxExempt);
  if (data.firstName === null || data.lastName === null) throw new ApiError(422, "firstName and lastName cannot be empty.", "validation");
  const c = await db.customer.update({ where: { id: params.id }, data });
  return json(c);
});
