import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, addWeeks, eachDayOfInterval, endOfDay, endOfWeek, format, isSameDay, isToday, parseISO, startOfDay, startOfWeek, subDays, subWeeks } from "date-fns";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, Flash, PageHeader } from "@/components/ui";
import { DayBoard } from "@/components/app/day-board";
import { APPT_STATUS } from "@/lib/constants";
import { fmtTime, vehicleName } from "@/lib/format";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const settings = await getSettings();
  const sp = await searchParams;
  const date = sp.date ? parseISO(sp.date) : new Date();
  const view = sp.view === "week" ? "week" : "day";
  const rangeStart = view === "week" ? startOfWeek(date, { weekStartsOn: 1 }) : startOfDay(date);
  const rangeEnd = view === "week" ? endOfWeek(date, { weekStartsOn: 1 }) : endOfDay(date);

  const [appointments, bays, techs] = await Promise.all([
    db.appointment.findMany({ where: { scheduledStart: { gte: rangeStart, lte: rangeEnd } }, include: { vehicle: true, customer: true, bay: true, technician: true, workOrder: { select: { id: true, number: true } } }, orderBy: { scheduledStart: "asc" } }),
    db.bay.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const d = (x: Date) => format(x, "yyyy-MM-dd");
  const prev = view === "week" ? subWeeks(date, 1) : subDays(date, 1);
  const next = view === "week" ? addWeeks(date, 1) : addDays(date, 1);
  // plain objects only across the client boundary (Decimal fields on technician are not serialisable)
  const dayAppts = appointments
    .filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status))
    .map((a) => ({
      id: a.id, scheduledStart: a.scheduledStart, scheduledEnd: a.scheduledEnd, status: a.status, serviceRequested: a.serviceRequested,
      bay: a.bay ? { id: a.bay.id, name: a.bay.name } : null,
      vehicle: { year: a.vehicle.year, make: a.vehicle.make, model: a.vehicle.model, trim: a.vehicle.trim },
      customer: { firstName: a.customer.firstName, lastName: a.customer.lastName },
      technician: a.technician ? { name: a.technician.name, color: a.technician.color } : null,
    }));

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={view === "week" ? `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}` : format(date, "EEEE, MMMM d, yyyy")}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <Link href={`/schedule?view=${view}&date=${d(prev)}`} className="px-2.5 py-2 hover:bg-card-hover" aria-label="Previous"><ChevronLeft size={16} /></Link>
              <Link href={`/schedule?view=${view}`} className="px-3 py-2 text-sm border-x border-border hover:bg-card-hover">Today</Link>
              <Link href={`/schedule?view=${view}&date=${d(next)}`} className="px-2.5 py-2 hover:bg-card-hover" aria-label="Next"><ChevronRight size={16} /></Link>
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <Link href={`/schedule?view=day&date=${d(date)}`} className={`px-3 py-2 ${view === "day" ? "bg-accent text-white" : "hover:bg-card-hover"}`}>Day</Link>
              <Link href={`/schedule?view=week&date=${d(date)}`} className={`px-3 py-2 ${view === "week" ? "bg-accent text-white" : "hover:bg-card-hover"}`}>Week</Link>
            </div>
            <Link href={`/schedule/new?date=${d(date)}`} className="btn btn-primary"><Plus size={16} /> Book</Link>
          </>
        }
      />
      <Flash searchParams={sp} />

      {view === "day" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Card className="xl:col-span-2" title="Bays">
            <DayBoard appointments={dayAppts} bays={bays.map((b) => ({ id: b.id, name: b.name }))} open={settings.openTime} close={settings.closeTime} dateKey={d(date)} />
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted">
              {(["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${s === "SCHEDULED" ? "bg-slate-500" : s === "CONFIRMED" ? "bg-accent/80" : s === "CHECKED_IN" ? "bg-violet-600" : s === "IN_PROGRESS" ? "bg-accent" : "bg-emerald-700"}`} />{APPT_STATUS[s].label}</span>
              ))}
            </div>
          </Card>
          <Card title={`${appointments.length} appointment${appointments.length === 1 ? "" : "s"}`} padded={false}>
            <ul className="divide-y divide-border">
              {appointments.map((a) => (
                <li key={a.id}>
                  <Link href={`/schedule/${a.id}`} className="flex gap-3 px-5 py-3 hover:bg-card-hover">
                    <div className="w-16 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.scheduledStart)}<div className="text-[10px] text-faint font-normal">{fmtTime(a.scheduledEnd)}</div></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{vehicleName(a.vehicle)}</div>
                      <div className="text-xs text-muted truncate">{a.customer.firstName} {a.customer.lastName} · {a.serviceRequested}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                        <Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge>
                        {a.bay ? <span>{a.bay.name}</span> : null}
                        {a.technician ? <span className="flex items-center gap-1"><Avatar name={a.technician.name} color={a.technician.color} size={16} />{a.technician.name.split(" ")[0]}</span> : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
              {!appointments.length ? <li className="px-5 py-8 text-sm text-muted text-center">Nothing booked. <Link href={`/schedule/new?date=${d(date)}`} className="text-accent">Book an appointment</Link>.</li> : null}
            </ul>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((day) => {
            const items = appointments.filter((a) => isSameDay(a.scheduledStart, day));
            return (
              <div key={day.toISOString()} className={`card p-2 min-h-[180px] ${isToday(day) ? "border-accent/50" : ""}`}>
                <Link href={`/schedule?view=day&date=${d(day)}`} className="flex items-baseline justify-between px-1 mb-2 hover:text-accent">
                  <span className="text-xs text-muted">{format(day, "EEE")}</span>
                  <span className={`text-sm font-semibold ${isToday(day) ? "text-accent" : ""}`}>{format(day, "d")}</span>
                </Link>
                <ul className="space-y-1">
                  {items.map((a) => (
                    <li key={a.id}>
                      <Link href={`/schedule/${a.id}`} className={`block rounded-md px-1.5 py-1 text-[11px] leading-tight border-l-2 bg-bg-elevated hover:bg-card-hover ${a.status === "CANCELLED" || a.status === "NO_SHOW" ? "opacity-40 line-through" : ""}`} style={{ borderColor: a.technician?.color ?? "var(--accent)" }}>
                        <div className="font-semibold">{fmtTime(a.scheduledStart)}</div>
                        <div className="truncate">{a.vehicle.year} {a.vehicle.make} {a.vehicle.model}</div>
                        <div className="truncate text-muted">{a.serviceRequested}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        <span className="font-semibold">Technicians:</span>
        {techs.map((t) => <span key={t.id} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}</span>)}
      </div>
    </div>
  );
}
