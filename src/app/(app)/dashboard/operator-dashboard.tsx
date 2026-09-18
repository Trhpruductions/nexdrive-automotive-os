import Link from "next/link";
import { differenceInMinutes } from "date-fns";
import { Factory, Pause, Play, Save } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Card, Field, Progress } from "@/components/ui";
import { addCounts, pauseJob, startJob } from "@/actions/production";
import { greeting, num } from "@/lib/format";
import { jobNumber } from "@/lib/production";

/**
 * Press station: what an operator sees on the tablet at the press — every press
 * with its running job, big counters, and start / pause / count / reason.
 */
export async function OperatorDashboard({ userName }: { userName: string }) {
  const now = new Date();
  const [presses, queue] = await Promise.all([
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, include: { jobs: { where: { status: { in: ["RUNNING", "PAUSED"] } }, include: { part: { select: { sku: true, name: true, stdRatePerHour: true } }, die: { select: { code: true } }, runs: { where: { endedAt: null }, take: 1 } }, orderBy: { status: "asc" }, take: 1 } } }),
    db.productionJob.findMany({ where: { status: "RELEASED" }, include: { part: { select: { sku: true } }, machine: { select: { code: true } } }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 6 }),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{greeting()}, {userName.split(" ")[0]}</h1>
        <p className="text-sm text-muted">Press station — counts from the PLC land here on their own; use the buttons for anything the press doesn&apos;t report.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {presses.map((p) => {
          const j = p.jobs[0];
          const run = j?.runs[0];
          const pct = j?.quantity ? Math.min(1, j.good / j.quantity) : 0;
          const scrapPct = j && j.good + j.scrap ? (j.scrap / (j.good + j.scrap)) * 100 : 0;
          const runMin = run ? differenceInMinutes(now, run.startedAt) : 0;
          const rate = run && runMin > 0 ? Math.round(((run.good + run.scrap) / runMin) * 60) : null;
          return (
            <Card key={p.id} className={p.status === "RUNNING" ? "border-emerald-500/40" : p.status === "DOWN" ? "border-red-500/40" : ""}>
              <div className="flex items-center justify-between gap-2">
                <div><span className="text-lg font-semibold">{p.code}</span><span className="text-sm text-muted"> · {p.name}</span></div>
                <Badge tone={p.status === "RUNNING" ? "green" : p.status === "DOWN" ? "red" : p.status === "MAINTENANCE" ? "amber" : "slate"}>{p.status.toLowerCase()}</Badge>
              </div>
              {j ? (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/jobs/${j.id}`} className="font-semibold hover:text-accent">{jobNumber(j.number)} <span className="font-normal text-muted">· {j.part.sku}{j.die ? ` · ${j.die.code}` : ""}</span></Link>
                    <span className="text-xs text-muted">{j.part.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="rounded-lg bg-bg-elevated p-3"><div className="text-3xl font-semibold tabular-nums">{num(j.good)}</div><div className="text-[11px] text-muted">of {num(j.quantity)} good</div></div>
                    <div className="rounded-lg bg-bg-elevated p-3"><div className={`text-3xl font-semibold tabular-nums ${scrapPct > 3 ? "text-amber-400" : ""}`}>{num(j.scrap)}</div><div className="text-[11px] text-muted">scrap · {scrapPct.toFixed(1)}%</div></div>
                    <div className="rounded-lg bg-bg-elevated p-3"><div className="text-3xl font-semibold tabular-nums">{rate ?? "—"}</div><div className="text-[11px] text-muted">pcs/h{j.part.stdRatePerHour ? ` · std ${num(j.part.stdRatePerHour)}` : ""}</div></div>
                  </div>
                  <Progress value={pct} tone={pct >= 1 ? "green" : "blue"} className="mt-3" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {j.status === "RUNNING" ? (
                      <form action={pauseJob.bind(null, j.id)} className="flex gap-2 flex-1 min-w-[260px]">
                        <select name="reason" className="select py-3" defaultValue="">
                          <option value="">Pause — reason…</option>
                          {["Die change", "Coil change", "Break", "Quality hold", "Press fault", "Waiting material", "End of shift"].map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button className="btn btn-secondary py-3 px-4 shrink-0"><Pause size={16} /> Pause</button>
                      </form>
                    ) : (
                      <form action={startJob.bind(null, j.id)}><input type="hidden" name="machineId" value={p.id} /><button className="btn btn-primary py-3 px-5"><Play size={16} /> Resume</button></form>
                    )}
                  </div>
                  <form action={addCounts.bind(null, j.id)} className="mt-3 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <Field label="Good"><input name="good" type="number" min={0} defaultValue={0} className="input py-3" /></Field>
                    <Field label="Scrap"><input name="scrap" type="number" min={0} defaultValue={0} className="input py-3" /></Field>
                    <Field label="Downtime min"><input name="downtime" type="number" min={0} defaultValue={0} className="input py-3" /></Field>
                    <button className="btn btn-secondary py-3"><Save size={15} /> Add</button>
                    <input type="hidden" name="reason" value="" />
                  </form>
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted">
                  No job on this press.{" "}
                  {queue.length ? <span>Next up: <Link href={`/jobs/${queue[0].id}`} className="text-accent">{jobNumber(queue[0].number)} · {queue[0].part.sku}</Link></span> : <Link href="/jobs" className="text-accent">See jobs</Link>}
                </div>
              )}
            </Card>
          );
        })}
        {!presses.length ? <Card><p className="text-sm text-muted flex items-center gap-2"><Factory size={14} /> No presses set up yet.</p></Card> : null}
      </div>
      {queue.length ? (
        <Card title="Released — waiting for a press" padded={false}>
          <ul className="divide-y divide-border">
            {queue.map((q) => (
              <li key={q.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 text-sm"><Link href={`/jobs/${q.id}`} className="font-semibold hover:text-accent">{jobNumber(q.number)}</Link> <span className="text-muted">· {q.part.sku} · {num(q.quantity)} pcs{q.machine ? ` · ${q.machine.code}` : ""}</span></div>
                <form action={startJob.bind(null, q.id)} className="flex gap-2">
                  <select name="machineId" defaultValue={q.machineId ?? ""} className="select py-2 w-36"><option value="">Press…</option>{presses.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select>
                  <button className="btn btn-primary btn-sm"><Play size={14} /> Start</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
