import Link from "next/link";
import { notFound } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { requireStaff, can, MANAGER_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Field, Flash, PageHeader, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/app/confirm-button";
import { deleteLot, updateLot } from "@/actions/quality";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { jobNumber, shipNumber } from "@/lib/production";
import { QC_KIND } from "@/lib/quality";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await db.materialLot.findUnique({ where: { id }, select: { lotNumber: true } });
  return { title: l ? `Lot ${l.lotNumber}` : "Lot" };
}

/** One coil, end to end: what it is, which runs used it, what shipped from it. */
export default async function LotPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const l = await db.materialLot.findUnique({
    where: { id },
    include: {
      part: { select: { id: true, sku: true, name: true, unit: true } },
      runs: { orderBy: { startedAt: "asc" }, include: { job: { include: { part: { select: { sku: true, customerPartNumber: true } }, customer: { select: { company: true, firstName: true, lastName: true } }, shipmentLines: { include: { shipment: { select: { id: true, number: true, status: true, shipDate: true } } } } } }, machine: { select: { code: true } } } },
      checks: { orderBy: { checkedAt: "desc" }, take: 10, include: { job: { select: { id: true, number: true } } } },
      scrap: { orderBy: { at: "desc" }, take: 20, include: { job: { select: { id: true, number: true } } } },
    },
  });
  if (!l) notFound();
  const qty = Number(l.quantity);
  const rem = Number(l.remaining);
  const hits = l.runs.reduce((s, r) => s + r.good + r.scrap, 0);
  const good = l.runs.reduce((s, r) => s + r.good, 0);
  const scrap = l.runs.reduce((s, r) => s + r.scrap, 0);
  // jobs & shipments touched by this coil (deduped)
  const jobs = [...new Map(l.runs.map((r) => [r.job.id, r.job])).values()];
  const shipments = [...new Map(jobs.flatMap((j) => j.shipmentLines.map((sl) => [sl.shipment.id, { ...sl.shipment, job: j, qty: sl.quantity }] as const))).values()];
  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="font-mono">{l.lotNumber}</span>{l.certOnFile ? <Badge tone="green">cert on file</Badge> : <Badge tone="amber">no mill cert</Badge>}{rem <= 0 ? <Badge tone="slate">used up</Badge> : null}</span>}
        subtitle={<><Link href={`/parts/${l.part.id}`} className="text-accent hover:underline">{l.part.sku}</Link> — {l.part.name}{l.heatNumber ? ` · heat ${l.heatNumber}` : ""}{l.supplier ? ` · ${l.supplier}` : ""} · received {fmtDate(l.receivedAt)}</>}
        crumbs={[{ label: "Parts & Inventory", href: "/parts" }, { label: "Material lots", href: "/parts/lots" }, { label: l.lotNumber }]}
      />
      <Flash searchParams={sp} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <Stat label="Remaining" value={`${num(Math.round(rem))} ${l.unit}`} sub={`of ${num(Math.round(qty))} received`} />
        <Stat label="Pieces made" value={num(good)} sub={scrap ? `${num(scrap)} scrap (${((scrap / Math.max(1, hits)) * 100).toFixed(1)}%)` : undefined} />
        <Stat label="Jobs" value={jobs.length} sub={`${l.runs.length} run${l.runs.length === 1 ? "" : "s"}`} />
        <Stat label="Shipments" value={shipments.length} sub={shipments.length ? `${num(shipments.reduce((s, x) => s + x.qty, 0))} pcs out the door` : undefined} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Runs on this coil" padded={false}>
            <table className="table">
              <thead><tr><th>Started</th><th>Job</th><th>Part</th><th>Press</th><th>Shift</th><th className="text-right">Good</th><th className="text-right">Scrap</th></tr></thead>
              <tbody>
                {l.runs.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(r.startedAt)}{!r.endedAt ? <Badge tone="green" className="ml-2">live</Badge> : null}</td>
                    <td><Link href={`/jobs/${r.job.id}`} className="font-medium hover:text-accent">{jobNumber(r.job.number)}</Link></td>
                    <td className="text-xs">{r.job.part.sku}{r.job.part.customerPartNumber ? <span className="text-muted"> · {r.job.part.customerPartNumber}</span> : null}</td>
                    <td className="text-xs text-muted">{r.machine.code}</td>
                    <td className="text-xs text-muted">{r.shift ?? "—"}</td>
                    <td className="text-right tabular-nums">{num(r.good)}</td>
                    <td className="text-right tabular-nums text-muted">{r.scrap}</td>
                  </tr>
                ))}
                {!l.runs.length ? <tr><td colSpan={7} className="text-center text-muted py-6">Nothing has run on this coil yet. Pick it as the coil on a job.</td></tr> : null}
              </tbody>
            </table>
          </Card>
          <Card title="Shipped from this coil" padded={false}>
            <table className="table">
              <thead><tr><th>Shipment</th><th>Job</th><th>Customer</th><th className="text-right">Pieces</th><th>Status</th></tr></thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/shipments/${s.id}`} className="font-medium hover:text-accent">{shipNumber(s.number)}</Link></td>
                    <td className="text-xs">{jobNumber(s.job.number)} · {s.job.part.sku}</td>
                    <td className="text-xs">{s.job.customer.company ?? `${s.job.customer.firstName} ${s.job.customer.lastName}`}</td>
                    <td className="text-right tabular-nums">{num(s.qty)}</td>
                    <td><Badge tone={s.status === "SHIPPED" ? "green" : "slate"}>{s.status === "SHIPPED" ? `shipped ${s.shipDate ? fmtDate(s.shipDate) : ""}` : "preparing"}</Badge></td>
                  </tr>
                ))}
                {!shipments.length ? <tr><td colSpan={5} className="text-center text-muted py-6">Nothing shipped from this coil yet.</td></tr> : null}
              </tbody>
            </table>
          </Card>
          {l.checks.length || l.scrap.length ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card title="Quality checks" padded={false}>
                <ul className="divide-y divide-border text-sm">{l.checks.map((c) => <li key={c.id} className="px-5 py-2 flex items-center justify-between gap-2"><span><Link href={`/jobs/${c.job.id}`} className="hover:text-accent">{jobNumber(c.job.number)}</Link> <span className="text-muted">· {QC_KIND[c.kind]} at {num(c.pieceCount)}</span></span><Badge tone={c.result === "PASS" ? "green" : "red"}>{c.result.toLowerCase()}</Badge></li>)}{!l.checks.length ? <li className="px-5 py-4 text-center text-muted">None.</li> : null}</ul>
              </Card>
              <Card title="Scrap logged" padded={false}>
                <ul className="divide-y divide-border text-sm">{l.scrap.map((e) => <li key={e.id} className="px-5 py-2 flex items-center justify-between gap-2"><span><Link href={`/jobs/${e.job.id}`} className="hover:text-accent">{jobNumber(e.job.number)}</Link> <span className="text-muted">· {e.reason}</span></span><span className="tabular-nums">{num(e.quantity)}</span></li>)}{!l.scrap.length ? <li className="px-5 py-4 text-center text-muted">None.</li> : null}</ul>
              </Card>
            </div>
          ) : null}
        </div>
        <div className="space-y-4">
          <Card title="Lot details">
            <form action={updateLot.bind(null, l.id)} className="space-y-3">
              <Field label="Heat number"><input name="heatNumber" defaultValue={l.heatNumber ?? ""} className="input font-mono" /></Field>
              <Field label="Supplier"><input name="supplier" defaultValue={l.supplier ?? ""} className="input" /></Field>
              <Field label={`Remaining (${l.unit})`} hint="Correct after weighing the coil"><input name="remaining" type="number" step="0.01" min={0} defaultValue={rem} className="input" /></Field>
              <Field label="Location"><input name="location" defaultValue={l.location ?? ""} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="certOnFile" defaultChecked={l.certOnFile} className="accent-emerald-500" /> Mill cert on file</label>
              <Field label="Notes"><textarea name="notes" rows={3} defaultValue={l.notes ?? ""} className="textarea" /></Field>
              <button className="btn btn-primary btn-sm"><Save size={14} /> Save</button>
            </form>
            {can(user, MANAGER_ROLES) && !l.runs.length ? <form action={deleteLot.bind(null, l.id)} className="mt-3 text-right"><ConfirmButton message="Remove this lot? Stock on hand is not adjusted." className="btn btn-ghost btn-sm text-red-400"><Trash2 size={13} /> Remove</ConfirmButton></form> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
