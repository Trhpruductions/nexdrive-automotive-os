"use client";

import { useActionState } from "react";
import { Rocket } from "lucide-react";
import { signup, type SignupState } from "@/actions/platform";
import { Field } from "@/components/ui";
import { VERTICALS } from "@/lib/verticals";

export function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, undefined);
  return (
    <form action={action} className="card p-6 space-y-4">
      <Field label="Shop name"><input name="shopName" required autoFocus className="input" placeholder="Plex Roswell Automotive" /></Field>
      <Field label="What do you service?" hint="Sets the words, checklist and service packages you start with — all editable later">
        <select name="vertical" className="select" defaultValue="automotive">
          {VERTICALS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>
      </Field>
      <Field label="Your name"><input name="ownerName" required className="input" placeholder="Alex Rivera" autoComplete="name" /></Field>
      <Field label="Work email"><input name="email" type="email" required className="input" placeholder="you@yourshop.com" autoComplete="email" /></Field>
      <Field label="Phone (optional)"><input name="phone" type="tel" className="input" placeholder="(555) 555-0100" autoComplete="tel" /></Field>
      <Field label="Password" hint="At least 8 characters"><input name="password" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <button className="btn btn-primary w-full py-3" disabled={pending}><Rocket size={16} /> {pending ? "Creating your shop…" : "Start free trial"}</button>
      <p className="text-[11px] text-faint text-center">By continuing you agree to the NexDrive terms of service.</p>
    </form>
  );
}
