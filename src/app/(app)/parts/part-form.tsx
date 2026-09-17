"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { createPart, updatePart } from "@/actions/parts";
import type { FormState } from "@/actions/customers";
import { Field } from "@/components/ui";

type Values = { id?: string; sku?: string; name?: string; description?: string | null; category?: string | null; brand?: string | null; location?: string | null; supplierId?: string | null; quantityOnHand?: number; reorderPoint?: number; cost?: number; price?: number; active?: boolean };

export function PartForm({ values = {}, suppliers, categories, cancelHref }: { values?: Values; suppliers: { id: string; name: string }[]; categories: string[]; cancelHref: string }) {
  const action = values.id ? updatePart.bind(null, values.id) : createPart;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="card p-5 sm:p-6 space-y-5 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="SKU / part number"><input name="sku" required defaultValue={values.sku ?? ""} className="input font-mono uppercase" /></Field>
        <Field label="Name"><input name="name" required defaultValue={values.name ?? ""} className="input" /></Field>
        <Field label="Category"><input name="category" list="categories" defaultValue={values.category ?? ""} className="input" placeholder="Brakes" /><datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Brand"><input name="brand" defaultValue={values.brand ?? ""} className="input" /></Field>
        <Field label="Bin location"><input name="location" defaultValue={values.location ?? ""} className="input" placeholder="A-12" /></Field>
        <Field label="Supplier">
          <select name="supplierId" defaultValue={values.supplierId ?? ""} className="select">
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Cost"><input name="cost" type="number" step="0.01" min="0" defaultValue={values.cost ?? 0} className="input" /></Field>
        <Field label="Sell price"><input name="price" type="number" step="0.01" min="0" defaultValue={values.price ?? 0} className="input" /></Field>
        {!values.id ? <Field label="Quantity on hand"><input name="quantityOnHand" type="number" min="0" defaultValue={values.quantityOnHand ?? 0} className="input" /></Field> : null}
        <Field label="Reorder point" hint="Alert when stock is at or below"><input name="reorderPoint" type="number" min="0" defaultValue={values.reorderPoint ?? 0} className="input" /></Field>
        <Field label="Description" className="sm:col-span-2"><textarea name="description" rows={2} defaultValue={values.description ?? ""} className="textarea" /></Field>
        {values.id ? (
          <Field label="Status">
            <select name="active" defaultValue={values.active === false ? "false" : "true"} className="select">
              <option value="true">Active</option>
              <option value="false">Archived</option>
            </select>
          </Field>
        ) : null}
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Saving…" : values.id ? "Save changes" : "Add part"}</button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
