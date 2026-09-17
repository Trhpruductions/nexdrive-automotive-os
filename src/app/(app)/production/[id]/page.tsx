import Link from "next/link";
import { notFound } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { differenceInMinutes, startOfDay, subDays, subHours } from "date-fns";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { BarChart } from "@/components/app/revenue-chart";
import { deleteMachine, saveMachine, setMachineStatus } from "@/actions/integrations";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import type { MachineStatus } from "@/generated/prisma/enums";

const TONE: Record<MachineStatus, "green" | "amber" | "red" | "violet" | "slate"> = { RUNNING: "green", IDLE: "amber", DOWN: "red", MAINTENANCE: "violet", OFFLINE: "slate" };

export default async function MachinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const [m, lines] = await Promise.all([
    db.machine.findUnique({ where: { id }, include: { line: true, integration: { select: { name: true, type: true } }, events: { orderBy: { occurredAt: "desc" }, take: 60 } } }),
    db.productionLine.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!m) notFound();

  // hourly counts for the last 24h
  const since = subHours(now, 23);
  const counts = await db.machineEvent.findMany({ where: { machineId: id, type: "COUNT", occurredAt: { gte: since } }, select: { count: true, occurredAt: true } });
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(since.getTime() + i * 3_600_000);
    h.setMinutes(0, 0, 0);
    return { label: `${h.getHours()}h`, value: 0, start: h.getTime() };
  });
  for (const c of counts) {
    const idx = hourly.findIndex((b, i) => c.occurredAt.getTime() >= b.start && (i === hourly.length - 1 || c.occurredAt.getTime() < hourly[i + 1].start));
    if (idx >= 0) hourly[idx].value += c.count ?? 0;
  }
  // status durations over the last 7 days (from STATUS events)
  const statusEvents = await db.machineEvent.findMany({ where: { machineId: id, type: "STATUS", occurredAt: { gte: subDays(now, 7) } }, orderBy: { occurredAt: "asc" } });
  const durations: Record<string, number> = {};
  for (let i = 0; i < statusEvents.length; i++) {
    const s = statusEvents[i].status ?? "OFFLINE";
    const end = statusEvents[i + 1]?.occurredAt ?? now;
    durations[s] = (durations[s] ?? 0) + differenceInMinutes(end, statusEvents[i].occurredAt);
  }
  const totalMin = Object.values(durations).reduce((a, b) => a + b, 0) || 1;
  const today = await db.machineEvent.aggregate({ _sum: { count: true, scrap: true }, where: { machineId: id, type: "COUNT", occurredAt: { gte: startOfDay(now) } } });
  const manager = can(user, MANAGER_ROLES);
  const metrics = m.metrics as Record<string, { value: number; unit: string | null; at: string }>;

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{m.name} <Badge tone={TONE[m.status]}>{m.status.toLowerCase()}</Badge></span>}
        subtitle={<><span className="font-mono">{m.code}</span>{m.type ? ` · ${m.type}` : ""}{m.line ? ` · ${m.line.name}` : ""}{m.integration ? ` · fed by ${m.integration.name}` : " · manual"}</>}
        crumbs={[{ label: "Production", href: "/production" }, { label: m.name }]}
        actions={
          <div className="flex flex-wrap gap-1">
            {(["RUNNING", "IDLE", "DOWN", "MAINTENANCE", "OFFLINE"] as MachineStatus[]).filter((s) => s !== m.status).map((s) => (
              <form key={s} action={setMachineStatus.bind(null, m.id, s)}><button className="btn btn-secondary btn-sm">Set {s.toLowerCase()}</button></form>
            ))}
          </div>
        }
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card title="Now">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Produced today" value={(today._sum.count ?? 0).toLocaleString()} />
              <Stat label="Scrap today" value={today._sum.scrap ?? 0} />
              <Stat label="Last heartbeat" value={m.lastHeartbeatAt ? fmtRelative(m.lastHeartbeatAt) : "never"} />
              <Stat label="In this state" value={m.lastStatusChangeAt ? fmtRelative(m.lastStatusChangeAt) : "—"} />
            </div>
            {Object.keys(metrics).length ? (
              <ul className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
                {Object.entries(metrics).map(([k, v]) => <li key={k} className="flex justify-between"><span className="text-muted">{k.replace(/_/g, " ")}</span><span className="tabular-nums">{Math.round(v.value * 100) / 100}{v.unit ? ` ${v.unit}` : ""} <span className="text-[10px] text-faint">{fmtRelative(v.at)}</span></span></li>)}
              </ul>
            ) : null}
          </Card>
          <Card title="Availability (7 days)">
            {Object.keys(durations).length ? (
              <>
                <div className="flex h-3 rounded-full overflow-hidden mb-3">
                  {(["RUNNING", "IDLE", "DOWN", "MAINTENANCE", "OFFLINE"] as const).map((s) => durations[s] ? <div key={s} title={s} className={`${s === "RUNNING" ? "bg-emerald-500" : s === "IDLE" ? "bg-amber-400" : s === "DOWN" ? "bg-red-500" : s === "MAINTENANCE" ? "bg-violet-500" : "bg-slate-600"}`} style={{ width: `${(durations[s] / totalMin) * 100}%` }} /> : null)}
                </div>
                <ul className="text-xs text-muted grid grid-cols-2 gap-1">
                  {Object.entries(durations).map(([s, mins]) => <li key={s} className="flex justify-between"><span>{s.toLowerCase()}</span><span className="tabular-nums">{Math.round((mins / totalMin) * 100)}% · {(mins / 60).toFixed(1)}h</span></li>)}
                </ul>
              </>
            ) : <p className="text-sm text-muted">No status history yet.</p>}
          </Card>
          {manager ? (
            <Card title="Machine settings">
              <form action={saveMachine} className="space-y-3">
                <input type="hidden" name="id" value={m.id} />
                <label className="block"><span className="label">Code</span><input name="code" defaultValue={m.code} required className="input font-mono uppercase" /></label>
                <label className="block"><span className="label">Name</span><input name="name" defaultValue={m.name} className="input" /></label>
                <label className="block"><span className="label">Type</span><input name="type" defaultValue={m.type ?? ""} className="input" /></label>
                <label className="block"><span className="label">Line</span><select name="lineId" defaultValue={m.lineId ?? ""} className="select"><option value="">Unassigned</option>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
                <label className="block"><span className="label">Notes</span><textarea name="notes" rows={2} defaultValue={m.notes ?? ""} className="textarea" /></label>
                <label className="block"><span className="label">Active</span><select name="active" defaultValue={m.active ? "true" : "false"} className="select"><option value="true">Active (shown on floor)</option><option value="false">Hidden</option></select></label>
                <button className="btn btn-primary w-full"><Save size={14} /> Save</button>
              </form>
              <form action={deleteMachine.bind(null, m.id)} className="mt-3 text-right"><ConfirmButton message="Delete this machine and its history?" className="btn btn-ghost btn-sm text-red-400"><Trash2 size={13} /> Delete machine</ConfirmButton></form>
            </Card>
          ) : null}
        </div>
        <div className="xl:col-span-2 space-y-4">
          <Card title="Output per hour (24h)"><BarChart series={hourly} height={200} /></Card>
          <Card title="Event history" padded={false}>
            <table className="table">
              <thead><tr><th>When</th><th>Type</th><th>Detail</th></tr></thead>
              <tbody>
                {m.events.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs text-muted whitespace-nowrap">{fmtDateTime(e.occurredAt)}</td>
                    <td><Badge tone={e.type === "ALARM" ? "red" : e.type === "STATUS" ? TONE[e.status ?? "OFFLINE"] : e.type === "COUNT" ? "blue" : "slate"}>{e.type.toLowerCase()}</Badge></td>
                    <td className="text-sm">{e.type === "STATUS" ? `${e.status?.toLowerCase()}${e.message ? ` — ${e.message}` : ""}` : e.type === "COUNT" ? `+${e.count} (good ${e.good ?? e.count}, scrap ${e.scrap ?? 0})` : e.type === "READING" ? `${e.metric} = ${e.value}${e.unit ? ` ${e.unit}` : ""}` : `${e.code ? `[${e.code}] ` : ""}${e.message}`}</td>
                  </tr>
                ))}
                {!m.events.length ? <tr><td colSpan={3} className="text-center text-muted py-6">No events yet.</td></tr> : null}
              </tbody>
            </table>
          </Card>
          <p className="text-xs text-faint"><Link href="/settings?tab=integrations" className="text-accent hover:underline">Feeds</Link> deliver data here. A machine that stops reporting for 5 minutes is marked offline automatically.</p>
        </div>
      </div>
    </div>
  );
}
