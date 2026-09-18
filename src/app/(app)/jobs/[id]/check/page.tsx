import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { recordCheck } from "@/actions/quality";
import { fmtDateTime, num } from "@/lib/format";
import { jobNumber } from "@/lib/production";
import { QC_KIND, qualityStatus } from "@/lib/quality";
import type { QcKind } from "@/generated/prisma/enums";

export const metadata = { title: "Quality check" };

/**
 * The inspector's sheet: one row per feature on the product's check plan with
 * the nominal and tolerance, an actual to type in, and pass/fail for the
 * non-measured items. The result is worked out on save.
 */
export default async function CheckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; error?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const j = await db.productionJob.findUnique({ where: { id }, include: { part: { select: { sku: true, name: true, drawingRev: true, customerPartNumber: true } }, die: { select: { code: true } }, machine: { select: { code: true } }, lot: { select: { lotNumber: true, heatNumber: true } }, checks: { orderBy: { checkedAt: "desc" }, take: 1 } } });
  if (!j) notFound();
  const q = await qualityStatus(id);
  const kind: QcKind = (["FIRST_PIECE", "IN_PROCESS", "FINAL"].includes(sp.kind ?? "") ? sp.kind : q.firstPiece === "needed" || q.firstPiece === "failed" ? "FIRST_PIECE" : "IN_PROCESS") as QcKind;
  const last = j.checks[0];
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={<span className="flex items-center gap-3">{QC_KIND[kind]} check <Badge tone="blue">{jobNumber(j.number)}</Badge></span>}
        subtitle={<>{j.part.sku} — {j.part.name}{j.part.drawingRev ? ` · rev ${j.part.drawingRev}` : ""}{j.die ? ` · ${j.die.code}` : ""}{j.machine ? ` · ${j.machine.code}` : ""}{j.lot ? ` · coil ${j.lot.lotNumber}${j.lot.heatNumber ? ` / heat ${j.lot.heatNumber}` : ""}` : ""}</>}
        crumbs={[{ label: "Jobs", href: "/jobs" }, { label: jobNumber(j.number), href: `/jobs/${id}` }, { label: "Check" }]}
        actions={<div className="flex gap-1.5">{(["FIRST_PIECE", "IN_PROCESS", "FINAL"] as QcKind[]).map((k) => <Link key={k} href={`/jobs/${id}/check?kind=${k}`} className={`rounded-full px-3 py-1 text-xs font-medium border ${kind === k ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{QC_KIND[k]}</Link>)}</div>}
      />
      <Flash searchParams={sp} />
      {q.onHold ? <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm"><strong>On hold:</strong> {q.holdReason}. A passing check lifts the hold.</div> : null}
      <Card title={`${num(j.good)} good pieces so far${last ? ` · last check ${QC_KIND[last.kind].toLowerCase()} ${last.result.toLowerCase()} at ${num(last.pieceCount)} pcs, ${fmtDateTime(last.checkedAt)}` : ""}`} padded={false}>
        <form action={recordCheck.bind(null, id)}>
          <input type="hidden" name="kind" value={kind} />
          {q.plan.length ? (
            <table className="table">
              <thead><tr><th>Feature</th><th className="text-right">Nominal</th><th className="text-right">± Tol</th><th className="w-40">Actual</th><th className="w-24">OK</th></tr></thead>
              <tbody>
                {q.plan.map((item, i) => (
                  <tr key={i}>
                    <td className="font-medium">{item.name}</td>
                    <td className="text-right tabular-nums text-muted">{item.nominal != null ? `${item.nominal}${item.unit ? ` ${item.unit}` : ""}` : "—"}</td>
                    <td className="text-right tabular-nums text-muted">{item.nominal != null ? (item.tolerance ?? 0) : "—"}</td>
                    <td>{item.nominal != null ? <input name={`actual_${i}`} type="number" step="any" inputMode="decimal" className="input py-2 tabular-nums" placeholder={String(item.nominal)} autoFocus={i === 0} /> : <span className="text-xs text-faint">pass / fail</span>}</td>
                    <td>{item.nominal == null ? <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name={`ok_${i}`} defaultChecked className="h-5 w-5 accent-emerald-500" /> OK</label> : <span className="text-xs text-faint">auto</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-5 pt-4">
              <p className="text-sm text-muted mb-3">No check plan on this product — record the verdict. Add features under the product&apos;s details to measure against a print.</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 cursor-pointer has-checked:border-emerald-500"><input type="radio" name="result" value="PASS" defaultChecked className="accent-emerald-500" /> Pass</label>
                <label className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 cursor-pointer has-checked:border-red-500"><input type="radio" name="result" value="FAIL" className="accent-red-500" /> Fail</label>
              </div>
            </div>
          )}
          <div className="p-5 space-y-3">
            <Field label="Notes"><textarea name="notes" rows={2} className="textarea" placeholder="Gauge used, where on the strip, anything the next shift should know…" /></Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Inspector: {user.name} · a fail puts {jobNumber(j.number)} on hold{j.status === "RUNNING" ? " and pauses the press" : ""}.</span>
              <button className="btn btn-primary py-3 px-5"><ClipboardCheck size={16} /> Record {QC_KIND[kind].toLowerCase()} check</button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
