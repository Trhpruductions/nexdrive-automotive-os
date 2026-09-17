import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InspectionSheet } from "@/components/app/inspection-sheet";
import { PrintButton } from "@/components/app/print-button";

export const metadata = { title: "Inspection report" };

export default async function PortalInspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCustomer();
  const settings = await getSettings();
  const { id } = await params;
  const wo = await db.workOrder.findUnique({ where: { id }, include: { customer: true, vehicle: { include: { photos: { where: { OR: [{ kind: "INSPECTION" }, { workOrderId: id }] }, orderBy: { createdAt: "desc" } } } }, inspection: { include: { items: { orderBy: { sortOrder: "asc" } }, technician: true } } } });
  if (!wo || wo.customerId !== user.customerId || !wo.inspection) notFound();
  return (
    <div className="space-y-4">
      <div className="no-print flex justify-between items-center"><Link href={`/portal/service/${id}`} className="text-sm text-muted hover:text-text inline-flex items-center gap-1"><ArrowLeft size={14} /> Back</Link><PrintButton /></div>
      <InspectionSheet settings={settings} inspection={wo.inspection} vehicle={wo.vehicle} customer={wo.customer} workOrderNumber={wo.number} technician={wo.inspection.technician?.name} photos={wo.vehicle.photos} />
    </div>
  );
}
