"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { requestPasswordReset, type MessageState } from "@/actions/auth";

export function ForgotForm() {
  const [state, action, pending] = useActionState<MessageState, FormData>(requestPasswordReset, undefined);
  if (state?.ok) return <p className="card p-5 text-sm text-emerald-400">{state.ok}</p>;
  return (
    <form action={action} className="card p-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@shop.com" />
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full"><Mail size={16} /> {pending ? "Sending…" : "Send reset link"}</button>
    </form>
  );
}
