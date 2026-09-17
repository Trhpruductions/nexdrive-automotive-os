import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { PrintButton } from "@/components/app/print-button";

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCustomer();
  const settings = await getSettings();
  const { id } = await params;
  const inv = await db.invoice.findUnique({ where: { id }, include: { customer: true, workOrder: { include: { vehicle: true, lines: { orderBy: { sortOrder: "asc" } } } } } });
  if (!inv || inv.customerId !== user.customerId) notFound();
  const balance = Number(inv.total) - Number(inv.amountPaid);

  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between items-center">
        <Link href="/portal" className="text-sm text-muted hover:text-text inline-flex items-center gap-1"><ArrowLeft size={14} /> Back</Link>
        <PrintButton />
      </div>
      <InvoiceSheet
        kind="INVOICE"
        settings={settings}
        number={inv.number}
        workOrderNumber={inv.workOrder.number}
        date={inv.issuedAt}
        dueAt={inv.dueAt}
        customer={inv.customer}
        vehicle={inv.workOrder.vehicle}
        lines={inv.workOrder.lines}
        complaint={inv.workOrder.complaint}
        diagnosis={inv.workOrder.diagnosis}
        mileageIn={inv.workOrder.mileageIn}
        amountPaid={Number(inv.amountPaid)}
        notes={inv.notes}
      />
      {balance > 0.005 ? <p className="text-sm text-muted text-center">Balance due. Pay at the counter or call {settings.phone}.</p> : null}
    </div>
  );
}
