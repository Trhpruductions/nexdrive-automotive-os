import Link from "next/link";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

const ENTITY_LINK: Record<string, string> = { WorkOrder: "/work-orders", Invoice: "/invoices", Appointment: "/schedule", Customer: "/customers", Vehicle: "/vehicles", Part: "/parts", Inspection: "/inspections", PurchaseOrder: "/parts/orders" };
const PAGE = 60;

/** Settings → Activity: who did what, newest first. */
export async function ActivityTab({ page, action }: { page: number; action?: string }) {
  const where = action ? { action } : {};
  const [rows, total, actions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true, role: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { _count: { action: "desc" } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <Card title="Activity log" padded={false} action={<span className="text-xs text-muted">{total.toLocaleString()} entries</span>}>
      <div className="flex gap-1.5 px-4 py-3 border-b border-border overflow-x-auto">
        <Link href="/settings?tab=activity" className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${!action ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>All</Link>
        {actions.map((a) => <Link key={a.action} href={`/settings?tab=activity&action=${encodeURIComponent(a.action)}`} className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${action === a.action ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"}`}>{a.action.replace(/_/g, " ")} ({a._count._all})</Link>)}
      </div>
      <table className="table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="text-xs text-muted whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
              <td className="text-sm">{r.user?.name ?? <span className="text-muted">system</span>}</td>
              <td className="text-sm">{r.action.replace(/_/g, " ")}</td>
              <td className="text-sm">{r.entityId && ENTITY_LINK[r.entity] ? <Link href={`${ENTITY_LINK[r.entity]}/${r.entityId}`} className="hover:text-accent">{r.entity}</Link> : r.entity}</td>
              <td className="text-xs text-muted max-w-[360px] truncate">{r.detail}</td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={5} className="text-center text-muted py-8">Nothing logged yet.</td></tr> : null}
        </tbody>
      </table>
      {pages > 1 ? (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={`/settings?tab=activity&page=${page - 1}${action ? `&action=${encodeURIComponent(action)}` : ""}`} className="btn btn-ghost btn-sm">Newer</Link> : null}
            {page < pages ? <Link href={`/settings?tab=activity&page=${page + 1}${action ? `&action=${encodeURIComponent(action)}` : ""}`} className="btn btn-ghost btn-sm">Older</Link> : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
