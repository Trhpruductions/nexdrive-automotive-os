import Image from "next/image";
import Link from "next/link";
import { VERTICALS } from "@/lib/verticals";
import { ArrowRight, Bot, Calendar, Check, ClipboardCheck, ClipboardList, FileText, Package, Radio, Receipt, Settings2, Users, Webhook } from "lucide-react";

export const metadata = {
  title: { absolute: "NexDrive Automotive OS — complete automotive business management software" },
  description: "Work orders, estimates with online approval, invoicing, digital inspections, scheduling, parts & inventory, customer portal, AI assistant and live production feeds — tailored to your shop.",
};

const FEATURES = [
  { Icon: ClipboardList, title: "Work Orders", text: "Complaint → diagnosis → estimate → approval → repair → inspection → invoice, with technician time and bay tracking." },
  { Icon: FileText, title: "Estimates", text: "Build quotes from canned services and your parts list. Customers approve line-by-line from a text or email link." },
  { Icon: Receipt, title: "Invoices & Payments", text: "Accurate tax, parts consumed from stock, printable invoices, balances and payment history." },
  { Icon: ClipboardCheck, title: "Digital Inspections", text: "Tablet checklist with green / amber / red findings and photos that go straight to the customer." },
  { Icon: Calendar, title: "Scheduling", text: "Day and week views, bays and technicians, double-booking checks, portal booking requests." },
  { Icon: Package, title: "Parts & Inventory", text: "Reorder alerts, suppliers, barcode scanning, supplier price/stock feeds." },
  { Icon: Users, title: "Customer Portal", text: "Customers see their vehicles, approve estimates, message the shop, view invoices and history." },
  { Icon: Bot, title: "NexDrive AI", text: "Ask about overdue vehicles, revenue, open approvals — or have it draft an estimate." },
  { Icon: Radio, title: "Production Floor", text: "Live machine status, counts and alarms from lifts, aligners, lathes and lines over MQTT or webhooks." },
];

