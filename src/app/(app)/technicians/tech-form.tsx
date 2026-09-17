"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { createTechnician, updateTechnician } from "@/actions/technicians";
import type { FormState } from "@/actions/customers";
import { Field } from "@/components/ui";

type Values = { id?: string; name?: string; email?: string | null; phone?: string | null; specialty?: string | null; hourlyRate?: number; color?: string; active?: boolean; hasLogin?: boolean };

export function TechForm({ values = {}, cancelHref }: { values?: Values; cancelHref: string }) {
  const action = values.id ? updateTechnician.bind(null, values.id) : createTechnician;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  return (
    <form action={formAction} className="card p-5 sm:p-6 space-y-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full name"><input name="name" required defaultValue={values.name ?? ""} className="input" /></Field>
        <Field label="Specialty"><input name="specialty" defaultValue={values.specialty ?? ""} className="input" placeholder="Diagnostics, brakes, EV…" /></Field>
        <Field label="Email"><input name="email" type="email" defaultValue={values.email ?? ""} className="input" /></Field>
        <Field label="Phone"><input name="phone" defaultValue={values.phone ?? ""} className="input" /></Field>
        <Field label="Hourly cost rate" hint="What you pay — used for job profitability"><input name="hourlyRate" type="number" step="0.01" min="0" defaultValue={values.hourlyRate ?? 0} className="input" /></Field>
        <Field label="Calendar color"><input name="color" type="color" defaultValue={values.color ?? "#3b82f6"} className="input h-10 p-1" /></Field>
        {values.id ? (
          <Field label="Status">
            <select name="active" defaultValue={values.active === false ? "false" : "true"} className="select"><option value="true">Active</option><option value="false">Inactive</option></select>
          </Field>
        ) : null}
        <Field label={values.hasLogin ? "Reset login password" : "Create login (optional)"} hint="Technicians sign in to see their jobs and run inspections" className={values.id ? "" : "sm:col-span-2"}>
          <input name="loginPassword" type="password" minLength={8} className="input" placeholder={values.hasLogin ? "Leave blank to keep current" : "Password (8+ characters)"} autoComplete="new-password" />
        </Field>
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Saving…" : values.id ? "Save changes" : "Add technician"}</button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
