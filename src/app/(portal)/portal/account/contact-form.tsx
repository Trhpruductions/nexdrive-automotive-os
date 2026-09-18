"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateMyContact } from "@/actions/portal";
import { Field } from "@/components/ui";

type Values = { email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null };

export function ContactForm({ values }: { values: Values }) {
  const [state, action, pending] = useActionState(updateMyContact, undefined);
  return (
    <form action={action} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
      <Field label="Email"><input name="email" type="email" defaultValue={values.email ?? ""} className="input" autoComplete="email" /></Field>
      <Field label="Mobile phone"><input name="phone" type="tel" defaultValue={values.phone ?? ""} className="input" autoComplete="tel" /></Field>
      <Field label="Street address" className="sm:col-span-2"><input name="address" defaultValue={values.address ?? ""} className="input" autoComplete="street-address" /></Field>
      <Field label="City"><input name="city" defaultValue={values.city ?? ""} className="input" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State"><input name="state" defaultValue={values.state ?? ""} className="input" maxLength={2} /></Field>
        <Field label="ZIP"><input name="zip" defaultValue={values.zip ?? ""} className="input" /></Field>
      </div>
      {state?.error ? <p className="sm:col-span-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      {state?.ok ? <p className="sm:col-span-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{state.ok}</p> : null}
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={pending}><Save size={15} /> {pending ? "Saving…" : "Save details"}</button></div>
    </form>
  );
}
