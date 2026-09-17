import { CheckCircle2 } from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata = { title: { absolute: "Contact / request a demo — NexDrive Automotive OS" } };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-12">
      <div>
        <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">TALK TO NEXDRIVE PRODUCTIONS</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Request a demo</h1>
        <p className="mt-3 text-muted">Tell us about your shop or production line and we&apos;ll walk you through NexDrive on your own data — work orders, approvals, inspections, live floor feeds and the API.</p>
        <ul className="mt-8 space-y-3 text-sm text-muted">
          {["30-minute walkthrough on a screen share", "Migration help for customers, vehicles and parts", "Integration review: gateways, suppliers, accounting", "Hosted or on your own server"].map((t) => <li key={t} className="flex items-start gap-2"><CheckCircle2 size={16} className="text-accent shrink-0 mt-0.5" /> {t}</li>)}
        </ul>
        <p className="mt-8 text-sm text-muted">Prefer to try it yourself? <a href="/signup" className="text-accent hover:underline">Start a free 14-day trial</a> — no card needed.</p>
      </div>
      <div>
        {sent ? (
          <div className="card p-8 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-400" />
            <h2 className="text-xl font-semibold mt-3">Thanks — we&apos;ll be in touch</h2>
            <p className="text-sm text-muted mt-2">Your request is with NexDrive Productions. Expect a reply within one business day.</p>
          </div>
        ) : (
          <ContactForm />
        )}
      </div>
    </div>
  );
}
