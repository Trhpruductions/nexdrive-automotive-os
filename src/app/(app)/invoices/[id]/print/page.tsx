import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { PrintButton } from "@/components/app/print-button";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(BILLING_ROLES);
  const settings = await getSettings();
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true, workOrder: { include: { vehicle: true, lines: { orderBy: { sortOrder: "asc" } } } } } });
  if (!inv) notFound();
  return (
    <div className="max-w-3xl mx-auto">
      <div className="no-print flex justify-between mb-4">
        <Link href={`/invoices/${id}`} className="btn btn-ghost">← Back</Link>
        <PrintButton />
      </div>
      <InvoiceSheet kind="INVOICE" settings={settings} number={inv.number} workOrderNumber={inv.workOrder.number} date={inv.issuedAt} dueAt={inv.dueAt} customer={inv.customer} vehicle={inv.workOrder.vehicle} lines={inv.workOrder.lines} complaint={inv.workOrder.complaint} diagnosis={inv.workOrder.diagnosis} mileageIn={inv.workOrder.mileageIn} amountPaid={Number(inv.amountPaid)} notes={inv.notes} />
    </div>
  );
}
