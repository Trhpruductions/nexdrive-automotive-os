"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { createAppointment, updateAppointment } from "@/actions/appointments";
import type { FormState } from "@/actions/customers";
import { Field } from "@/components/ui";
import { APPT_STATUS } from "@/lib/constants";

type Customer = { id: string; firstName: string; lastName: string; company: string | null };
type Vehicle = { id: string; customerId: string; year: number; make: string; model: string; licensePlate: string | null };

export function AppointmentForm({
  customers,
  vehicles,
  technicians,
  bays,
  initial,
  cancelHref,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  technicians: { id: string; name: string }[];
  bays: { id: string; name: string }[];
  initial: { id?: string; customerId?: string; vehicleId?: string; scheduledStart?: string; durationMinutes?: number; serviceRequested?: string; technicianId?: string | null; bayId?: string | null; notes?: string | null; dropOff?: boolean; status?: string };
  cancelHref: string;
}) {
  const action = initial.id ? updateAppointment.bind(null, initial.id) : createAppointment;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, undefined);
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [vehicleId, setVehicleId] = useState(initial.vehicleId ?? "");
  const customerVehicles = useMemo(() => vehicles.filter((v) => v.customerId === customerId), [vehicles, customerId]);

  return (
    <form action={formAction} className="card p-5 sm:p-6 space-y-5 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Customer">
          <div className="flex gap-2">
            <select name="customerId" required value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }} className="select">
              <option value="" disabled>Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.lastName}, {c.firstName}{c.company ? ` (${c.company})` : ""}</option>)}
            </select>
            <Link href={`/customers/new?returnTo=${encodeURIComponent("/schedule/new")}`} className="btn btn-secondary shrink-0">New</Link>
          </div>
        </Field>
        <Field label="Vehicle">
          <select name="vehicleId" required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="select" disabled={!customerId}>
            <option value="" disabled>{customerId ? "Select vehicle…" : "Choose a customer first"}</option>
            {customerVehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}{v.licensePlate ? ` · ${v.licensePlate}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Service requested" className="sm:col-span-2"><input name="serviceRequested" required defaultValue={initial.serviceRequested ?? ""} className="input" placeholder="Oil change, brake inspection, check engine light…" /></Field>
        <Field label="Date & time"><input name="scheduledStart" type="datetime-local" required defaultValue={initial.scheduledStart ?? ""} className="input" /></Field>
        <Field label="Duration">
          <select name="durationMinutes" defaultValue={initial.durationMinutes ?? 60} className="select">
            {[30, 45, 60, 90, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`}</option>)}
          </select>
        </Field>
        <Field label="Technician">
          <select name="technicianId" defaultValue={initial.technicianId ?? ""} className="select">
            <option value="">Any available</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Bay">
          <select name="bayId" defaultValue={initial.bayId ?? ""} className="select">
            <option value="">Assign later</option>
            {bays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        {initial.id ? (
          <Field label="Status">
            <select name="status" defaultValue={initial.status ?? "SCHEDULED"} className="select">
              {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Notes" className="sm:col-span-2"><textarea name="notes" rows={2} defaultValue={initial.notes ?? ""} className="textarea" placeholder="Anything the team should know" /></Field>
        <div className="sm:col-span-2 flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="dropOff" value="true" defaultChecked={initial.dropOff ?? true} className="accent-[var(--accent)]" /> Customer is dropping off (not waiting)</label>
          <label className="flex items-center gap-2 text-muted"><input type="checkbox" name="force" value="true" className="accent-[var(--accent)]" /> Book anyway if the bay / technician is busy</label>
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={pending}><CalendarPlus size={16} /> {pending ? "Saving…" : initial.id ? "Save changes" : "Book appointment"}</button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
