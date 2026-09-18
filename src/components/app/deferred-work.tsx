import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import type { DeferredItem } from "@/lib/deferred";
import { addDeferredLine, addFindingLine } from "@/actions/workorders";
import { fmtDate, money } from "@/lib/format";

/**
 * Work the vehicle still needs. With an open work order the buttons add the
 * item straight onto its estimate; otherwise they start a new work order.
 */
export function DeferredWorkList({ items, vehicleId, targetWorkOrderId, returnTo }: { items: DeferredItem[]; vehicleId: string; targetWorkOrderId?: string | null; returnTo?: string }) {
  if (!items.length) return <p className="text-sm text-muted">Nothing outstanding — declined work and inspection findings will show up here.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((it) => (
        <li key={`${it.kind}-${it.id}`} className="py-2.5 flex items-center gap-3">
          <span className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${it.kind === "finding" ? (it.result === "URGENT" ? "bg-red-500" : "bg-amber-400") : "bg-slate-500"}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{it.description}</div>
            <div className="text-xs text-muted">
              {it.kind === "line" ? `${money(it.amount)} · ` : it.result === "URGENT" ? "Urgent · " : "Needs attention · "}
              {it.source} · {fmtDate(it.when)}
              {it.kind === "finding" && it.notes ? <span className="block truncate">{it.notes}</span> : null}
            </div>
          </div>
          {targetWorkOrderId ? (
            <form action={(it.kind === "line" ? addDeferredLine : addFindingLine).bind(null, targetWorkOrderId, it.id, returnTo)}>
              <button className="btn btn-secondary btn-sm shrink-0"><Plus size={14} /> Add to estimate</button>
            </form>
          ) : (
            <Link href={`/work-orders/new?vehicleId=${vehicleId}&complaint=${encodeURIComponent(it.description)}`} className="btn btn-secondary btn-sm shrink-0"><AlertTriangle size={14} /> Start estimate</Link>
          )}
        </li>
      ))}
    </ul>
  );
}
