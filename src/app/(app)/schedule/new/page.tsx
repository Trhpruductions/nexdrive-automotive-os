import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { AppointmentForm } from "../appointment-form";

export const metadata = { title: "Book appointment" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ date?: string; customerId?: string; vehicleId?: string }> }) {
  await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  let customerId = sp.customerId;
  if (sp.vehicleId && !customerId) customerId = (await db.vehicle.findUnique({ where: { id: sp.vehicleId }, select: { customerId: true } }))?.customerId;
  const [customers, vehicles, technicians, bays] = await Promise.all([
    db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } }),
    db.vehicle.findMany({ select: { id: true, customerId: true, year: true, make: true, model: true, licensePlate: true } }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.bay.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const date = sp.date ?? new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="Book appointment" crumbs={[{ label: "Schedule", href: "/schedule" }, { label: "New" }]} />
      <AppointmentForm customers={customers} vehicles={vehicles} technicians={technicians} bays={bays} initial={{ customerId, vehicleId: sp.vehicleId, scheduledStart: `${date}T${settings.openTime}` }} cancelHref="/schedule" />
    </div>
  );
}
