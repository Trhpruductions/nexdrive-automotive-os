import "server-only";
import { db } from "./db";

export type InvoiceLine = { id: string; kind: "LABOR" | "PART" | "FEE" | "DISCOUNT"; description: string; quantity: { toString(): string }; unitPrice: { toString(): string }; hours: { toString(): string } | null; taxable: boolean; approved: boolean };

/**
 * Invoices come from two places: a service work order (lines, vehicle, concern)
 * or a shipment of finished goods (parts × quantity). This resolves either into
 * what the invoice sheet, portal and pay page need.
 */
export async function invoiceView(invoiceId: string) {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      payments: { orderBy: { paidAt: "desc" } },
      workOrder: { include: { vehicle: true, lines: { orderBy: { sortOrder: "asc" } } } },
      shipment: { include: { lines: { include: { part: { select: { name: true, sku: true, customerPartNumber: true, unit: true } }, job: { select: { number: true, customerPo: true } } } } } },
    },
  });
  if (!inv) return null;
  const wo = inv.workOrder;
  const sh = inv.shipment;
  const lines: InvoiceLine[] = wo
    ? wo.lines
    : (sh?.lines ?? []).map((l) => ({ id: l.id, kind: "PART" as const, description: `${l.part.name}${l.part.customerPartNumber ? ` (${l.part.customerPartNumber})` : ""}${l.job ? ` · JOB-${String(l.job.number).padStart(5, "0")}` : ""}`, quantity: l.quantity, unitPrice: l.unitPrice, hours: null, taxable: true, approved: true }));
  const pos = [...new Set((sh?.lines ?? []).map((l) => l.job?.customerPo).filter(Boolean))];
  return {
    inv,
    lines,
    vehicle: wo?.vehicle ?? null,
    workOrderNumber: wo?.number ?? null,
    reference: sh ? `Shipment SH-${String(sh.number).padStart(5, "0")}${pos.length ? ` · PO ${pos.join(", ")}` : ""}${sh.tracking ? ` · ${sh.carrier ?? ""} ${sh.tracking}`.trimEnd() : ""}` : null,
    complaint: wo?.complaint ?? null,
    diagnosis: wo?.diagnosis ?? null,
    mileageIn: wo?.mileageIn ?? null,
    backHref: wo ? `/work-orders/${wo.id}` : sh ? `/shipments/${sh.id}` : "/invoices",
    backLabel: wo ? `WO-${String(wo.number).padStart(5, "0")}` : sh ? `SH-${String(sh.number).padStart(5, "0")}` : "Invoices",
  };
}
