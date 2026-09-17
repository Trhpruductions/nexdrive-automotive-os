import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { InspectionSheet } from "@/components/app/inspection-sheet";
import { PrintButton } from "@/components/app/print-button";

export const metadata = { title: "Inspection report" };

export default async function InspectionPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const settings = await getSettings();
  const { id } = await params;
  const insp = await db.inspection.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } }, technician: true, vehicle: { include: { photos: { where: { OR: [{ kind: "INSPECTION" }, { workOrder: { inspection: { id } } }] }, orderBy: { createdAt: "desc" } } } }, workOrder: { include: { customer: true } } } });
  if (!insp) notFound();
  return (
    <div className="max-w-4xl mx-auto">
      <div className="no-print flex justify-between mb-4"><Link href={`/inspections/${id}`} className="btn btn-ghost">← Back to inspection</Link><PrintButton /></div>
      <InspectionSheet settings={settings} inspection={insp} vehicle={insp.vehicle} customer={insp.workOrder.customer} workOrderNumber={insp.workOrder.number} technician={insp.technician?.name} photos={insp.vehicle.photos} />
    </div>
  );
}
