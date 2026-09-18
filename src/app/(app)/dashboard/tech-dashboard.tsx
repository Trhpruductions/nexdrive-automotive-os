import Link from "next/link";
import { differenceInMinutes, endOfDay, startOfDay } from "date-fns";
import { CalendarClock, ClipboardCheck, Play, Square, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { Avatar, Badge, Card } from "@/components/ui";
import { WO_STATUS } from "@/lib/constants";
import { fmtTime, greeting, vehicleName, woNumber } from "@/lib/format";
import { clockFromDashboard, startJobFromDashboard } from "@/actions/technicians";
import { startInspection } from "@/actions/inspections";

/** What a technician sees on a phone or bay tablet: their jobs, their clock, their inspections. */
export async function TechDashboard({ technicianId, userName }: { technicianId: string; userName: string }) {
  const now = new Date();
  const [tech, jobs, appts, open, todayEntries] = await Promise.all([
    db.technician.findUnique({ where: { id: technicianId }, select: { name: true, color: true } }),
    db.workOrder.findMany({
      where: { technicianId, status: { in: ["APPROVED", "IN_PROGRESS", "ON_HOLD", "AWAITING_APPROVAL", "ESTIMATE"] } },
      include: { vehicle: true, customer: true, bay: true, inspection: { select: { id: true, items: { select: { result: true } } } }, lines: { where: { approved: true }, select: { kind: true, description: true } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    db.appointment.findMany({ where: { technicianId, scheduledStart: { gte: startOfDay(now), lte: endOfDay(now) }, status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] } }, include: { vehicle: true, customer: true, bay: true, workOrder: { select: { id: true } } }, orderBy: { scheduledStart: "asc" } }),
    db.timeEntry.findFirst({ where: { technicianId, endedAt: null }, include: { workOrder: { include: { vehicle: true } } } }),
    db.timeEntry.findMany({ where: { technicianId, startedAt: { gte: startOfDay(now) } } }),
  ]);
  const order: Record<string, number> = { IN_PROGRESS: 0, APPROVED: 1, ON_HOLD: 2, AWAITING_APPROVAL: 3, ESTIMATE: 4 };
  jobs.sort((a, b) => order[a.status] - order[b.status]);
  const minutesToday = todayEntries.reduce((s, e) => s + differenceInMinutes(e.endedAt ?? now, e.startedAt), 0);
  const needsInspection = jobs.filter((j) => !j.inspection || !j.inspection.items.length);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{greeting()}, {userName.split(" ")[0]}</h1>
          <p className="text-sm text-muted">{jobs.length} open job{jobs.length === 1 ? "" : "s"} · {(minutesToday / 60).toFixed(1)} h clocked today</p>
        </div>
        {tech ? <Avatar name={tech.name} color={tech.color} size={40} /> : null}
      </div>

      <Card className={open ? "border-accent" : ""}>
        {open ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="mt-1.5 h-3 w-3 rounded-full bg-accent animate-pulse shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold">On the clock — {woNumber(open.workOrder.number)}</div>
                <div className="text-sm truncate">{vehicleName(open.workOrder.vehicle)}</div>
                <div className="text-sm text-muted">since {fmtTime(open.startedAt)} · {differenceInMinutes(now, open.startedAt)} min</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
              <form action={clockFromDashboard.bind(null, technicianId, open.workOrderId)}><button className="btn btn-secondary w-full py-3 px-5"><Square size={16} /> Clock out</button></form>
              <Link href={`/work-orders/${open.workOrderId}`} className="btn btn-primary py-3 px-5 justify-center">Open job</Link>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">You&apos;re not clocked in. Tap <span className="text-text">Start</span> on a job below to begin.</div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2" title="My jobs" padded={false}>
          <ul className="divide-y divide-border">
            {jobs.map((j) => {
              const labor = j.lines.filter((l) => l.kind === "LABOR").map((l) => l.description).slice(0, 3);
              const isOpen = open?.workOrderId === j.id;
              return (
                <li key={j.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/work-orders/${j.id}`} className="font-semibold hover:text-accent">{woNumber(j.number)}</Link>
                      <Badge tone={WO_STATUS[j.status].tone}>{WO_STATUS[j.status].label}</Badge>
                      {j.bay ? <span className="text-xs text-muted">{j.bay.name}</span> : null}
                    </div>
                    <div className="text-sm mt-0.5">{vehicleName(j.vehicle)} <span className="text-muted">· {j.customer.firstName} {j.customer.lastName}</span></div>
                    <div className="text-sm text-muted truncate">{j.complaint}</div>
                    {labor.length ? <div className="text-xs text-faint mt-1 truncate">{labor.join(" · ")}</div> : null}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {j.status === "APPROVED" || j.status === "ON_HOLD" || (j.status === "IN_PROGRESS" && !isOpen) ? (
                      <form action={startJobFromDashboard.bind(null, j.id)}><button className="btn btn-primary py-3 px-4"><Play size={16} /> Start</button></form>
                    ) : null}
                    {isOpen ? <form action={clockFromDashboard.bind(null, technicianId, j.id)}><button className="btn btn-secondary py-3 px-4"><Square size={16} /> Stop</button></form> : null}
                    <Link href={`/work-orders/${j.id}`} className="btn btn-ghost py-3 px-4"><Wrench size={16} /> Open</Link>
                  </div>
                </li>
              );
            })}
            {!jobs.length ? <li className="p-8 text-center text-sm text-muted">No jobs assigned to you right now.</li> : null}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Today's appointments" padded={false}>
            <ul className="divide-y divide-border">
              {appts.map((a) => (
                <li key={a.id} className="px-4 py-3 flex gap-3">
                  <div className="w-16 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.scheduledStart)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{vehicleName(a.vehicle)}</div>
                    <div className="text-xs text-muted truncate">{a.customer.firstName} {a.customer.lastName} · {a.serviceRequested}{a.bay ? ` · ${a.bay.name}` : ""}</div>
                    {a.workOrder ? <Link href={`/work-orders/${a.workOrder.id}`} className="text-xs text-accent">Open work order</Link> : null}
                  </div>
                </li>
              ))}
              {!appts.length ? <li className="px-4 py-6 text-center text-sm text-muted flex items-center justify-center gap-2"><CalendarClock size={14} /> Nothing scheduled for you today.</li> : null}
            </ul>
          </Card>
          <Card title="Inspections to do" padded={false}>
            <ul className="divide-y divide-border">
              {needsInspection.map((j) => (
                <li key={j.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{woNumber(j.number)} · {vehicleName(j.vehicle)}</div>
                    <div className="text-xs text-muted">Multi-point inspection not started</div>
                  </div>
                  <form action={startInspection.bind(null, j.id)}><button className="btn btn-secondary btn-sm"><ClipboardCheck size={14} /> Start</button></form>
                </li>
              ))}
              {!needsInspection.length ? <li className="px-4 py-6 text-center text-sm text-muted">All your jobs have an inspection.</li> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
