import { Check, X } from "lucide-react";
import { computeTotals, lineTotal } from "@/lib/money";
import { money } from "@/lib/format";

type Line = { id: string; kind: "LABOR" | "PART" | "FEE" | "DISCOUNT"; description: string; quantity: { toString(): string }; unitPrice: { toString(): string }; hours: { toString(): string } | null; taxable: boolean; approved: boolean };

/**
 * Customer-facing line-by-line approval form. Used by the public /approve/[token]
 * page and the logged-in portal. `action` receives the FormData (decision, name, line[]).
 */
export function EstimateApproval({ lines, taxRate, taxExempt, action, askName, message }: { lines: Line[]; taxRate: number; taxExempt: boolean; action: (formData: FormData) => Promise<void>; askName: boolean; message?: string | null }) {
  const totals = computeTotals(lines, taxRate, { taxExempt });
  return (
    <form action={action} className="card p-5 sm:p-6 space-y-4">
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <p className="text-xs text-faint">Untick any item you&apos;d like to skip — the total updates when we receive your approval.</p>
      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <li key={l.id} className="py-2.5 flex items-center gap-3">
            <input type="checkbox" name="line" value={l.id} defaultChecked={l.approved} className="h-4 w-4 accent-[var(--accent)]" disabled={l.kind === "DISCOUNT"} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{l.description}</div>
              <div className="text-xs text-muted">{l.kind === "LABOR" ? `${Number(l.hours ?? l.quantity)} hr labor` : l.kind === "PART" ? `${Number(l.quantity)} × ${money(l.unitPrice)}` : l.kind.toLowerCase()}</div>
            </div>
            <div className="tabular-nums text-sm font-medium">{money(lineTotal(l))}</div>
          </li>
        ))}
      </ul>
      <dl className="ml-auto w-full sm:w-64 text-sm space-y-1 border-t border-border pt-3">
        <div className="flex justify-between text-muted"><dt>Subtotal (all items)</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
        <div className="flex justify-between text-muted"><dt>Tax</dt><dd className="tabular-nums">{money(totals.tax)}</dd></div>
        <div className="flex justify-between font-semibold text-base"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
      </dl>
      {askName ? (
        <label className="block">
          <span className="label">Type your full name to sign</span>
          <input name="name" required className="input" placeholder="Your name" autoComplete="name" />
        </label>
      ) : null}
      <div className="flex flex-col sm:flex-row gap-2">
        <button name="decision" value="approve" className="btn btn-primary flex-1 py-3 text-base"><Check size={18} /> Approve estimate</button>
        <button name="decision" value="decline" className="btn btn-ghost text-red-400" formNoValidate><X size={16} /> Decline</button>
      </div>
    </form>
  );
}
