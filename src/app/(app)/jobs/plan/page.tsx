import Link from "next/link";
import { addHours, format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, num } from "@/lib/format";
import { jobNumber, shiftsFor } from "@/lib/production";

export const metadata = { title: "Press plan" };

/**
 * Where every open job lands: queued per press in priority order, hours from
 * remaining pieces ÷ standard rate, projected finish against the due date.
 */
export default async function PressPlanPage() {
  await requireStaff();
  const [presses, jobs, shifts] = await Promise.all([
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, status: true } }),
    db.productionJob.findMany({ where: { status: { in: ["RUNNING", "PAUSED", "RELEASED", "PLANNED"] } }, include: { part: { select: { sku: true, stdRatePerHour: true, pressId: true } }, customer: { select: { company: true, firstName: true, lastName: true } }, die: { select: { code: true } } }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }] }),
    shiftsFor(),
  ]);
  const hoursPerDay = shifts.reduce((s, sh) => { const [a, b] = [sh.start, sh.end].map((t) => { const [h, m] = t.split(":").map(Number); return h + m / 60; }); return s + (b >= a ? b - a : 24 - a + b); }, 0) || 8;
  // queue per press: running first, then by priority; hours = remaining / rate (default 500/h when unknown)
  const now = new Date();
  const lanes = presses.map((p) => {
    const mine = jobs.filter((j) => (j.machineId ?? j.part.pressId) === p.id).sort((a, b) => (a.status === "RUNNING" ? -1 : b.status === "RUNNING" ? 1 : 0) || b.priority - a.priority || (a.dueAt?.getTime() ?? 9e15) - (b.dueAt?.getTime() ?? 9e15));
    let cursor = now;
    const rows = mine.map((j) => {
      const remaining = Math.max(0, j.quantity - j.good);
      const rate = j.part.stdRatePerHour ?? 500;
      const hours = remaining / rate;
      // stretch run-hours over shift hours per calendar day
      const calendarHours = (hours / hoursPerDay) * 24;
      const finish = addHours(cursor, calendarHours);
      cursor = finish;
      const late = j.dueAt ? finish > j.dueAt : false;
      return { j, remaining, hours, finish, late };
    });
    return { p, rows, load: rows.reduce((s, r) => s + r.hours, 0) };
  });
  const unassigned = jobs.filter((j) => !(j.machineId ?? j.part.pressId));
  const atRisk = lanes.flatMap((l) => l.rows).filter((r) => r.late).length;
  return (
    <div>
      <PageHeader title="Press plan" subtitle={`Projected from remaining pieces ÷ standard rate over ${hoursPerDay} shift-hours a day. Reorder with job priority.`} crumbs={[{ label: "Jobs", href: "/jobs" }, { label: "Plan" }]} actions={atRisk ? <Badge tone="red">{atRisk} job{atRisk === 1 ? "" : "s"} at risk</Badge> : <Badge tone="green">on track</Badge>} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {lanes.map(({ p, rows, load }) => (
          <Card key={p.id} title={`${p.code} · ${p.name}`} action={<span className="text-xs text-muted">{load.toFixed(1)} h queued · <Badge tone={p.status === "RUNNING" ? "green" : p.status === "DOWN" ? "red" : "slate"}>{p.status.toLowerCase()}</Badge></span>} padded={false}>
            <table className="table">
              <thead><tr><th>Job</th><th className="text-right">Left</th><th className="text-right">Hours</th><th>Projected finish</th><th>Due</th></tr></thead>
              <tbody>
                {rows.map(({ j, remaining, hours, finish, late }) => (
                  <tr key={j.id}>
                    <td><Link href={`/jobs/${j.id}`} className="font-medium hover:text-accent">{jobNumber(j.number)}</Link><div className="text-xs text-muted">{j.part.sku} · {j.customer.company ?? `${j.customer.firstName} ${j.customer.lastName}`}{j.die ? ` · ${j.die.code}` : ""} {j.status === "RUNNING" ? <Badge tone="green">running</Badge> : j.status === "PAUSED" ? <Badge tone="amber">paused</Badge> : null}</div></td>
                    <td className="text-right tabular-nums">{num(remaining)}</td>
                    <td className="text-right tabular-nums text-muted">{hours.toFixed(1)}</td>
                    <td className={`text-xs ${late ? "text-red-400 font-semibold" : "text-muted"}`}>{format(finish, "EEE MMM d, h:mm a")}</td>
                    <td className={`text-xs ${late ? "text-red-400" : "text-muted"}`}>{fmtDate(j.dueAt)}</td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={5} className="text-center text-muted py-6">Nothing queued.</td></tr> : null}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
      {unassigned.length ? (
        <Card className="mt-4" title="No press assigned" action={<span className="text-xs text-muted"><CalendarClock size={12} className="inline" /> set a press on the job or a default press on the product</span>} padded={false}>
          <ul className="divide-y divide-border">{unassigned.map((j) => <li key={j.id} className="px-5 py-2.5 text-sm"><Link href={`/jobs/${j.id}`} className="font-medium hover:text-accent">{jobNumber(j.number)}</Link> <span className="text-muted">· {j.part.sku} · {num(j.quantity - j.good)} left{j.dueAt ? ` · due ${fmtDate(j.dueAt)}` : ""}</span></li>)}</ul>
        </Card>
      ) : null}
    </div>
  );
}
