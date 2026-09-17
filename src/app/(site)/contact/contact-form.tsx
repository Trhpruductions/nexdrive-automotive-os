"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { requestDemo, type SignupState } from "@/actions/platform";
import { Field } from "@/components/ui";

export function ContactForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(requestDemo, undefined);
  return (
    <form action={action} className="card p-6 space-y-4">
      <input type="hidden" name="source" value="website-contact" />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Your name"><input name="name" required className="input" autoComplete="name" /></Field>
        <Field label="Work email"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
        <Field label="Shop / company"><input name="shopName" className="input" autoComplete="organization" /></Field>
        <Field label="Phone"><input name="phone" type="tel" className="input" autoComplete="tel" /></Field>
      </div>
      <Field label="What are you looking to do?"><textarea name="message" rows={4} className="textarea" placeholder="Bays, technicians, current software, machines or lines to connect…" /></Field>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <button className="btn btn-primary w-full py-3" disabled={pending}><Send size={15} /> {pending ? "Sending…" : "Request a demo"}</button>
    </form>
  );
}
