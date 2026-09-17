import { Check, Plus, Save, Trash2, X, Zap } from "lucide-react";
import { addCannedService, addLine, removeLine, toggleLineApproved, updateLine } from "@/actions/workorders";
import { computeTotals, lineTotal } from "@/lib/money";
import { money } from "@/lib/format";
import { Badge } from "@/components/ui";

type Line = {
  id: string;
  kind: "LABOR" | "PART" | "FEE" | "DISCOUNT";
  description: string;
  quantity: { toString(): string };
  unitPrice: { toString(): string };
  hours: { toString(): string } | null;
  taxable: boolean;
  approved: boolean;
  part: { sku: string } | null;
};

const KIND_LABEL = { LABOR: "Labor", PART: "Part", FEE: "Fee", DISCOUNT: "Discount" } as const;
const KIND_TONE = { LABOR: "blue", PART: "violet", FEE: "slate", DISCOUNT: "green" } as const;

/**
 * Editable estimate / work-order lines. Each row is its own <form> (via the `form`
 * attribute, since forms can't nest inside a table row) so every line can be saved,
 * approved/declined or removed independently.
 */
export function LinesEditor({
  workOrderId,
  lines,
  parts,
  cannedServices,
  taxRate,
  laborRate,
  taxExempt,
  editable,
}: {
  workOrderId: string;
  lines: Line[];
  parts: { id: string; sku: string; name: string; price: { toString(): string }; quantityOnHand: number }[];
  cannedServices: { id: string; name: string }[];
  taxRate: number;
  laborRate: number;
  taxExempt: boolean;
  editable: boolean;
}) {
  const totals = computeTotals(lines, taxRate, { taxExempt });

  return (
    <div id="lines">
      {/* hidden per-row forms */}
      {editable
        ? lines.map((l) => (
            <span key={l.id}>
              <form id={`line-${l.id}`} action={updateLine.bind(null, l.id)} />
              <form id={`approve-${l.id}`} action={toggleLineApproved.bind(null, l.id)} />
              <form id={`remove-${l.id}`} action={removeLine.bind(null, l.id)} />
            </span>
          ))
        : null}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-20">Type</th>
              <th>Description</th>
              <th className="w-24 text-right">Qty / Hrs</th>
              <th className="w-28 text-right">Rate</th>
              <th className="w-14 text-center">Tax</th>
              <th className="w-28 text-right">Total</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const f = `line-${l.id}`;
              const qty = l.kind === "LABOR" ? Number(l.hours ?? l.quantity) : Number(l.quantity);
              return (
                <tr key={l.id} className={!l.approved ? "opacity-60" : ""}>
                  <td>
                    <Badge tone={KIND_TONE[l.kind]}>{KIND_LABEL[l.kind]}</Badge>
                    {l.part ? <div className="text-[10px] font-mono text-faint mt-1">{l.part.sku}</div> : null}
                  </td>
                  <td>
                    {editable ? <input form={f} name="description" defaultValue={l.description} className="input py-1.5" /> : <span className={!l.approved ? "line-through" : ""}>{l.description}</span>}
                    {!l.approved ? <div className="text-[11px] text-red-400 mt-0.5">Declined by customer</div> : null}
                  </td>
                  <td className="text-right">
                    {editable ? <input form={f} name={l.kind === "LABOR" ? "hours" : "quantity"} type="number" step="0.01" min="0" defaultValue={qty} className="input py-1.5 text-right" /> : qty}
                  </td>
                  <td className="text-right">
                    {editable ? <input form={f} name="unitPrice" type="number" step="0.01" min="0" defaultValue={Number(l.unitPrice)} className="input py-1.5 text-right" /> : money(l.unitPrice)}
                  </td>
                  <td className="text-center">
                    {editable ? <input form={f} type="checkbox" name="taxable" defaultChecked={l.taxable} disabled={l.kind === "DISCOUNT"} className="accent-[var(--accent)]" /> : l.taxable ? "Yes" : "—"}
                  </td>
                  <td className="text-right tabular-nums font-medium">{money(lineTotal(l))}</td>
                  <td>
                    {editable ? (
                      <div className="flex items-center justify-end gap-1">
                        <button form={f} className="btn btn-ghost btn-sm" title="Save line"><Save size={14} /></button>
                        <button form={`approve-${l.id}`} className={`btn btn-ghost btn-sm ${l.approved ? "text-emerald-400" : "text-red-400"}`} title={l.approved ? "Mark declined" : "Mark approved"}>
                          {l.approved ? <Check size={14} /> : <X size={14} />}
                        </button>
                        <button form={`remove-${l.id}`} className="btn btn-ghost btn-sm text-faint hover:text-red-400" title="Remove"><Trash2 size={14} /></button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!lines.length ? (
              <tr><td colSpan={7} className="text-center text-muted py-8">No labor or parts yet. Add a line or apply a canned service below.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editable ? (
        <div className="border-t border-border mt-2 pt-4 space-y-3">
          {cannedServices.length ? (
            <form action={addCannedService.bind(null, workOrderId)} className="flex flex-wrap items-end gap-2">
              <label className="block flex-1 min-w-[220px]">
                <span className="label">Canned service</span>
                <select name="cannedServiceId" required className="select" defaultValue="">
                  <option value="" disabled>Choose a service package…</option>
                  {cannedServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <button className="btn btn-secondary"><Zap size={15} /> Apply</button>
            </form>
          ) : null}
          <form action={addLine.bind(null, workOrderId)} className="grid grid-cols-2 md:grid-cols-[110px_1fr_1fr_100px_110px_auto] gap-2 items-end">
            <label className="block">
              <span className="label">Type</span>
              <select name="kind" className="select" defaultValue="LABOR">
                <option value="LABOR">Labor</option>
                <option value="PART">Part</option>
                <option value="FEE">Fee</option>
                <option value="DISCOUNT">Discount</option>
              </select>
            </label>
            <label className="block">
              <span className="label">Description</span>
              <input name="description" className="input" placeholder="Replace front brake pads" />
            </label>
            <label className="block">
              <span className="label">Part from inventory</span>
              <select name="partId" className="select" defaultValue="">
                <option value="">— (type a description)</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)} · {p.quantityOnHand} on hand</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Qty / Hrs</span>
              <input name="quantity" type="number" step="0.01" min="0" defaultValue={1} className="input" />
            </label>
            <label className="block">
              <span className="label">Rate</span>
              <input name="unitPrice" type="number" step="0.01" min="0" className="input" placeholder={String(laborRate)} />
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" name="taxable" className="accent-[var(--accent)]" /> Tax</label>
              <button className="btn btn-primary"><Plus size={15} /> Add</button>
            </div>
          </form>
          <p className="text-[11px] text-faint">Labor uses the shop rate ({money(laborRate)}/hr) when rate is blank. Parts pull price and description from inventory when chosen.</p>
        </div>
      ) : null}

      <div className="flex justify-end mt-4">
        <dl className="w-full sm:w-72 text-sm space-y-1.5">
          <div className="flex justify-between text-muted"><dt>Labor</dt><dd className="tabular-nums">{money(totals.labor)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Parts</dt><dd className="tabular-nums">{money(totals.parts)}</dd></div>
          {totals.fees ? <div className="flex justify-between text-muted"><dt>Fees</dt><dd className="tabular-nums">{money(totals.fees)}</dd></div> : null}
          {totals.discount ? <div className="flex justify-between text-emerald-400"><dt>Discounts</dt><dd className="tabular-nums">{money(totals.discount)}</dd></div> : null}
          <div className="flex justify-between border-t border-border pt-1.5"><dt>Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
          <div className="flex justify-between text-muted"><dt>Tax {taxExempt ? "(exempt)" : `(${(taxRate * 100).toFixed(2)}%)`}</dt><dd className="tabular-nums">{money(totals.tax)}</dd></div>
          <div className="flex justify-between text-lg font-semibold border-t border-border pt-2"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
          {totals.declined ? <div className="flex justify-between text-xs text-faint"><dt>Declined work</dt><dd className="tabular-nums">{money(totals.declined)}</dd></div> : null}
        </dl>
      </div>
    </div>
  );
}
