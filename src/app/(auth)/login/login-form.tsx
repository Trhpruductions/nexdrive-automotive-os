"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login } from "@/actions/auth";

export function LoginForm({ next, portal }: { next?: string; portal: boolean }) {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="card p-6 space-y-4">
      <div>
        <h3 className="font-semibold">{portal ? "Sign in to view your vehicles" : "Sign in to your shop"}</h3>
        <p className="text-sm text-muted mt-1">
          {portal ? "Use the email your shop has on file." : "Staff accounts are managed in Settings → Users."}
        </p>
      </div>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@shop.com" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••" />
      </div>
      {state?.error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{state.error}</p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        <LogIn size={16} /> {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
