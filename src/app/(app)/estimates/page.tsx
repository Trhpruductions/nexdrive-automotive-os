import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireStaff, BILLING_ROLES } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { WO_STATUS } from "@/lib/constants";
import { computeTotals } from "@/lib/money";
import { fmtRelative, money, vehicleName, woNumber } from "@/lib/format";

export const metadata = { title: "Estimates" };

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; error?: string }> }) {
  await requireStaff(BILLING_ROLES);
  const settings = await getSettings();
  const sp = await searchParams;
  const tab = sp.tab === "draft" ? "draft" : sp.tab === "approved" ? "approved" : sp.tab === "declined" ? "declined" : "awaiting";
  const where =
    tab === "draft" ? { status: "ESTIMATE" as const, declinedAt: null } : tab === "declined" ? { status: "ESTIMATE" as const, declinedAt: { not: null } } : tab === "approved" ? { status: "APPROVED" as const } : { status: "AWAITING_APPROVAL" as const };
  const [rows, counts] = await Promise.all([
    db.workOrder.findMany({ where, orderBy: { updatedAt: "desc" }, include: { customer: true, vehicle: true, lines: true } }),
    Promise.all([
      db.workOrder.count({ where: { status: "AWAITING_APPROVAL" } }),
      db.workOrder.count({ where: { status: "ESTIMATE", declinedAt: null } }),
      db.workOrder.count({ where: { status: "APPROVED" } }),
      db.workOrder.count({ where: { status: "ESTIMATE", declinedAt: { not: null } } }),
    ]),
  ]);
  const totalValue = rows.reduce((s, w) => s + computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt }).total, 0);

  return (
    <div>
      <PageHeader title="Estimates" subtitle={`${rows.length} estimate${rows.length === 1 ? "" : "s"} · ${money(totalValue)} in this view`} actions={<Link href="/work-orders/new" className="btn btn-primary"><Plus size={16} /> New estimate</Link>} />
      <Flash searchParams={sp} />
      <div className="flex gap-1.5 pb-3 overflow-x-auto">
        {[
          { key: "awaiting", label: `Awaiting approval (${counts[0]})` },
          { key: "draft", label: `Drafts (${counts[1]})` },
          { key: "approved", label: `Approved, not started (${counts[2]})` },
          { key: "declined", label: `Declined (${counts[3]})` },
        ].map((t) => (
          <Link key={t.key} href={`/estimates?tab=${t.key}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${tab === t.key ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{t.label}</Link>
        ))}
      </div>
      <Card padded={false}>
        {rows.length ? (
          <table className="table">
            <thead><tr><th>Estimate</th><th>Vehicle / customer</th><th>Status</th><th>Sent</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>
              {rows.map((w) => {
                const t = computeTotals(w.lines, settings.taxRate, { taxExempt: w.customer.taxExempt });
                return (
                  <tr key={w.id} className="row-link">
                    <td><Link href={`/work-orders/${w.id}`} className="font-semibold hover:text-accent">{woNumber(w.number)}</Link><div className="text-xs text-muted truncate max-w-[280px]">{w.complaint}</div></td>
                    <td>{vehicleName(w.vehicle)}<div className="text-xs text-muted">{w.customer.firstName} {w.customer.lastName}{w.customer.email ? ` · ${w.customer.email}` : ""}</div></td>
                    <td><Badge tone={WO_STATUS[w.status].tone}>{w.declinedAt && w.status === "ESTIMATE" ? "Declined" : WO_STATUS[w.status].label}</Badge></td>
                    <td className="text-xs text-muted">{w.sentForApprovalAt ? fmtRelative(w.sentForApprovalAt) : "Not sent"}</td>
                    <td className="text-right tabular-nums font-medium">{money(t.total)}</td>
                    <td className="text-right">{w.approvalToken && w.status === "AWAITING_APPROVAL" ? <a href={`/approve/${w.approvalToken}`} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Customer link</a> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={FileText} title="Nothing here" hint="Estimates are work orders that haven't been approved yet." />
        )}
      </Card>
    </div>
  );
}