const STEPS = [
  { n: "1", title: "Create your shop", text: "Two minutes: shop name, your login, done. Every module is on from day one." },
  { n: "2", title: "Make it yours", text: "Logo and colours, tax and labor rates, hours, bays, technicians, inspection checklist, canned services." },
  { n: "3", title: "Run the day", text: "Book, check in, estimate, get approval on the customer's phone, repair, invoice, get paid." },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_30%_-10%,rgba(47,124,246,0.22),transparent_60%),radial-gradient(700px_400px_at_90%_10%,rgba(47,124,246,0.10),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10 lg:pt-24 grid lg:grid-cols-[1fr_1.15fr] gap-10 items-center">
          <div>
            <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">NEXDRIVE AUTOMOTIVE OS</p>
            <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">Complete automotive business management software</h1>
            <p className="mt-5 text-lg text-muted max-w-xl">Everything a repair shop, dealership service department or performance garage needs to run the day — from the first phone call to the paid invoice — in one dark, fast, tablet-ready system that adapts to how <em>you</em> work.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary py-3 px-5 text-base">Start free 14-day trial <ArrowRight size={16} /></Link>
              <Link href="/contact" className="btn btn-secondary py-3 px-5 text-base">Request a demo</Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {["No card needed", "Your data, your branding", "Cancel anytime"].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={14} className="text-emerald-400" /> {t}</li>)}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-accent/10 blur-2xl" />
            <Image src="/marketing/dashboard.webp" alt="NexDrive Automotive OS dashboard" width={1186} height={666} priority className="relative rounded-xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(47,124,246,0.5)]" />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[["Work orders → paid", "in one flow"], ["Approve on the phone", "line-by-line estimates"], ["Live floor feeds", "MQTT · webhooks · REST · CSV"], ["Open API", "keys, scopes, webhooks"]].map(([a, b]) => (
            <div key={a}><div className="font-semibold">{a}</div><div className="text-xs text-muted">{b}</div></div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">EVERYTHING IN ONE OS</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Built for the whole shop, not just the front counter</h2>
          <p className="mt-3 text-muted">Owners, service advisors, technicians and customers each get the screens they need — desktop, tablet at the lift, phone in the parking lot.</p>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 hover:border-accent/40 transition-colors">
              <span className="h-10 w-10 rounded-xl bg-accent-soft text-accent grid place-items-center"><f.Icon size={20} /></span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product shots */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 grid lg:grid-cols-3 gap-6 items-stretch">
        <div className="card p-6 lg:col-span-2 flex flex-col sm:flex-row gap-6 items-center">
          <Image src="/marketing/tablet.webp" alt="Digital vehicle inspection on a tablet" width={340} height={320} className="rounded-lg border border-white/10 w-full max-w-[300px]" />
          <div>
            <h3 className="text-xl font-semibold">Inspections customers actually read</h3>
            <p className="mt-2 text-muted text-sm leading-relaxed">Technicians tap through the checklist at the vehicle, add measurements and photos, and the report lands on the customer&apos;s portal and estimate — with a colour-coded car diagram, not a clipboard.</p>
          </div>
        </div>
        <div className="card p-6 flex flex-col items-center text-center">
          <Image src="/marketing/phone.webp" alt="NexDrive on a phone" width={254} height={542} className="rounded-2xl border border-white/10 w-40" />
          <h3 className="mt-4 font-semibold">Runs on any phone</h3>
          <p className="mt-1 text-sm text-muted">Same OS, same data, sized for a service advisor walking the lot.</p>
        </div>
      </section>

      {/* Tailoring */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">TAILOR IT TO YOUR BUSINESS</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your shop&apos;s name on the door — and on every screen</h2>
            <p className="mt-3 text-muted">NexDrive is white-label by design. Every shop controls its own branding, rates, workflow and modules, so it feels like software you built rather than software you rent.</p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-2 text-sm">
              {["Logo, accent colour, portal welcome text", "Tax, labor and shop-supply rates", "Bays, lifts and technicians", "Inspection checklist — your points, your order", "Canned services with parts", "Turn modules on or off for your team", "Staff roles: owner, admin, advisor, technician", "Notification text on estimates and invoices"].map((t) => (
                <li key={t} className="flex items-start gap-2 text-muted"><Settings2 size={14} className="mt-0.5 text-accent shrink-0" /> {t}</li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["#2f7cf6", "Plex Roswell Automotive"], ["#f97316", "Demo Tire & Lube"], ["#22c55e", "Greenline Fleet Service"], ["#a855f7", "Velocity Performance"]].map(([c, n]) => (
              <div key={n} className="card p-4" style={{ borderColor: `${c}55` }}>
                <div className="flex items-center gap-2"><span className="h-6 w-6 rounded-md" style={{ background: c }} /><span className="text-sm font-semibold truncate">{n}</span></div>
                <div className="mt-3 h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full w-2/3" style={{ background: c }} /></div>
                <div className="mt-2 grid grid-cols-3 gap-1">{[0, 1, 2].map((i) => <div key={i} className="h-6 rounded bg-white/5" />)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business types */}
      <section id="business-types" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">NOT JUST CARS</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Built for automotive. Ready for whatever rolls, floats or plugs in.</h2>
        <p className="mt-3 text-muted max-w-2xl">Pick your business type at sign-up and NexDrive speaks your language — Vessel and hull ID for a marina, Serial / IMEI for a device shop, run hours for a production floor — with a matching inspection checklist and service packages. Change it any time in Settings.</p>
        <ul className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VERTICALS.map((v) => (
            <li key={v.key} className="card p-4">
              <div className="font-semibold">{v.label}</div>
              <div className="text-sm text-muted mt-1">{v.blurb}</div>
              <div className="text-[11px] text-faint mt-2">{v.terms.assets} · {v.terms.serial}{v.terms.odometer ? ` · ${v.terms.odometer}` : ""}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Integrations */}
      <section id="integrations" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">PLUGS INTO YOUR FLOOR AND YOUR TOOLS</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Live feeds from machines, suppliers and other software</h2>
            <p className="mt-3 text-muted">Lifts, aligners, brake lathes, presses and full production lines report status, counts and alarms into NexDrive in real time. Supplier stock and price files keep inventory honest. Anything else connects through the API.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ["MQTT", "PLC / IoT gateways publish, NexDrive subscribes (topic wildcards, field mapping)."],
                ["Webhooks in", "Any system that can POST JSON, with per-integration keys."],
                ["REST & CSV polling", "MES, ERP and supplier stock/price endpoints on a schedule."],
                ["Barcode scanning", "Receive and pull stock with any USB or Bluetooth scanner."],
              ].map(([t, d]) => <div key={t} className="card p-4"><div className="font-semibold flex items-center gap-2"><Radio size={14} className="text-accent" /> {t}</div><p className="text-muted mt-1">{d}</p></div>)}
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center gap-2 font-semibold"><Webhook size={16} className="text-accent" /> Developer API &amp; webhooks</div>
            <p className="text-sm text-muted mt-2">Scoped API keys (read / write / ingest) for accounting, CRMs, parts suppliers and kiosks. Signed webhooks tell other software when work orders move, invoices are paid or a machine goes down.</p>
            <pre className="mt-4 rounded-lg bg-black/40 border border-white/10 p-4 text-[11px] leading-relaxed overflow-x-auto text-text/90">{`POST /api/v1/work-orders
Authorization: Bearer nd_live_…

{ "vehicleId": "…", "complaint": "Brakes grinding",
  "lines": [ { "kind": "LABOR", "description": "Front brakes", "hours": 2 },
             { "kind": "PART",  "description": "Pads", "unitPrice": 89.99 } ] }

→ 201 { "number": 1042, "status": "ESTIMATE", "totals": { "total": 366.29 } }`}</pre>
            <p className="text-xs text-faint mt-3">Every endpoint is documented inside the app under Settings → API &amp; Webhooks.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-center">Up and running today</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-6">
                <span className="h-9 w-9 rounded-full bg-accent text-white grid place-items-center font-bold">{s.n}</span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl border border-accent/30 p-10 text-center">
          <Image src="/marketing/garage.webp" alt="" fill className="object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#05070c] via-[#05070c]/80 to-accent/20" />
          <div className="relative">
            <p className="text-[11px] tracking-[0.35em] text-accent font-semibold">TECHNOLOGY BUILT FOR THE AUTOMOTIVE INDUSTRY</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">Give your shop an operating system</h2>
            <p className="mt-3 text-muted max-w-xl mx-auto">Start a free trial with every module enabled, or book a walkthrough with NexDrive Productions.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="btn btn-primary py-3 px-5 text-base">Start free trial</Link>
              <Link href="/pricing" className="btn btn-secondary py-3 px-5 text-base">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
