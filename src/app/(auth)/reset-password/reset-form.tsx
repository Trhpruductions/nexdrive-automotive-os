"use client";

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { resetPassword, type MessageState } from "@/actions/auth";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<MessageState, FormData>(resetPassword, undefined);
  return (
    <form action={action} className="card p-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error} {state.error.includes("expired") ? <Link href="/forgot-password" className="underline">Request a new link</Link> : null}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full"><KeyRound size={16} /> {pending ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
