"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { createCustomer, updateCustomer, type FormState } from "@/actions/customers";
import { Field } from "@/components/ui";
import { US_STATES } from "@/lib/constants";

type Values = {
  id?: string;
  firstName?: string;
  lastName?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  notes?: string | null;
  taxExempt?: boolean;
};

export function CustomerForm({ values = {}, returnTo, cancelHref }: { values?: Values; returnTo?: string; cancelHref: string }) {
  const action = values.id ? updateCustomer.bind(null, values.id) : createCustomer;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="card p-5 sm:p-6 space-y-5 max-w-3xl">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="First name"><input name="firstName" required defaultValue={values.firstName ?? ""} className="input" /></Field>
        <Field label="Last name"><input name="lastName" required defaultValue={values.lastName ?? ""} className="input" /></Field>
        <Field label="Company (optional)"><input name="company" defaultValue={values.company ?? ""} className="input" /></Field>
        <Field label="Phone"><input name="phone" type="tel" defaultValue={values.phone ?? ""} className="input" placeholder="(555) 555-0100" /></Field>
        <Field label="Email" hint="Needed for estimate approvals & portal login" className="sm:col-span-2">
          <input name="email" type="email" defaultValue={values.email ?? ""} className="input" />
        </Field>
        <Field label="Street address" className="sm:col-span-2"><input name="address" defaultValue={values.address ?? ""} className="input" /></Field>
        <Field label="City"><input name="city" defaultValue={values.city ?? ""} className="input" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State">
            <select name="state" defaultValue={values.state ?? ""} className="select">
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="ZIP"><input name="zip" defaultValue={values.zip ?? ""} className="input" /></Field>
        </div>
        <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={values.notes ?? ""} className="textarea" placeholder="Preferences, fleet details, anything the team should know" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="taxExempt" value="true" defaultChecked={values.taxExempt ?? false} className="accent-[var(--accent)]" />
          Tax exempt (no sales tax on invoices)
        </label>
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2 pt-1">
        <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Saving…" : values.id ? "Save changes" : "Create customer"}</button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
