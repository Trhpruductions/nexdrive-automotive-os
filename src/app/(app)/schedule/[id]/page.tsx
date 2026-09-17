import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ClipboardList, LogIn, Pencil, Trash2, UserX, XCircle } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteAppointment, setAppointmentStatus } from "@/actions/appointments";
import { APPT_STATUS } from "@/lib/constants";
import { fmtDateTime, fmtTime, vehicleName, woNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await db.appointment.findUnique({ where: { id }, select: { serviceRequested: true } });
  return { title: a ? `Appointment · ${a.serviceRequested}` : "Appointment" };
}

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const a = await db.appointment.findUnique({ where: { id }, include: { customer: true, vehicle: true, bay: true, technician: true, workOrder: { select: { id: true, number: true, status: true } } } });
  if (!a) notFound();
  const st = APPT_STATUS[a.status];

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{a.serviceRequested} <Badge tone={st.tone}>{st.label}</Badge></span>}
        subtitle={`${fmtDateTime(a.scheduledStart)} – ${fmtTime(a.scheduledEnd)}`}
        crumbs={[{ label: "Schedule", href: `/schedule?date=${a.scheduledStart.toISOString().slice(0, 10)}` }, { label: "Appointment" }]}
        actions={
          <>
            {a.status === "SCHEDULED" ? <form action={setAppointmentStatus.bind(null, a.id, "CONFIRMED")}><button className="btn btn-secondary"><Check size={15} /> Confirm</button></form> : null}
            {["SCHEDULED", "CONFIRMED"].includes(a.status) && !a.workOrder ? (
              <Link href={`/work-orders/new?appointmentId=${a.id}`} className="btn btn-primary"><LogIn size={15} /> Check in → work order</Link>
            ) : null}
            {a.workOrder ? <Link href={`/work-orders/${a.workOrder.id}`} className="btn btn-primary"><ClipboardList size={15} /> {woNumber(a.workOrder.number)}</Link> : null}
            {["SCHEDULED", "CONFIRMED"].includes(a.status) ? <form action={setAppointmentStatus.bind(null, a.id, "NO_SHOW")}><button className="btn btn-ghost"><UserX size={15} /> No show</button></form> : null}
            {!["CANCELLED", "COMPLETED"].includes(a.status) ? <form action={setAppointmentStatus.bind(null, a.id, "CANCELLED")}><button className="btn btn-ghost text-red-400"><XCircle size={15} /> Cancel</button></form> : null}
            <Link href={`/schedule/${a.id}/edit`} className="btn btn-secondary"><Pencil size={15} /> Edit</Link>
          </>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Appointment">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Customer" value={<Link href={`/customers/${a.customerId}`} className="hover:text-accent">{a.customer.firstName} {a.customer.lastName}</Link>} sub={a.customer.phone ?? a.customer.email ?? undefined} />
            <Stat label="Vehicle" value={<Link href={`/vehicles/${a.vehicleId}`} className="hover:text-accent">{vehicleName(a.vehicle)}</Link>} sub={a.vehicle.licensePlate ?? undefined} />
            <Stat label="Bay" value={a.bay?.name ?? "Assign later"} />
            <Stat label="Technician" value={a.technician ? <span className="flex items-center gap-2"><Avatar name={a.technician.name} color={a.technician.color} size={20} />{a.technician.name}</span> : "Any available"} />
            <Stat label="Drop-off" value={a.dropOff ? "Customer drops off" : "Customer waiting"} />
            <Stat label="Booked" value={fmtDateTime(a.createdAt)} />
          </div>
          {a.notes ? <p className="text-sm text-muted whitespace-pre-line mt-4 pt-4 border-t border-border">{a.notes}</p> : null}
        </Card>
        <Card title="Next steps">
          <ol className="space-y-2 text-sm text-muted list-decimal pl-5">
            <li>Confirm the appointment (sends a confirmation to the customer).</li>
            <li>When the vehicle arrives, <span className="text-text">Check in</span> to create the work order with the complaint pre-filled.</li>
            <li>Build the estimate, send it for approval, then start the repair.</li>
          </ol>
          <form action={deleteAppointment.bind(null, a.id)} className="mt-6 text-right">
            <ConfirmButton message="Delete this appointment?"><Trash2 size={14} /> Delete</ConfirmButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
