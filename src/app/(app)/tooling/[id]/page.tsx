import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2, Wrench } from "lucide-react";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Flash, PageHeader, Progress, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteDie, serviceDie } from "@/actions/production";
import { fmtDate, num } from "@/lib/format";
import { jobNumber } from "@/lib/production";
import { DieForm } from "../die-form";

export default async function DiePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const [d, presses] = await Promise.all([
    db.die.findUnique({ where: { id }, include: { machine: { select: { id: true, code: true, name: true, status: true } }, products: { select: { id: true, sku: true, name: true } }, jobs: { orderBy: { createdAt: "desc" }, take: 8, include: { part: { select: { name: true } } } }, runs: { orderBy: { startedAt: "desc" }, take: 10, include: { machine: { select: { code: true } } } } } }),
    db.machine.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  if (!d) notFound();
  const since = d.hitCount - d.hitsAtService;
  const frac = d.serviceIntervalHits ? Math.min(1, since / d.serviceIntervalHits) : null;
  const due = frac != null && frac >= 1;
  const manager = can(user, MANAGER_ROLES);
  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3">{d.code} <Badge tone={due ? "red" : d.status === "ACTIVE" ? "green" : d.status === "MAINTENANCE" ? "amber" : "slate"}>{due ? "service due" : d.status.toLowerCase()}</Badge></span>}
        subtitle={<>{d.name}{d.machine ? <> · in <Link href={`/production/${d.machine.id}`} className="text-accent hover:underline">{d.machine.code}</Link></> : d.location ? ` · ${d.location}` : ""}</>}
        crumbs={[{ label: "Tooling", href: "/tooling" }, { label: d.code }]}
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Stat label="Total hits" value={num(d.hitCount)} />
        <Stat label="Since last service" value={num(since)} sub={d.serviceIntervalHits ? `of ${num(d.serviceIntervalHits)}` : "no interval set"} />
        <Stat label="Makes" value={d.products.length} sub={d.products.map((p) => p.sku).join(", ") || "no products linked"} />
        <Stat label="Jobs run" value={d.jobs.length} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Service" action={frac != null ? <span className="text-xs text-muted">{Math.round(frac * 100)}% of interval</span> : null}>
            {frac != null ? <Progress value={frac} tone={frac >= 1 ? "red" : frac >= 0.85 ? "amber" : "green"} className="mb-4" /> : null}
            <form action={serviceDie.bind(null, d.id)} className="flex flex-col sm:flex-row gap-2">
              <input name="note" className="input" placeholder="Sharpened punches, replaced pilot pins…" />
              <button className="btn btn-primary shrink-0"><Wrench size={14} /> Record service (resets counter)</button>
            </form>
            <p className="text-xs text-faint mt-2">Hit counts come from press counts while a job using this die is running (or from manual counts on the job).</p>
          </Card>
          <Card title="Recent runs" padded={false}>
            <table className="table">
              <thead><tr><th>Started</th><th>Job</th><th>Press</th><th>Shift</th><th className="text-right">Good</th><th className="text-right">Scrap</th></tr></thead>
              <tbody>
                {d.runs.map((r) => { const j = d.jobs.find((x) => x.id === r.jobId); return <tr key={r.id}><td className="text-xs">{fmtDate(r.startedAt)}</td><td className="text-xs">{j ? <Link href={`/jobs/${j.id}`} className="hover:text-accent">{jobNumber(j.number)}</Link> : "—"}</td><td className="text-xs text-muted">{r.machine.code}</td><td className="text-xs text-muted">{r.shift ?? "—"}</td><td className="text-right tabular-nums">{num(r.good)}</td><td className="text-right tabular-nums text-muted">{r.scrap}</td></tr>; })}
                {!d.runs.length ? <tr><td colSpan={6} className="text-center text-muted py-6">No runs yet.</td></tr> : null}
              </tbody>
            </table>
          </Card>
          {d.notes && !manager ? <Card title="Notes"><pre className="text-sm text-muted whitespace-pre-wrap font-sans">{d.notes}</pre></Card> : null}
        </div>
        <div className="space-y-4">
          {manager ? (
            <Card title="Die details">
              <DieForm values={{ id: d.id, code: d.code, name: d.name, location: d.location, machineId: d.machineId, serviceIntervalHits: d.serviceIntervalHits, status: d.status, notes: d.notes }} presses={presses} />
              <form action={deleteDie.bind(null, d.id)} className="mt-3 text-right"><ConfirmButton message="Remove this die? Jobs keep their history." className="btn btn-ghost btn-sm text-red-400"><Trash2 size={13} /> Remove</ConfirmButton></form>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
