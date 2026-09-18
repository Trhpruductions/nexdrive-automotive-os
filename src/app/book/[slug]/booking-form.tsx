"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { addDays, format } from "date-fns";
import { bookOnline, type BookingState } from "@/actions/booking";
import { Field } from "@/components/ui";
import type { Terms } from "@/lib/verticals";

export function BookingForm({ slug, services, open, close, terms }: { slug: string; services: { name: string; description: string | null }[]; open: string; close: string; terms: Terms }) {
  const [state, action, pending] = useActionState<BookingState, FormData>(bookOnline.bind(null, slug), undefined);
  const [service, setService] = useState(services[0]?.name ?? "__other");
  const today = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 60), "yyyy-MM-dd");
  const slots = useMemo(() => {
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    const out: string[] = [];
    for (let m = oh * 60 + om; m + 30 <= ch * 60 + cm; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    return out;
  }, [open, close]);
  const label = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };

  return (
    <form action={action} className="card p-6 space-y-5">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div>
        <h2 className="font-semibold">Book a service</h2>
        <p className="text-sm text-muted">Pick a time and we&apos;ll confirm by email or text.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="First name"><input name="firstName" required className="input" autoComplete="given-name" /></Field>
        <Field label="Last name"><input name="lastName" required className="input" autoComplete="family-name" /></Field>
        <Field label="Email"><input name="email" type="email" className="input" autoComplete="email" /></Field>
        <Field label="Mobile phone"><input name="phone" type="tel" className="input" autoComplete="tel" /></Field>
      </div>
      <div className="grid grid-cols-[90px_1fr_1fr] gap-3">
        <Field label="Year"><input name="year" type="number" min={1900} max={new Date().getFullYear() + 1} required className="input" placeholder="2020" /></Field>
        <Field label={terms.make}><input name="make" required className="input" /></Field>
        <Field label={terms.model}><input name="model" required className="input" /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {terms.plate ? <Field label={`${terms.plate} (optional)`}><input name="licensePlate" className="input uppercase" maxLength={16} /></Field> : <Field label={`${terms.serial} (optional)`}><input name="licensePlate" className="input uppercase" maxLength={16} /></Field>}
        <Field label="Service">
          <select name="service" value={service} onChange={(e) => setService(e.target.value)} className="select">
            {services.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            <option value="__other">Something else…</option>
          </select>
        </Field>
        {service === "__other" ? <Field label="Describe what you need" className="sm:col-span-2"><input name="serviceOther" required className="input" placeholder="Check engine light, brakes squealing, …" /></Field> : null}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Date"><input name="date" type="date" min={today} max={maxDate} required className="input" /></Field>
        <Field label="Time">
          <select name="time" required className="select" defaultValue={slots[0]}>
            {slots.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Anything we should know? (optional)"><textarea name="notes" rows={3} className="textarea" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dropOff" defaultChecked className="checkbox" /> {terms.dropOff}</label>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <button className="btn btn-primary w-full py-3" disabled={pending}><CalendarCheck size={16} /> {pending ? "Booking…" : "Request appointment"}</button>
    </form>
  );
}
