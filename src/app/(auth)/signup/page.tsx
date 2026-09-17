import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your free trial" };

export default async function SignupPage() {
  const user = await getSession();
  if (user) redirect(user.role === "CUSTOMER" ? "/portal" : user.role === "SUPERADMIN" ? "/admin" : "/dashboard");

  return (
    <main className="app-canvas min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_20%_20%,rgba(47,124,246,0.18),transparent_60%)]" />
        <Link href="/" className="relative"><Image src="/brand/logo-full.png" alt="NexDrive Productions" width={260} height={185} priority /></Link>
        <div className="relative max-w-md">
          <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">14-DAY FREE TRIAL</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your shop, running on NexDrive in two minutes</h1>
          <ul className="mt-6 space-y-2 text-sm text-muted">
            {["Work orders, estimates and invoices from day one", "Customer portal with online estimate approval", "Digital inspections, scheduling, parts & inventory", "Your branding, rates, bays and checklist — all yours to tailor", "No card required for the trial"].map((f) => (
              <li key={f} className="flex items-start gap-2"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />{f}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs tracking-[0.25em] text-faint">TECHNOLOGY BUILT FOR THE AUTOMOTIVE INDUSTRY</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center"><Image src="/brand/logo-full.png" alt="NexDrive" width={180} height={128} priority /></div>
          <h2 className="text-xl font-semibold">Create your shop</h2>
          <p className="text-sm text-muted mt-1 mb-5">You&apos;ll be the owner account. Add staff later under Settings.</p>
          <SignupForm />
          <p className="text-sm text-muted mt-5 text-center">Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
