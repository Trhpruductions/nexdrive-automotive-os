"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { changePassword, type MessageState } from "@/actions/auth";

export function PasswordForm() {
  const [state, action, pending] = useActionState<MessageState, FormData>(changePassword, undefined);
  return (
    <form action={action} className="space-y-4 max-w-sm">
      <div>
        <label className="label" htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
      </div>
      {state?.error ? <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{state.ok}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary"><KeyRound size={16} /> {pending ? "Saving…" : "Update password"}</button>
    </form>
  );
}
