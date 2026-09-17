import Link from "next/link";
import { shopMinutes } from "@/lib/dashboard";
import { vehicleName, customerName, laneLayout } from "@/lib/format";

type Appt = {
  id: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: string;
  serviceRequested: string;
  bay: { id: string; name: string } | null;
  vehicle: { year: number; make: string; model: string; trim?: string | null };
  customer: { firstName: string; lastName: string };
  technician: { name: string; color: string } | null;
};

const STATUS_BG: Record<string, string> = {
  SCHEDULED: "bg-slate-600/70 border-slate-400/40",
  CONFIRMED: "bg-accent/80 border-blue-300/40",
  CHECKED_IN: "bg-violet-600/80 border-violet-300/40",
  IN_PROGRESS: "bg-accent border-blue-200/50",
  COMPLETED: "bg-emerald-700/80 border-emerald-300/40",
};

/** Bay × time grid for one day (the "Schedule Overview" panel and the day view). */
export function BayTimeline({
  appointments,
  bays,
  open,
  close,
  compact = false,
}: {
  appointments: Appt[];
  bays: { id: string; name: string }[];
  open: string;
  close: string;
  compact?: boolean;
}) {
  const [oh, om] = open.split(":").map(Number);
  const startMin = oh * 60 + om;
  const total = shopMinutes(open, close);
  const hours: number[] = [];
  for (let m = startMin; m <= startMin + total; m += 60) hours.push(m);
  const pos = (d: Date) => Math.min(1, Math.max(0, (d.getHours() * 60 + d.getMinutes() - startMin) / total));

  const rows = [...bays.map((b) => ({ id: b.id, name: b.name })), { id: "__none", name: "Unassigned" }].filter(
    (r) => r.id !== "__none" || appointments.some((a) => !a.bay),
  );
  const rowH = compact ? 34 : 52;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}>
          <div />
          <div className="relative h-5 text-[10px] text-muted">
            {hours.map((m) => (
              <span key={m} className="absolute -translate-x-1/2" style={{ left: `${((m - startMin) / total) * 100}%` }}>
                {fmtHour(m)}
              </span>
            ))}
          </div>
        </div>
        {rows.map((row) => {
          const { placed, lanes } = laneLayout(appointments.filter((a) => (row.id === "__none" ? !a.bay : a.bay?.id === row.id)));
          return (
            <div key={row.id} className="grid items-center border-t border-border" style={{ gridTemplateColumns: "64px 1fr", height: rowH + 8 }}>
              <div className="text-xs text-muted pr-2">{row.name}</div>
              <div className="relative h-full">
                {hours.map((m) => (
                  <span key={m} className="absolute top-0 bottom-0 border-l border-border/70" style={{ left: `${((m - startMin) / total) * 100}%` }} />
                ))}
                {placed.map(({ item: a, lane }) => {
                  const l = pos(a.scheduledStart) * 100;
                  const r = pos(a.scheduledEnd) * 100;
                  const laneStyle = lanes > 1 ? { top: `calc(${(lane / lanes) * 100}% + 2px)`, height: `calc(${100 / lanes}% - 4px)` } : { top: 4, bottom: 4 };
                  return (
                    <Link
                      key={a.id}
                      href={`/schedule/${a.id}`}
                      title={`${a.serviceRequested} · ${customerName(a.customer)}`}
                      className={`absolute rounded-md border px-2 py-0.5 text-white overflow-hidden text-[11px] leading-tight hover:brightness-110 ${STATUS_BG[a.status] ?? STATUS_BG.SCHEDULED}`}
                      style={{ ...laneStyle, left: `${l}%`, width: `${Math.max(3, r - l)}%` }}
                    >
                      <div className="font-semibold truncate">{vehicleName(a.vehicle)}</div>
                      {!compact && lanes === 1 ? <div className="truncate opacity-90">{a.customer.firstName} {a.customer.lastName}</div> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtHour(m: number) {
  const h = Math.floor(m / 60);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1} ${suffix}`;
}
