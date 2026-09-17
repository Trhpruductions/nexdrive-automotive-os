import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter the email on your account and we'll send a one-hour reset link.">
      <ForgotForm />
      <p className="text-sm text-muted mt-5 text-center"><Link href="/login" className="text-accent hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
