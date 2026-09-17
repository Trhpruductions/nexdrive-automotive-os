import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { NewWorkOrderForm } from "./new-form";

export const metadata = { title: "New work order" };

export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<{ customerId?: string; vehicleId?: string; appointmentId?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  let customerId = sp.customerId;
  let vehicleId = sp.vehicleId;
  let complaint = "";
  let technicianId: string | undefined;
  let bayId: string | undefined;
  if (sp.appointmentId) {
    const a = await db.appointment.findUnique({ where: { id: sp.appointmentId } });
    if (a) {
      customerId = a.customerId;
      vehicleId = a.vehicleId;
      complaint = a.serviceRequested;
      technicianId = a.technicianId ?? undefined;
      bayId = a.bayId ?? undefined;
    }
  }
  if (vehicleId && !customerId) {
    const v = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { customerId: true } });
    customerId = v?.customerId;
  }
  const [customers, vehicles, technicians, bays] = await Promise.all([
    db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } }),
    db.vehicle.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }], select: { id: true, customerId: true, year: true, make: true, model: true, trim: true, licensePlate: true, mileage: true } }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.bay.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="New work order" subtitle="Start with the customer's complaint — diagnosis, parts and labor come next." crumbs={[{ label: "Work Orders", href: "/work-orders" }, { label: "New" }]} />
      <NewWorkOrderForm
        customers={customers}
        vehicles={vehicles}
        technicians={technicians.map((t) => ({ id: t.id, name: t.name }))}
        bays={bays}
        initial={{ customerId, vehicleId, complaint, technicianId, bayId, appointmentId: sp.appointmentId }}
      />
    </div>
  );
}
