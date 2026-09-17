"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createWorkOrder } from "@/actions/workorders";
import type { FormState } from "@/actions/customers";
import { Field } from "@/components/ui";

type Customer = { id: string; firstName: string; lastName: string; company: string | null };
type Vehicle = { id: string; customerId: string; year: number; make: string; model: string; trim: string | null; licensePlate: string | null; mileage: number };

export function NewWorkOrderForm({
  customers,
  vehicles,
  technicians,
  bays,
  initial,
}: {
  customers: Customer[];
  vehicles: Vehicle[];
  technicians: { id: string; name: string }[];
  bays: { id: string; name: string }[];
  initial: { customerId?: string; vehicleId?: string; complaint?: string; technicianId?: string; bayId?: string; appointmentId?: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createWorkOrder, undefined);
  const [customerId, setCustomerId] = useState(initial.customerId ?? "");
  const [vehicleId, setVehicleId] = useState(initial.vehicleId ?? "");
  const customerVehicles = useMemo(() => vehicles.filter((v) => v.customerId === customerId), [vehicles, customerId]);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const returnHere = `/work-orders/new${customerId ? `?customerId=${customerId}` : ""}`;

  return (
    <form action={action} className="card p-5 sm:p-6 space-y-5 max-w-3xl">
      {initial.appointmentId ? <input type="hidden" name="appointmentId" value={initial.appointmentId} /> : null}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Customer">
          <div className="flex gap-2">
            <select name="customerId" required value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(""); }} className="select">
              <option value="" disabled>Select customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.lastName}, {c.firstName}{c.company ? ` (${c.company})` : ""}</option>)}
            </select>
            <Link href={`/customers/new?returnTo=${encodeURIComponent("/work-orders/new")}`} className="btn btn-secondary shrink-0">New</Link>
          </div>
        </Field>
        <Field label="Vehicle">
          <div className="flex gap-2">
            <select name="vehicleId" required value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="select" disabled={!customerId}>
              <option value="" disabled>{customerId ? (customerVehicles.length ? "Select vehicle…" : "No vehicles — add one") : "Choose a customer first"}</option>
              {customerVehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ""}{v.licensePlate ? ` · ${v.licensePlate}` : ""}</option>)}
            </select>
            <Link href={`/vehicles/new?customerId=${customerId}&returnTo=${encodeURIComponent(returnHere)}`} className={`btn btn-secondary shrink-0 ${!customerId ? "pointer-events-none opacity-50" : ""}`}>New</Link>
          </div>
        </Field>
        <Field label="Customer complaint" className="sm:col-span-2">
          <textarea name="complaint" required rows={3} defaultValue={initial.complaint ?? ""} className="textarea" placeholder="What the customer reported — noises, warning lights, requested services…" />
        </Field>
        <Field label="Mileage in"><input name="mileageIn" type="number" min={0} key={vehicle?.id ?? "none"} defaultValue={vehicle?.mileage ?? ""} className="input" /></Field>
        <Field label="Promised by"><input name="promisedAt" type="datetime-local" className="input" /></Field>
        <Field label="Technician">
          <select name="technicianId" defaultValue={initial.technicianId ?? ""} className="select">
            <option value="">Unassigned</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Bay">
          <select name="bayId" defaultValue={initial.bayId ?? ""} className="select">
            <option value="">No bay</option>
            {bays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Start as" className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: "ESTIMATE", t: "Estimate", d: "Build the quote, then send it to the customer for approval." },
              { v: "APPROVED", t: "Approved work", d: "Customer already approved in person — go straight to the repair." },
            ].map((o, i) => (
              <label key={o.v} className="card card-hover p-3 cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="status" value={o.v} defaultChecked={i === 0} className="sr-only" />
                <div className="text-sm font-semibold">{o.t}</div>
                <div className="text-xs text-muted mt-0.5">{o.d}</div>
              </label>
            ))}
          </div>
        </Field>
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" disabled={pending}><ClipboardList size={16} /> {pending ? "Creating…" : "Create work order"}</button>
        <Link href="/work-orders" className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
