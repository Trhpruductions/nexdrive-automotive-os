import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { invoiceView } from "@/lib/invoice-view";
import { getSettings } from "@/lib/settings";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { PrintButton } from "@/components/app/print-button";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(BILLING_ROLES);
  const settings = await getSettings();
  const { id } = await params;
  const view = await invoiceView(id);
  if (!view) notFound();
  const { inv } = view;
  return (
    <div className="max-w-3xl mx-auto">
      <div className="no-print flex justify-between mb-4">
        <Link href={`/invoices/${id}`} className="btn btn-ghost">← Back</Link>
        <PrintButton />
      </div>
      <InvoiceSheet kind="INVOICE" settings={settings} number={inv.number} workOrderNumber={view.workOrderNumber} reference={view.reference} date={inv.issuedAt} dueAt={inv.dueAt} customer={inv.customer} vehicle={view.vehicle} lines={view.lines} complaint={view.complaint} diagnosis={view.diagnosis} mileageIn={view.mileageIn} amountPaid={Number(inv.amountPaid)} notes={inv.notes} />
    </div>
  );
}
