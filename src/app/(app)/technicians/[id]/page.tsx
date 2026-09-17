import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Pencil } from "lucide-react";
import { differenceInMinutes, startOfDay, startOfWeek } from "date-fns";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { clockTech } from "@/actions/technicians";
import { WO_STATUS } from "@/lib/constants";
import { fmtDateTime, fmtTime, money, vehicleName, woNumber } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.technician.findUnique({ where: { id }, select: { name: true } });
  return { title: t?.name ?? "Technician" };
}

export default async function TechnicianPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const t = await db.technician.findUnique({
    where: { id },
    include: {
      user: { select: { email: true } },
      workOrders: { where: { status: { notIn: ["INVOICED", "CANCELLED"] } }, orderBy: { updatedAt: "desc" }, include: { vehicle: true, customer: true } },
      timeEntries: { orderBy: { startedAt: "desc" }, take: 20, include: { workOrder: { select: { id: true, number: true } } } },
      appointments: { where: { scheduledStart: { gte: startOfDay(now) } }, orderBy: { scheduledStart: "asc" }, take: 8, include: { vehicle: true } },
    },
  });
  if (!t) notFound();
  if (user.role === "TECHNICIAN" && user.technicianId !== id) notFound();
  const open = t.timeEntries.find((e) => !e.endedAt);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekMins = t.timeEntries.filter((e) => e.startedAt >= weekStart).reduce((s, e) => s + differenceInMinutes(e.endedAt ?? now, e.startedAt), 0);
  const completed = await db.workOrder.count({ where: { technicianId: id, status: "INVOICED" } });

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={t.name} color={t.color} size={36} /> {t.name} {open ? <Badge tone="green">On the clock</Badge> : null}</span>}
        subtitle={[t.specialty, t.user?.email, t.phone].filter(Boolean).join(" · ")}
        crumbs={[{ label: "Technicians", href: "/technicians" }, { label: t.name }]}
        actions={user.role !== "TECHNICIAN" ? <Link href={`/technicians/${id}/edit`} className="btn btn-primary"><Pencil size={15} /> Edit</Link> : null}
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Time clock">
            {open ? (
              <p className="text-sm mb-3">Clocked in {fmtTime(open.startedAt)} on <Link href={`/work-orders/${open.workOrderId}`} className="text-accent">{woNumber(open.workOrder.number)}</Link> · {(differenceInMinutes(now, open.startedAt) / 60).toFixed(1)} h so far</p>
            ) : (
              <p className="text-sm text-muted mb-3">Not clocked in. Pick a job to start the clock.</p>
            )}
            <form action={clockTech.bind(null, t.id, open?.workOrderId ?? t.workOrders[0]?.id ?? "")} className="space-y-2">
              {!open ? (
                <select name="workOrderId" className="select" disabled={!t.workOrders.length}>
                  {t.workOrders.map((w) => <option key={w.id} value={w.id}>{woNumber(w.number)} · {vehicleName(w.vehicle)}</option>)}
                </select>
              ) : null}
              <input name="note" placeholder="Note (optional)" className="input" />
              <button className={`btn w-full ${open ? "btn-secondary" : "btn-primary"}`} disabled={!open && !t.workOrders.length}><Clock size={15} /> {open ? "Clock out" : "Clock in"}</button>
            </form>
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
              <Stat label="This week" value={`${(weekMins / 60).toFixed(1)} h`} />
              <Stat label="Jobs completed" value={completed} />
              <Stat label="Cost rate" value={`${money(t.hourlyRate)}/hr`} />
              <Stat label="Active jobs" value={t.workOrders.length} />
            </div>
          </Card>
          <Card title="Upcoming appointments">
            {t.appointments.length ? (
              <ul className="space-y-2 text-sm">
                {t.appointments.map((a) => <li key={a.id}><Link href={`/schedule/${a.id}`} className="flex justify-between gap-2 hover:text-accent"><span className="truncate">{vehicleName(a.vehicle)} · {a.serviceRequested}</span><span className="text-xs text-muted shrink-0">{fmtDateTime(a.scheduledStart)}</span></Link></li>)}
              </ul>
            ) : <p className="text-sm text-muted">Nothing scheduled.</p>}
          </Card>
        </div>
        <div className="xl:col-span-2 space-y-4">
          <Card title="Assigned work orders" padded={false}>
            {t.workOrders.length ? (
              <table className="table">
                <thead><tr><th>Work order</th><th>Vehicle</th><th>Customer</th><th>Status</th></tr></thead>
                <tbody>
                  {t.workOrders.map((w) => (
                    <tr key={w.id} className="row-link">
                      <td><Link href={`/work-orders/${w.id}`} className="font-medium hover:text-accent">{woNumber(w.number)}</Link><div className="text-xs text-muted truncate max-w-[260px]">{w.complaint}</div></td>
                      <td className="text-sm">{vehicleName(w.vehicle)}</td>
                      <td className="text-xs text-muted">{w.customer.firstName} {w.customer.lastName}</td>
                      <td><Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-5 text-sm text-muted">No open jobs assigned.</p>}
          </Card>
          <Card title="Time entries" padded={false}>
            <table className="table">
              <thead><tr><th>Started</th><th>Ended</th><th>Work order</th><th className="text-right">Hours</th></tr></thead>
              <tbody>
                {t.timeEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs text-muted">{fmtDateTime(e.startedAt)}</td>
                    <td className="text-xs text-muted">{e.endedAt ? fmtTime(e.endedAt) : <Badge tone="green">running</Badge>}</td>
                    <td><Link href={`/work-orders/${e.workOrderId}`} className="hover:text-accent">{woNumber(e.workOrder.number)}</Link>{e.note ? <span className="text-xs text-muted"> · {e.note}</span> : null}</td>
                    <td className="text-right tabular-nums">{(differenceInMinutes(e.endedAt ?? now, e.startedAt) / 60).toFixed(2)}</td>
                  </tr>
                ))}
                {!t.timeEntries.length ? <tr><td colSpan={4} className="text-center text-muted py-6">No time logged yet.</td></tr> : null}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}
