import Link from "next/link";
import { Hammer, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, Flash, KpiCard, PageHeader, Progress } from "@/components/ui";
import { num } from "@/lib/format";

export const metadata = { title: "Tooling" };

export default async function ToolingPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const dies = await db.die.findMany({ include: { machine: { select: { code: true } }, products: { select: { sku: true } }, jobs: { where: { status: "RUNNING" }, select: { number: true }, take: 1 } }, orderBy: [{ status: "asc" }, { code: "asc" }] });
  const due = dies.filter((d) => d.serviceIntervalHits && d.hitCount - d.hitsAtService >= d.serviceIntervalHits);
  const soon = dies.filter((d) => d.serviceIntervalHits && !due.includes(d) && d.hitCount - d.hitsAtService >= d.serviceIntervalHits * 0.85);
  return (
    <div>
      <PageHeader title="Tooling" subtitle="Dies with live hit counts from the presses, service intervals and where each one is." actions={<Link href="/tooling/new" className="btn btn-primary"><Plus size={16} /> Add die</Link>} />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Dies" value={dies.length} icon={Hammer} />
        <KpiCard label="Due for service" value={due.length} icon={Hammer} tone={due.length ? "red" : "green"} />
        <KpiCard label="Coming up" value={soon.length} icon={Hammer} tone={soon.length ? "amber" : "slate"} />
        <KpiCard label="In a press now" value={dies.filter((d) => d.machineId).length} icon={Hammer} tone="blue" />
      </div>
      <Card padded={false}>
        {dies.length ? (
          <table className="table">
            <thead><tr><th>Die</th><th>Makes</th><th>Where</th><th className="text-right">Hits</th><th className="w-52">Service interval</th><th>Status</th></tr></thead>
            <tbody>
              {dies.map((d) => {
                const since = d.hitCount - d.hitsAtService;
                const frac = d.serviceIntervalHits ? Math.min(1, since / d.serviceIntervalHits) : null;
                return (
                  <tr key={d.id} className="row-link">
                    <td><Link href={`/tooling/${d.id}`} className="font-semibold hover:text-accent">{d.code}</Link><div className="text-xs text-muted">{d.name}</div></td>
                    <td className="text-xs text-muted">{d.products.map((p) => p.sku).join(", ") || "—"}</td>
                    <td className="text-xs">{d.machine ? <span className="text-accent">{d.machine.code}{d.jobs[0] ? ` · JOB-${String(d.jobs[0].number).padStart(5, "0")}` : ""}</span> : <span className="text-muted">{d.location ?? "—"}</span>}</td>
                    <td className="text-right tabular-nums">{num(d.hitCount)}</td>
                    <td>{frac != null ? <div className="flex items-center gap-2"><Progress value={frac} tone={frac >= 1 ? "red" : frac >= 0.85 ? "amber" : "green"} className="flex-1" /><span className="text-xs tabular-nums whitespace-nowrap">{num(since)} / {num(d.serviceIntervalHits!)}</span></div> : <span className="text-xs text-faint">no interval</span>}</td>
                    <td><Badge tone={d.status === "ACTIVE" ? (frac != null && frac >= 1 ? "red" : "green") : d.status === "MAINTENANCE" ? "amber" : "slate"}>{frac != null && frac >= 1 && d.status === "ACTIVE" ? "service due" : d.status.toLowerCase()}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={Hammer} title="No dies yet" action={<Link href="/tooling/new" className="btn btn-primary btn-sm">Add die</Link>} />
        )}
      </Card>
    </div>
  );
}
