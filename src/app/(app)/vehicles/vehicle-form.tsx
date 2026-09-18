"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Save, ScanSearch } from "lucide-react";
import { createVehicle, updateVehicle } from "@/actions/vehicles";
import type { FormState } from "@/actions/customers";
import { Field } from "@/components/ui";
import { US_STATES } from "@/lib/constants";
import type { Terms } from "@/lib/verticals";

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

/**
 * Add / edit the serviced asset. Field labels and which fields show come from
 * the shop's business type (Settings → Business): a boat shop sees Hull ID and
 * engine hours, a device shop sees Serial / IMEI and no odometer.
 */
export function VehicleForm({
  values = {},
  customers,
  returnTo,
  cancelHref,
  terms,
}: {
  values?: Values;
  customers: { id: string; firstName: string; lastName: string; company: string | null }[];
  returnTo?: string;
  cancelHref: string;
  terms: Terms;
}) {
  const action = values.id ? updateVehicle.bind(null, values.id) : createVehicle;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const year = new Date().getFullYear() + 1;
  const formRef = useRef<HTMLFormElement>(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeMsg, setDecodeMsg] = useState<string | null>(null);

  async function decodeVin() {
    const form = formRef.current;
    if (!form) return;
    const vin = (form.elements.namedItem("vin") as HTMLInputElement).value.trim();
    if (vin.length < 11) return setDecodeMsg("Enter the 17-character VIN first");
    setDecoding(true);
    setDecodeMsg(null);
    try {
      const res = await fetch(`/api/vin/${encodeURIComponent(vin)}`);
      const d = await res.json();
      if (!res.ok) return setDecodeMsg(d.error ?? "Could not decode");
      const set = (name: string, v: string | number | null) => {
        const el = form.elements.namedItem(name) as HTMLInputElement | null;
        if (el && v) el.value = String(v);
      };
      set("year", d.year); set("make", d.make); set("model", d.model); set("trim", d.trim); set("engine", d.engine); set("transmission", d.transmission);
      setDecodeMsg(`Decoded: ${[d.year, d.make, d.model, d.trim].filter(Boolean).join(" ")}${d.bodyClass ? ` · ${d.bodyClass}` : ""}${d.driveType ? ` · ${d.driveType}` : ""}`);
    } catch {
      setDecodeMsg("Decode service unavailable");
    } finally {
      setDecoding(false);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="card p-5 sm:p-6 space-y-5 max-w-3xl">
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
          <Field label={terms.make}><input name="make" required defaultValue={values.make ?? ""} className="input" /></Field>
          <Field label={terms.model}><input name="model" required defaultValue={values.model ?? ""} className="input" /></Field>
        </div>
        <Field label="Trim / variant"><input name="trim" defaultValue={values.trim ?? ""} className="input" /></Field>
        <Field label="Color"><input name="color" defaultValue={values.color ?? ""} className="input" /></Field>
        <Field label={terms.serial} hint={decodeMsg ?? terms.serialHint}>
          <div className="flex gap-2">
            <input name="vin" maxLength={terms.vinDecode ? 17 : 40} defaultValue={values.vin ?? ""} className="input font-mono uppercase" />
            {terms.vinDecode ? <button type="button" onClick={decodeVin} disabled={decoding} className="btn btn-secondary shrink-0"><ScanSearch size={15} /> {decoding ? "Decoding…" : "Decode"}</button> : null}
          </div>
        </Field>
        {terms.plate ? (
          <div className={`grid gap-3 ${terms.vinDecode ? "grid-cols-[1fr_90px]" : "grid-cols-1"}`}>
            <Field label={terms.plate}><input name="licensePlate" defaultValue={values.licensePlate ?? ""} className="input uppercase" /></Field>
            {terms.vinDecode ? (
              <Field label="State">
                <select name="plateState" defaultValue={values.plateState ?? ""} className="select">
                  <option value="">—</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            ) : null}
          </div>
        ) : null}
        {terms.odometer ? <Field label={`${terms.odometer}${terms.odometerUnit ? ` (${terms.odometerUnit})` : ""}`}><input name="mileage" type="number" min={0} defaultValue={values.mileage ?? 0} className="input" /></Field> : <input type="hidden" name="mileage" value={values.mileage ?? 0} />}
        {terms.engine ? <Field label={terms.engine}><input name="engine" defaultValue={values.engine ?? ""} className="input" /></Field> : null}
        {terms.transmission ? <Field label={terms.transmission}><input name="transmission" defaultValue={values.transmission ?? ""} className="input" /></Field> : null}
        <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={values.notes ?? ""} className="textarea" placeholder="Known issues, aftermarket parts, customer requests" /></Field>
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2 pt-1">
        <button className="btn btn-primary" disabled={pending}><Save size={16} /> {pending ? "Saving…" : values.id ? "Save changes" : `Add ${terms.asset.toLowerCase()}`}</button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
