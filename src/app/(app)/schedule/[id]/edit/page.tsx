import { notFound } from "next/navigation";
import { differenceInMinutes } from "date-fns";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { toLocalInput } from "@/lib/format";
import { AppointmentForm } from "../../appointment-form";

export const metadata = { title: "Edit appointment" };

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const [a, customers, vehicles, technicians, bays] = await Promise.all([
    db.appointment.findUnique({ where: { id } }),
    db.customer.findMany({ orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, company: true } }),
    db.vehicle.findMany({ select: { id: true, customerId: true, year: true, make: true, model: true, licensePlate: true } }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.bay.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!a) notFound();
  return (
    <div>
      <PageHeader title="Edit appointment" crumbs={[{ label: "Schedule", href: "/schedule" }, { label: "Appointment", href: `/schedule/${id}` }, { label: "Edit" }]} />
      <AppointmentForm
        customers={customers}
        vehicles={vehicles}
        technicians={technicians}
        bays={bays}
        initial={{ ...a, scheduledStart: toLocalInput(a.scheduledStart), durationMinutes: differenceInMinutes(a.scheduledEnd, a.scheduledStart) }}
        cancelHref={`/schedule/${id}`}
      />
    </div>
  );
}
