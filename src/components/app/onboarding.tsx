import Link from "next/link";
import { differenceInDays } from "date-fns";
import { CheckCircle2, Circle } from "lucide-react";
import { db, currentShopId } from "@/lib/db";
import { rawDb } from "@/lib/db";
import type { ShopSettings } from "@/lib/settings";

/**
 * First-two-weeks checklist on the dashboard: what a new shop needs to do to
 * be fully set up. Disappears when everything is done or the trial is over.
 */
export async function OnboardingChecklist({ settings, role }: { settings: ShopSettings; role: string }) {
  if (!["OWNER", "ADMIN"].includes(role)) return null;
  const shopId = await currentShopId();
  const shop = await rawDb.shop.findUnique({ where: { id: shopId }, select: { createdAt: true, slug: true } });
  if (!shop || differenceInDays(new Date(), shop.createdAt) > 21) return null;
  const manufacturing = settings.modules.includes("jobs");
  const [customers, workOrders, techs, staff, invoices, products, dies, jobs, presses] = await Promise.all([
    db.customer.count(), db.workOrder.count(), db.technician.count({ where: { active: true } }), db.user.count({ where: { role: { not: "CUSTOMER" } } }), db.invoice.count(),
    manufacturing ? db.part.count({ where: { kind: "PRODUCT" } }) : 0, manufacturing ? db.die.count() : 0, manufacturing ? db.productionJob.count() : 0, manufacturing ? db.machine.count() : 0,
  ]);
  const steps = manufacturing ? [
    { done: Boolean(settings.phone && settings.address), label: "Confirm your business type and contact details", href: "/settings?tab=type" },
    { done: Boolean(settings.logoUrl) || settings.accentColor.toLowerCase() !== "#2f7cf6", label: "Add your logo and colour", href: "/settings?tab=branding" },
    { done: presses > 0, label: "Add your presses (or connect the PLC feed)", href: "/production?manage=1" },
    { done: dies > 0, label: "Add your dies with service intervals", href: "/tooling/new" },
    { done: customers > 0, label: "Add or import your customers", href: "/settings?tab=import" },
    { done: products > 0, label: "Add the parts you make", href: "/parts/products/new" },
    { done: techs > 0, label: "Add your operators", href: "/technicians/new" },
    { done: staff > 1, label: "Invite the rest of your staff", href: "/settings?tab=users" },
    { done: jobs > 0, label: "Create your first job", href: "/jobs/new" },
    { done: invoices > 0, label: "Ship and invoice your first order", href: "/shipments" },
  ] : [
    { done: settings.taxRate > 0 || settings.laborRate > 0, label: "Set your labor rate, sales tax and hours", href: "/settings?tab=rates" },
    { done: Boolean(settings.logoUrl) || settings.accentColor.toLowerCase() !== "#2f7cf6", label: "Add your logo and colour", href: "/settings?tab=branding" },
    { done: settings.vertical !== "automotive" || Boolean(settings.phone && settings.address), label: "Confirm your business type and contact details", href: "/settings?tab=type" },
    { done: techs > 0, label: "Add your technicians", href: "/technicians/new" },
    { done: staff > 1, label: "Invite the rest of your staff", href: "/settings?tab=users" },
    { done: customers > 0, label: "Add or import your customers", href: "/settings?tab=import" },
    { done: workOrders > 0, label: "Create your first work order", href: "/work-orders/new" },
    { done: invoices > 0, label: "Send your first invoice", href: "/work-orders" },
    { done: settings.stripeConfigured, label: "Take card payments (Stripe)", href: "/settings?tab=payments" },
    { done: settings.onlineBooking && Boolean(settings.bookingNotes), label: "Share your online booking link", href: "/settings?tab=business" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  return (
    <div className="card p-5 border-accent/40 bg-accent-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Getting {settings.name} set up</div>
          <div className="text-sm text-muted">{doneCount} of {steps.length} done — everything here is under Settings and takes a minute.</div>
        </div>
        <div className="h-2 w-40 rounded-full bg-white/10"><div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
      </div>
      <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            {s.done ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> : <Circle size={16} className="text-faint shrink-0" />}
            {s.done ? <span className="text-muted line-through">{s.label}</span> : <Link href={s.href} className="hover:text-accent">{s.label}</Link>}
          </li>
        ))}
      </ul>
      {shop.slug ? <p className="text-[11px] text-faint mt-3">Booking link: /book/{shop.slug}</p> : null}
    </div>
  );
}
