import Link from "next/link";
import { CalendarClock, Factory, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, KpiCard, PageHeader, Progress } from "@/components/ui";
import { fmtDate, num } from "@/lib/format";
import { jobNumber } from "@/lib/production";
import type { JobStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Jobs" };

const STATUS: Record<JobStatus, { label: string; tone: "slate" | "blue" | "green" | "amber" | "red" | "violet" }> = {
  PLANNED: { label: "Planned", tone: "slate" }, RELEASED: { label: "Released", tone: "blue" }, RUNNING: { label: "Running", tone: "green" }, PAUSED: { label: "Paused", tone: "amber" }, COMPLETE: { label: "Complete", tone: "violet" }, CANCELLED: { label: "Cancelled", tone: "red" },
};

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const filter = sp.status ?? "open";
  const where = filter === "open" ? { status: { in: ["PLANNED", "RELEASED", "RUNNING", "PAUSED"] as JobStatus[] } } : filter === "all" ? {} : { status: filter as JobStatus };
  const [jobs, presses, counts] = await Promise.all([
    db.productionJob.findMany({ where, include: { part: { select: { name: true, sku: true, customerPartNumber: true, stdRatePerHour: true } }, customer: { select: { firstName: true, lastName: true, company: true } }, machine: { select: { code: true, name: true, status: true } }, die: { select: { code: true } } }, orderBy: [{ status: "asc" }, { priority: "desc" }, { dueAt: "asc" }], take: 200 }),
    db.machine.findMany({ where: { active: true }, include: { jobs: { where: { status: "RUNNING" }, include: { part: { select: { name: true } } }, take: 1 } }, orderBy: { code: "asc" } }),
    db.productionJob.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const c = (s: JobStatus) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const late = jobs.filter((j) => j.dueAt && j.dueAt < new Date() && !["COMPLETE", "CANCELLED"].includes(j.status)).length;
  const order: JobStatus[] = ["RUNNING", "PAUSED", "RELEASED", "PLANNED", "COMPLETE", "CANCELLED"];
  jobs.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.priority - a.priority || (a.dueAt?.getTime() ?? 9e15) - (b.dueAt?.getTime() ?? 9e15));

  return (
    <div>
      <PageHeader title="Jobs" subtitle="Production orders — what to make, on which press, by when." actions={<><Link href="/jobs/plan" className="btn btn-secondary"><CalendarClock size={16} /> Press plan</Link><Link href="/jobs/new" className="btn btn-primary"><Plus size={16} /> New job</Link></>} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Running" value={c("RUNNING")} icon={Factory} tone="green" href="/jobs?status=RUNNING" />
        <KpiCard label="Released / planned" value={c("RELEASED") + c("PLANNED")} icon={Factory} tone="blue" href="/jobs?status=RELEASED" />
        <KpiCard label="Late" value={late} icon={Factory} tone={late ? "red" : "slate"} />
        <KpiCard label="Complete" value={c("COMPLETE")} icon={Factory} tone="violet" href="/jobs?status=COMPLETE" />
      </div>

      <Card title="Presses" className="mb-4">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {presses.map((p) => {
            const j = p.jobs[0];
            return (
              <Link key={p.id} href={`/production/${p.id}`} className="rounded-lg border border-border bg-bg-elevated p-3 hover:border-border-strong">
                <div className="flex items-center justify-between"><span className="font-semibold">{p.code}</span><Badge tone={p.status === "RUNNING" ? "green" : p.status === "DOWN" ? "red" : p.status === "MAINTENANCE" ? "amber" : "slate"}>{p.status.toLowerCase()}</Badge></div>
                <div className="text-xs text-muted truncate">{p.name}</div>
                <div className="text-xs mt-1 truncate">{j ? <><span className="text-accent">{jobNumber(j.number)}</span> · {j.part.name}</> : <span className="text-faint">no job running</span>}</div>
              </Link>
            );
          })}
          {!presses.length ? <p className="text-sm text-muted">No presses yet — add machines under Production, or let the feed create them.</p> : null}
        </div>
      </Card>

      <div className="flex gap-1.5 pb-3 overflow-x-auto">
        {[{ k: "open", l: "Open" }, { k: "RUNNING", l: "Running" }, { k: "RELEASED", l: "Released" }, { k: "PLANNED", l: "Planned" }, { k: "COMPLETE", l: "Complete" }, { k: "all", l: "All" }].map((t) => (
          <Link key={t.k} href={`/jobs?status=${t.k}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${filter === t.k ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{t.l}</Link>
        ))}
      </div>
      <Card padded={false}>
        {jobs.length ? (
          <table className="table">
            <thead><tr><th>Job</th><th>Product</th><th>Customer</th><th>Press / die</th><th className="w-48">Progress</th><th className="text-right">Scrap</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {jobs.map((j) => {
                const pct = j.quantity ? Math.min(1, j.good / j.quantity) : 0;
                const lateRow = j.dueAt && j.dueAt < new Date() && !["COMPLETE", "CANCELLED"].includes(j.status);
                return (
                  <tr key={j.id} className="row-link">
                    <td><Link href={`/jobs/${j.id}`} className="font-semibold hover:text-accent">{jobNumber(j.number)}</Link>{j.customerPo ? <div className="text-[11px] text-muted">PO {j.customerPo}</div> : null}</td>
                    <td><div className="font-medium">{j.part.name}</div><div className="text-[11px] font-mono text-faint">{j.part.sku}{j.part.customerPartNumber ? ` · ${j.part.customerPartNumber}` : ""}</div></td>
                    <td className="text-sm">{j.customer.company ?? `${j.customer.firstName} ${j.customer.lastName}`}</td>
                    <td className="text-xs text-muted">{j.machine?.code ?? "—"}{j.die ? ` · ${j.die.code}` : ""}</td>
                    <td><div className="flex items-center gap-2"><Progress value={pct} tone={pct >= 1 ? "green" : "blue"} className="flex-1" /><span className="text-xs tabular-nums whitespace-nowrap">{num(j.good)} / {num(j.quantity)}</span></div></td>
                    <td className={`text-right tabular-nums text-xs ${j.good + j.scrap && j.scrap / (j.good + j.scrap) > 0.03 ? "text-amber-400" : "text-muted"}`}>{j.scrap}</td>
                    <td className={`text-xs ${lateRow ? "text-red-400 font-semibold" : "text-muted"}`}>{fmtDate(j.dueAt)}</td>
                    <td><Badge tone={STATUS[j.status].tone}>{STATUS[j.status].label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={Factory} title="No jobs here" action={<Link href="/jobs/new" className="btn btn-primary btn-sm">New job</Link>} />
        )}
      </Card>
    </div>
  );
}
