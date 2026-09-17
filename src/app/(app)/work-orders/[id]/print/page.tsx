import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InvoiceSheet } from "@/components/app/invoice-sheet";
import { PrintButton } from "@/components/app/print-button";

export default async function WorkOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const settings = await getSettings();
  const { id } = await params;
  const wo = await db.workOrder.findUnique({ where: { id }, include: { customer: true, vehicle: true, lines: { orderBy: { sortOrder: "asc" } } } });
  if (!wo) notFound();
  return (
    <div className="max-w-3xl mx-auto">
      <div className="no-print flex justify-between mb-4">
        <Link href={`/work-orders/${id}`} className="btn btn-ghost">← Back</Link>
        <PrintButton />
      </div>
      <InvoiceSheet kind="ESTIMATE" settings={settings} number={wo.number} workOrderNumber={wo.number} date={wo.createdAt} customer={wo.customer} vehicle={wo.vehicle} lines={wo.lines} complaint={wo.complaint} diagnosis={wo.diagnosis} mileageIn={wo.mileageIn} notes={settings.approvalMessage} showDeclined />
    </div>
  );
}
