import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; portal?: string; ok?: string }>;
}) {
  const user = await getSession();
  if (user) redirect(user.role === "CUSTOMER" ? "/portal" : "/dashboard");
  const { next, portal, ok } = await searchParams;
  const s = await getSettings();

  return (
    <main className="app-canvas min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_20%_20%,rgba(47,124,246,0.18),transparent_60%)]" />
        <div className="relative">
          <Image src="/brand/logo-full.png" alt="NexDrive Productions" width={300} height={214} priority />
        </div>
        <div className="relative max-w-md">
          <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">NEXDRIVE AUTOMOTIVE OS</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Complete automotive business management software
          </h1>
          <p className="mt-4 text-muted leading-relaxed">
            Work orders, estimates, invoices, digital inspections, scheduling, parts, a customer portal and an
            AI assistant — tailored to how {s.shopId ? <span className="text-text">{s.name}</span> : "your shop"} runs.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-3 text-sm text-muted">
            {["Work Orders", "Estimates", "Invoices", "Inspections", "Customer Portal", "NexDrive AI"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs tracking-[0.25em] text-faint">TECHNOLOGY BUILT FOR THE AUTOMOTIVE INDUSTRY</p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <Image src="/brand/logo-full.png" alt="NexDrive" width={200} height={142} priority />
          </div>
          <div className="flex items-center gap-3 mb-6">
            {s.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover bg-bg-elevated" />
            ) : (
              <Image src="/brand/mark.png" alt="" width={40} height={40} />
            )}
            <div>
              <h2 className="text-lg font-semibold leading-tight">{s.shopId ? s.name : "NexDrive Automotive OS"}</h2>
              <p className="text-xs text-muted">{portal ? "Customer portal" : s.shopId ? s.tagline : "Sign in to your shop, portal or admin account"}</p>
            </div>
          </div>
          <LoginForm next={next} portal={Boolean(portal)} reset={ok === "1"} />
          {!portal ? <p className="text-sm text-muted mt-5 text-center">New to NexDrive? <Link href="/signup" className="text-accent hover:underline">Start a free 14-day trial</Link></p> : null}
        </div>
      </section>
    </main>
  );
}
