import { Save } from "lucide-react";
import { Field } from "@/components/ui";
import { saveProduct } from "@/actions/production";
import type { CheckItem } from "@/lib/quality";

type Opt = { id: string; label: string };
type Values = { id?: string; sku?: string; name?: string; description?: string | null; category?: string | null; unit?: string; customerId?: string | null; customerPartNumber?: string | null; dieId?: string | null; pressId?: string | null; materialPartId?: string | null; materialPerPiece?: number | null; stdRatePerHour?: number | null; packQty?: number | null; drawingRev?: string | null; checkEveryPieces?: number | null; checkPlan?: CheckItem[]; price?: number; cost?: number; reorderPoint?: number; location?: string | null };

/** A part this shop makes: who it's for, which die/press make it, what it's made from. */
export function ProductForm({ values = {}, customers, dies, presses, materials }: { values?: Values; customers: Opt[]; dies: Opt[]; presses: Opt[]; materials: Opt[] }) {
  const plan: Partial<CheckItem>[] = [...(values.checkPlan ?? []), {}, {}, {}];
  return (
    <form action={saveProduct} className="grid sm:grid-cols-2 gap-4 max-w-3xl">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Field label="Our part number"><input name="sku" required defaultValue={values.sku ?? ""} className="input font-mono uppercase" placeholder="BRK-4471-A" /></Field>
      <Field label="Name"><input name="name" required defaultValue={values.name ?? ""} className="input" placeholder="Mounting bracket, 3 mm" /></Field>
      <Field label="Customer"><select name="customerId" defaultValue={values.customerId ?? ""} className="select"><option value="">— stock item / any —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label="Customer's part number"><input name="customerPartNumber" defaultValue={values.customerPartNumber ?? ""} className="input font-mono" /></Field>
      <Field label="Die"><select name="dieId" defaultValue={values.dieId ?? ""} className="select"><option value="">—</option>{dies.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
      <Field label="Default press"><select name="pressId" defaultValue={values.pressId ?? ""} className="select"><option value="">—</option>{presses.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
      <Field label="Material" hint="A MATERIAL item in inventory (coil, sheet, bar)"><select name="materialPartId" defaultValue={values.materialPartId ?? ""} className="select"><option value="">—</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
      <Field label="Material per piece" hint="In the material's unit (e.g. lb or ft per part)"><input name="materialPerPiece" type="number" step="0.0001" min={0} defaultValue={values.materialPerPiece ?? ""} className="input" /></Field>
      <Field label="Standard rate (pieces / hour)"><input name="stdRatePerHour" type="number" min={0} defaultValue={values.stdRatePerHour ?? ""} className="input" placeholder="1800" /></Field>
      <Field label="Pack quantity"><input name="packQty" type="number" min={0} defaultValue={values.packQty ?? ""} className="input" placeholder="500" /></Field>
      <Field label="Sell price (each)"><input name="price" type="number" step="0.0001" min={0} defaultValue={values.price ?? ""} className="input" /></Field>
      <Field label="Cost (each)"><input name="cost" type="number" step="0.0001" min={0} defaultValue={values.cost ?? ""} className="input" /></Field>
      <Field label="Unit"><input name="unit" defaultValue={values.unit ?? "ea"} className="input" /></Field>
      <Field label="Finished-goods reorder point"><input name="reorderPoint" type="number" min={0} defaultValue={values.reorderPoint ?? 0} className="input" /></Field>
      <Field label="Category"><input name="category" defaultValue={values.category ?? ""} className="input" placeholder="Brackets" /></Field>
      <Field label="Stock location"><input name="location" defaultValue={values.location ?? ""} className="input" placeholder="FG-12" /></Field>
      <Field label="Drawing / print rev"><input name="drawingRev" defaultValue={values.drawingRev ?? ""} className="input font-mono" placeholder="C" /></Field>
      <Field label="In-process check every (pieces)" hint="Leave blank for first-piece only"><input name="checkEveryPieces" type="number" min={0} defaultValue={values.checkEveryPieces ?? ""} className="input" placeholder="500" /></Field>
      <Field label="Description / spec" className="sm:col-span-2"><textarea name="description" rows={2} defaultValue={values.description ?? ""} className="textarea" placeholder="Material spec, finish, tolerances, print revision…" /></Field>
      <div className="sm:col-span-2">
        <div className="label mb-1">Check plan <span className="text-faint font-normal">— what the inspector measures at first piece and in-process checks. Leave nominal blank for a pass/fail item (burr, finish, stamp).</span></div>
        <div className="grid grid-cols-[1fr_4.5rem_4rem_3.5rem] gap-1.5 text-[11px] uppercase tracking-wide text-muted px-1 mb-1"><span>Feature</span><span>Nominal</span><span>± Tol</span><span>Unit</span></div>
        <div className="space-y-1.5">
          {plan.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_4.5rem_4rem_3.5rem] gap-1.5">
              <input name="checkName" defaultValue={row.name ?? ""} className="input py-1.5 px-2 text-sm" placeholder={i === 0 ? "Hole dia" : i === 1 ? "Flange height" : i === 2 ? "Burr < 0.1" : ""} />
              <input name="checkNominal" type="number" step="any" defaultValue={row.nominal ?? ""} className="input py-1.5 px-2 text-sm tabular-nums" />
              <input name="checkTol" type="number" step="any" min={0} defaultValue={row.tolerance ?? ""} className="input py-1.5 px-2 text-sm tabular-nums" />
              <input name="checkUnit" defaultValue={row.unit ?? ""} className="input py-1.5 px-2 text-sm" placeholder="mm" />
            </div>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2"><button className="btn btn-primary"><Save size={15} /> {values.id ? "Save product" : "Add product"}</button></div>
    </form>
  );
}
