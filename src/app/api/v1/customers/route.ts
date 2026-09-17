import { db } from "@/lib/db";
import { handler, json, pageResponse, paging, readBody, str } from "@/lib/api";
import { emitWebhook } from "@/lib/webhooks";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

export const GET = handler("read", async (req) => {
  const p = paging(req);
  const where = p.q ? { OR: [{ firstName: ci(p.q) }, { lastName: ci(p.q) }, { company: ci(p.q) }, { email: ci(p.q) }, { phone: { contains: p.q } }] } : {};
  const [total, rows] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], skip: p.skip, take: p.limit, include: { vehicles: { select: { id: true, year: true, make: true, model: true, licensePlate: true, vin: true, mileage: true } } } }),
  ]);
  return pageResponse(rows, total, p);
});

export const POST = handler("write", async (req, { key }) => {
  const b = await readBody(req);
  const data = {
    firstName: str(b.firstName, "firstName", { required: true, max: 80 })!,
    lastName: str(b.lastName, "lastName", { required: true, max: 80 })!,
    company: str(b.company, "company", { max: 120 }) ?? null,
    email: str(b.email, "email", { max: 200 })?.toLowerCase() ?? null,
    phone: str(b.phone, "phone", { max: 40 }) ?? null,
    address: str(b.address, "address", { max: 200 }) ?? null,
    city: str(b.city, "city", { max: 80 }) ?? null,
    state: str(b.state, "state", { max: 40 }) ?? null,
    zip: str(b.zip, "zip", { max: 20 }) ?? null,
    notes: str(b.notes, "notes", { max: 2000 }) ?? null,
    taxExempt: Boolean(b.taxExempt),
  };
  const customer = await db.customer.create({ data });
  await db.auditLog.create({ data: { action: "create", entity: "Customer", entityId: customer.id, detail: `via API key ${key.name}` } });
  emitWebhook("customer.created", customer);
  return json(customer, { status: 201 });
});
