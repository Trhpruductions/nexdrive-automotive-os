import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getSettings, shopAddress } from "@/lib/settings";
import { EstimateApproval } from "@/components/app/estimate-approval";
import { respondToEstimate } from "@/actions/workorders";
import { computeTotals } from "@/lib/money";
import { fmtDateTime, money, vehicleName, woNumber } from "@/lib/format";

export const metadata = { title: "Approve your estimate" };

/** Public, no-login estimate approval (link sent by email/SMS). */
export default async function ApprovePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const s = await getSettings();
  const w = await db.workOrder.findUnique({ where: { approvalToken: token }, include: { customer: true, vehicle: true, lines: { orderBy: { sortOrder: "asc" } }, inspection: { include: { items: true } } } });
  if (!w) notFound();
  const totals = computeTotals(w.lines, s.taxRate, { taxExempt: w.customer.taxExempt });
  const findings = w.inspection?.items.filter((i) => i.result === "URGENT" || i.result === "ATTENTION") ?? [];

  return (
    <main className="app-canvas min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          {s.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <Image src="/brand/mark.png" alt="" width={48} height={48} />
          )}
          <div><div className="font-semibold">{s.name}</div><div className="text-xs text-muted">{shopAddress(s).join(", ")} · {s.phone}</div></div>
        </div>

        {sp.done === "approved" || w.status === "APPROVED" || w.status === "IN_PROGRESS" || w.status === "COMPLETED" || w.status === "INVOICED" ? (
          <div className="card p-8 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-400" />
            <h1 className="text-xl font-semibold mt-3">Thank you — estimate approved</h1>
            <p className="text-sm text-muted mt-2">{w.approvedAt ? `Approved ${fmtDateTime(w.approvedAt)}${w.approvedBy ? ` by ${w.approvedBy}` : ""}. ` : ""}We&apos;ll get started on your {vehicleName(w.vehicle)} right away and let you know when it&apos;s ready.</p>
          </div>
        ) : sp.done === "declined" || (w.declinedAt && w.status === "ESTIMATE") ? (
          <div className="card p-8 text-center">
            <XCircle size={44} className="mx-auto text-red-400" />
            <h1 className="text-xl font-semibold mt-3">Estimate declined</h1>
            <p className="text-sm text-muted mt-2">No problem — we&apos;ve let the shop know. Call {s.phone} if you&apos;d like to discuss options.</p>
          </div>
        ) : w.status !== "AWAITING_APPROVAL" ? (
          <div className="card p-8 text-center"><h1 className="text-xl font-semibold">This estimate is no longer open</h1><p className="text-sm text-muted mt-2">Please contact {s.name} at {s.phone}.</p></div>
        ) : (
          <>
            <div>
              <div className="text-[11px] tracking-[0.2em] text-accent font-bold">ESTIMATE {woNumber(w.number)}</div>
              <h1 className="text-2xl font-semibold mt-1">{vehicleName(w.vehicle)} — {money(totals.total)}</h1>
              <p className="text-sm text-muted mt-1">Hi {w.customer.firstName}, here&apos;s what we recommend for: <span className="text-text">{w.complaint}</span></p>
            </div>
            {sp.error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{sp.error}</div> : null}
            {w.diagnosis ? <div className="card p-4 text-sm"><div className="card-title mb-1">What we found</div>{w.diagnosis}</div> : null}
            {findings.length ? (
              <div className="card p-4 text-sm">
                <div className="card-title mb-2">Inspection findings</div>
                <ul className="space-y-1">{findings.map((i) => <li key={i.id} className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${i.result === "URGENT" ? "bg-red-500" : "bg-amber-400"}`} />{i.name}{i.notes ? <span className="text-muted"> — {i.notes}</span> : null}</li>)}</ul>
              </div>
            ) : null}
            <EstimateApproval lines={w.lines} taxRate={s.taxRate} taxExempt={w.customer.taxExempt} action={respondToEstimate.bind(null, token)} askName message={s.approvalMessage} />
            <p className="text-xs text-faint text-center">Questions? Call {s.phone}. Approving authorises {s.name} to perform the selected work at the prices shown plus applicable tax.</p>
          </>
        )}
      </div>
    </main>
  );
}
