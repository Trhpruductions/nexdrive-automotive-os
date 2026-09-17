import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { requireCustomer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Flash } from "@/components/ui";
import { EstimateApproval } from "@/components/app/estimate-approval";
import { portalApprove } from "@/actions/workorders";
import { INSPECTION_RESULT, WO_STATUS } from "@/lib/constants";
import { computeTotals, lineTotal } from "@/lib/money";
import { fmtDateTime, invNumber, money, vehicleName, woNumber } from "@/lib/format";

const STEPS = ["Received", "Diagnosed", "Estimate", "Approved", "In repair", "Ready"] as const;

export const metadata = { title: "Your service" };

export default async function PortalServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireCustomer();
  const s = await getSettings();
  const { id } = await params;
  const sp = await searchParams;
  const w = await db.workOrder.findUnique({ where: { id }, include: { vehicle: true, customer: true, technician: true, lines: { orderBy: { sortOrder: "asc" } }, photos: { orderBy: { createdAt: "desc" } }, inspection: { include: { items: { orderBy: { sortOrder: "asc" } } } }, invoice: true } });
  if (!w || w.customerId !== user.customerId) notFound();
  const totals = computeTotals(w.lines, s.taxRate, { taxExempt: w.customer.taxExempt });
  const step = w.status === "COMPLETED" || w.status === "INVOICED" ? 5 : w.status === "IN_PROGRESS" || w.status === "ON_HOLD" ? 4 : w.status === "APPROVED" ? 3 : w.status === "AWAITING_APPROVAL" ? 2 : w.diagnosis ? 1 : 0;
  const findings = w.inspection?.items.filter((i) => i.result !== "NA") ?? [];

  return (
    <div className="space-y-5">
      <Link href="/portal" className="text-sm text-muted hover:text-text inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to my vehicles</Link>
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-3">{vehicleName(w.vehicle)} <Badge tone={WO_STATUS[w.status].tone}>{WO_STATUS[w.status].label}</Badge></h1>
        <p className="text-sm text-muted mt-1">{woNumber(w.number)} · {w.complaint}{w.technician ? ` · Technician: ${w.technician.name}` : ""}</p>
      </div>
      <Flash searchParams={sp} />

      <ol className="card px-4 py-3 flex items-center gap-2 overflow-x-auto text-xs">
        {STEPS.map((st, i) => (
          <li key={st} className="flex items-center gap-2 shrink-0">
            <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${i < step ? "bg-emerald-500/20 text-emerald-400" : i === step ? "bg-accent text-white" : "bg-card-hover text-faint"}`}>{i < step ? <Check size={12} /> : i + 1}</span>
            <span className={i === step ? "font-semibold" : i < step ? "text-muted" : "text-faint"}>{st}</span>
            {i < STEPS.length - 1 ? <span className="w-5 h-px bg-border" /> : null}
          </li>
        ))}
      </ol>

      {w.status === "AWAITING_APPROVAL" ? (
        <div>
          <h2 className="font-semibold mb-2">Your estimate — {money(totals.total)}</h2>
          <EstimateApproval lines={w.lines} taxRate={s.taxRate} taxExempt={w.customer.taxExempt} action={portalApprove.bind(null, w.id)} askName={false} message={s.approvalMessage} />
        </div>
      ) : (
        <Card title={w.invoice ? "Invoice" : "Work details"} action={w.invoice ? <Link href={`/portal/invoices/${w.invoice.id}`} className="text-xs text-accent hover:underline">{invNumber(w.invoice.number)} →</Link> : null}>
          <ul className="divide-y divide-border">
            {w.lines.filter((l) => l.approved).map((l) => <li key={l.id} className="py-2 flex justify-between text-sm"><span>{l.description}</span><span className="tabular-nums">{money(lineTotal(l))}</span></li>)}
            {!w.lines.length ? <li className="py-2 text-sm text-muted">We&apos;re still diagnosing — your estimate will appear here.</li> : null}
          </ul>
          {w.lines.length ? <div className="flex justify-between font-semibold mt-3 pt-3 border-t border-border"><span>Total incl. tax</span><span className="tabular-nums">{money(totals.total)}</span></div> : null}
          {w.approvedAt ? <p className="text-xs text-emerald-400 mt-2">Approved {fmtDateTime(w.approvedAt)}{w.approvedBy ? ` by ${w.approvedBy}` : ""}</p> : null}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="What we found">
          {w.diagnosis ? <p className="text-sm">{w.diagnosis}</p> : <p className="text-sm text-muted">Diagnosis in progress.</p>}
          {w.technicianNotes ? <p className="text-sm text-muted mt-3 pt-3 border-t border-border whitespace-pre-line">{w.technicianNotes}</p> : null}
          {w.promisedAt ? <p className="text-xs text-muted mt-3">Estimated ready: {fmtDateTime(w.promisedAt)}</p> : null}
        </Card>
        <Card title="Inspection report" action={w.inspection ? <Link href={`/portal/service/${w.id}/inspection`} className="text-xs text-accent hover:underline">Full report →</Link> : null}>
          {findings.length ? (
            <ul className="space-y-1.5 text-sm">
              {findings.map((i) => <li key={i.id} className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${INSPECTION_RESULT[i.result].dot}`} /><span><span className="font-medium">{i.name}</span> <span className="text-muted">— {INSPECTION_RESULT[i.result].label}{i.notes ? `: ${i.notes}` : ""}</span></span></li>)}
            </ul>
          ) : <p className="text-sm text-muted">No inspection on this visit yet.</p>}
          {w.inspection?.summary ? <p className="text-sm text-muted mt-3 pt-3 border-t border-border">{w.inspection.summary}</p> : null}
        </Card>
      </div>

      {w.photos.length ? (
        <Card title="Photos from the shop">
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {w.photos.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full object-cover" />
                </a>
                {p.caption ? <div className="text-xs text-muted mt-1">{p.caption}</div> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
