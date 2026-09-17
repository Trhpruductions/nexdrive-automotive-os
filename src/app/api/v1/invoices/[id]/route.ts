import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";

export const GET = handler("read", async (_req, { params }) => {
  const i = await db.invoice.findUnique({ where: { id: params.id }, include: { customer: true, payments: true, workOrder: { include: { vehicle: true, lines: { orderBy: { sortOrder: "asc" } } } } } });
  if (!i) throw new ApiError(404, "Invoice not found", "not_found");
  return json({ ...i, balance: Number(i.total) - Number(i.amountPaid) });
});
