import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Choose a new password" subtitle="At least 8 characters. You'll be signed out everywhere else.">
      {token ? <ResetForm token={token} /> : <p className="card p-5 text-sm text-red-400">This link is missing its token. <Link href="/forgot-password" className="text-accent hover:underline">Request a new one</Link>.</p>}
    </AuthShell>
  );
}
