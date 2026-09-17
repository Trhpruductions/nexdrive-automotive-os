"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { createVehicle, updateVehicle } from "@/actions/vehicles";
import type { FormState } from "@/actions/customers";
import { Field } from "@/components/ui";
import { US_STATES } from "@/lib/constants";

type Values = {
  id?: string;
  customerId?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string | null;
  color?: string | null;
  vin?: string | null;
  licensePlate?: string | null;
  plateState?: string | null;
  mileage?: number;
  engine?: string | null;
  transmission?: string | null;
  notes?: string | null;
};

export function VehicleForm({
  values = {},
  customers,
  returnTo,
  cancelHref,
}: {
  values?: Values;
  customers: { id: string; firstName: string; lastName: string; company: string | null }[];
  returnTo?: string;
  cancelHref: string;
}) {
  const action = values.id ? updateVehicle.bind(null, values.id) : createVehicle;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const year = new Date().getFullYear() + 1;

  return (
    <form action={formAction} className="card p-5 sm:p-6 space-y-5 max-w-3xl">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Owner" className="sm:col-span-2">
          <div className="flex gap-2">
            <select name="customerId" required defaultValue={values.customerId ?? ""} className="select">
              <option value="" disabled>Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.lastName}, {c.firstName}{c.company ? ` (${c.company})` : ""}</option>
              ))}
            </select>
            <Link href={`/customers/new?returnTo=${encodeURIComponent(returnTo ? `/vehicles/new?returnTo=${encodeURIComponent(returnTo)}` : "/vehicles/new")}`} className="btn btn-secondary shrink-0">New</Link>
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Year"><input name="year" type="number" min={1900} max={year} required defaultValue={values.year ?? ""} className="input" /></Field>
          <Field label="Make"><input name="make" required defaultValue={values.make ?? ""} className="input" placeholder="Ford" /></Field>
          <Field label="Model"><input name="model" required defaultValue={values.model ?? ""} className="input" placeholder="F-150" /></Field>
        </div>
        <Field label="Trim"><input name="trim" defaultValue={values.trim ?? ""} className="input" placeholder="Lariat" /></Field>
        <Field label="Color"><input name="color" defaultValue={values.color ?? ""} className="input" /></Field>
        <Field label="VIN" hint="17 characters"><input name="vin" maxLength={17} defaultValue={values.vin ?? ""} className="input font-mono uppercase" /></Field>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <Field label="License plate"><input name="licensePlate" defaultValue={values.licensePlate ?? ""} className="input uppercase" /></Field>
          <Field label="State">
            <select name="plateState" defaultValue={values.plateState ?? ""} className="select">
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Mileage"><input name="mileage" type="number" min={0} defaultValue={values.mileage ?? 0} className="input" /></Field>
        <Field label="Engine"><input name="engine" defaultValue={values.engine ?? ""} className="input" placeholder="5.0L V8" /></Field>
        <Field label="Transmission"><input name="transmission" defaultValue={values.transmission ?? ""} className="input" placeholder="10-speed automatic" /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={values.notes ?? ""} className="textarea" placeholder="Known issues, aftermarket parts, customer requests" /></Field>
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2 pt-1">
        <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Saving…" : values.id ? "Save changes" : "Add vehicle"}</button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
