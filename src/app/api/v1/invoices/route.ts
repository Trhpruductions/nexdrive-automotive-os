import { db } from "@/lib/db";
import { handler, pageResponse, paging } from "@/lib/api";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export const GET = handler("read", async (req) => {
  const p = paging(req);
  const status = p.sp.get("status")?.toUpperCase();
  const since = p.sp.get("since");
  const where = {
    ...(status === "OPEN" ? { status: { in: ["SENT", "PARTIAL"] as InvoiceStatus[] } } : status && ["DRAFT", "SENT", "PARTIAL", "PAID", "VOID"].includes(status) ? { status: status as InvoiceStatus } : {}),
    ...(p.sp.get("customerId") ? { customerId: p.sp.get("customerId")! } : {}),
    ...(since ? { issuedAt: { gte: new Date(since) } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, orderBy: { issuedAt: "desc" }, skip: p.skip, take: p.limit, include: { customer: { select: { id: true, firstName: true, lastName: true, email: true } }, workOrder: { select: { id: true, number: true, vehicleId: true, complaint: true } }, payments: true } }),
  ]);
  return pageResponse(rows.map((i) => ({ ...i, balance: Number(i.total) - Number(i.amountPaid) })), total, p);
});
