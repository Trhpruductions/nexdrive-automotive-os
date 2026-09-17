import Link from "next/link";
import { Check } from "lucide-react";

export const metadata = { title: { absolute: "Pricing — NexDrive Automotive OS" } };

const PLANS = [
  {
    name: "Starter",
    price: "$99",
    per: "/month",
    blurb: "Independent shops getting organised.",
    cta: "Start free trial",
    href: "/signup",
    features: ["Up to 3 staff logins", "Work orders, estimates, invoices, payments", "Customer portal & online approvals", "Scheduling with bays", "Parts & inventory with barcode scanning", "Digital inspections", "Email support"],
  },
  {
    name: "Pro",
    price: "$249",
    per: "/month",
    blurb: "Busy shops and multi-bay service departments.",
    cta: "Start free trial",
    href: "/signup",
    highlight: true,
    features: ["Unlimited staff logins", "Everything in Starter", "NexDrive AI assistant", "Reports & technician performance", "Production floor: MQTT, webhook, REST & CSV feeds", "Developer API keys & outbound webhooks", "SMS & email notifications (bring your provider)", "Priority support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    blurb: "Groups, dealers and manufacturers with production lines.",
    cta: "Talk to us",
    href: "/contact",
    features: ["Multiple locations", "Everything in Pro", "Onboarding & data migration", "Custom integrations (MES / ERP / DMS)", "SSO and audit exports", "Dedicated success manager", "SLA"],
  },
];

const FAQ = [
  ["Do I need a card for the trial?", "No. Sign up, use every module for 14 days, and pick a plan when you're ready. Your data stays if you continue."],
  ["Can I bring my own branding?", "Yes — logo, accent colour, portal text, invoice footer, rates, bays, checklist and canned services are all yours to set under Settings."],
  ["How do machines connect?", "Through any PLC / IoT gateway that speaks MQTT or can POST JSON, plus REST and CSV polling for MES, ERP and supplier feeds. There is a mapping layer for non-standard payloads."],
  ["Can I export or connect my data?", "Every plan includes printable documents; Pro and Enterprise add the REST API and signed webhooks for accounting, CRM and other software."],
  ["Is it hosted or on-premise?", "Both. NexDrive Productions hosts it, or it runs on your own server with Docker — same software."],
];

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">PRICING</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Simple plans, every module included in the trial</h1>
        <p className="mt-3 text-muted">Per shop, per month. Switch plans any time from the admin console.</p>
      </div>
      <div className="mt-12 grid md:grid-cols-3 gap-5 items-stretch">
        {PLANS.map((p) => (
          <div key={p.name} className={`card p-6 flex flex-col ${p.highlight ? "border-accent shadow-[0_30px_80px_-40px_rgba(47,124,246,0.8)]" : ""}`}>
            {p.highlight ? <span className="self-start rounded-full bg-accent text-white text-[10px] font-bold tracking-wider px-2 py-0.5 mb-3">MOST POPULAR</span> : null}
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="text-sm text-muted mt-1">{p.blurb}</p>
            <div className="mt-5 flex items-baseline gap-1"><span className="text-4xl font-semibold">{p.price}</span><span className="text-muted">{p.per}</span></div>
            <ul className="mt-5 space-y-2 text-sm flex-1">
              {p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check size={15} className="text-emerald-400 mt-0.5 shrink-0" /> <span className="text-muted">{f}</span></li>)}
            </ul>
            <Link href={p.href} className={`btn mt-6 py-3 ${p.highlight ? "btn-primary" : "btn-secondary"}`}>{p.cta}</Link>
          </div>
        ))}
      </div>
      <p className="text-xs text-faint text-center mt-6">Prices in USD. Email/SMS delivery uses your own Resend / Twilio accounts; NexDrive AI usage is billed to your own Anthropic key.</p>

      <section className="mt-20 max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
        <dl className="mt-6 divide-y divide-white/5">
          {FAQ.map(([q, a]) => (
            <div key={q} className="py-4">
              <dt className="font-medium">{q}</dt>
              <dd className="text-sm text-muted mt-1">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
