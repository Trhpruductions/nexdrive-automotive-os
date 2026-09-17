import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, CreditCard, ExternalLink } from "lucide-react";
import { getSession } from "@/lib/auth";
import { rawDb } from "@/lib/db";
import { PAID_PLANS, platformBillingConfigured } from "@/lib/billing";
import { manageBilling, subscribe } from "@/actions/billing";
import { logout } from "@/actions/auth";
import { Badge } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Billing & plan" };

const STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" | "blue" }> = {
  TRIAL: { label: "Free trial", tone: "blue" },
  ACTIVE: { label: "Active", tone: "green" },
  PAST_DUE: { label: "Payment failed", tone: "amber" },
  SUSPENDED: { label: "Suspended", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
};

/** Owner-facing plan & subscription page. Reachable even when the shop is suspended. */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ subscribed?: string; cancelled?: string; error?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "CUSTOMER") redirect("/portal");
  if (!user.activeShopId) redirect("/admin");
  const owner = user.role === "OWNER" || user.role === "SUPERADMIN";
  const sp = await searchParams;
  const shop = await rawDb.shop.findUniqueOrThrow({ where: { id: user.activeShopId }, include: { settings: { select: { name: true, logoUrl: true } }, _count: { select: { users: true } } } });
  const selfService = platformBillingConfigured();
  const st = STATUS[shop.status] ?? STATUS.TRIAL;
  const blocked = shop.status === "SUSPENDED" || shop.status === "CANCELLED";

  return (
    <main className="app-canvas min-h-screen py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {shop.settings?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shop.settings.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover bg-bg-elevated" />
            ) : (
              <Image src="/brand/mark.png" alt="" width={40} height={40} />
            )}
            <div>
              <h1 className="text-xl font-semibold leading-tight">Billing &amp; plan</h1>
              <p className="text-xs text-muted">{shop.settings?.name ?? shop.name}</p>
            </div>
          </div>
          {blocked ? <form action={logout}><button className="btn btn-ghost btn-sm">Sign out</button></form> : <Link href="/dashboard" className="btn btn-ghost btn-sm"><ArrowLeft size={14} /> Back to NexDrive</Link>}
        </div>

        {sp.subscribed ? <p className="mb-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">Thanks — your subscription is active. It can take a few seconds for the plan below to update.</p> : null}
        {sp.cancelled ? <p className="mb-4 text-sm text-muted bg-bg-elevated border border-border rounded-lg px-3 py-2">Checkout cancelled — nothing was charged.</p> : null}
        {sp.error ? <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{sp.error}</p> : null}

        <div className="card p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="card-title mb-1">Current plan</div>
              <div className="text-2xl font-semibold">{shop.plan === "TRIAL" ? "Free trial" : shop.plan[0] + shop.plan.slice(1).toLowerCase()}</div>
              <div className="text-sm text-muted mt-1">
                {shop.status === "TRIAL" && shop.trialEndsAt ? (shop.trialEndsAt > new Date() ? `Trial ends ${fmtDate(shop.trialEndsAt)}` : "Trial has ended") : null}
                {shop.status === "ACTIVE" && shop.currentPeriodEnd ? `Renews ${fmtDate(shop.currentPeriodEnd)}` : null}
                {shop.status === "PAST_DUE" ? "Your last payment failed — update your card to keep access." : null}
                {blocked ? "Your data is safe. Choose a plan below to get back in." : null}
              </div>
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted flex flex-wrap gap-4">
            <span>{shop._count.users} user{shop._count.users === 1 ? "" : "s"}</span>
            <span>Shop ID {shop.id}</span>
            {shop.stripeSubscriptionId ? <span>Subscription on file</span> : null}
          </div>
        </div>

        {!owner ? (
          <p className="text-sm text-muted">Only the shop owner can change the plan.</p>
        ) : selfService ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              {PAID_PLANS.map((p) => {
                const current = shop.plan === p.plan && shop.status === "ACTIVE";
                return (
                  <div key={p.plan} className={`card p-6 flex flex-col ${current ? "border-accent" : ""}`}>
                    <div className="flex items-center justify-between"><h2 className="font-semibold text-lg">{p.name}</h2>{current ? <Badge tone="green"><BadgeCheck size={12} /> Current</Badge> : null}</div>
                    <div className="text-2xl font-semibold mt-1">{p.price}</div>
                    <p className="text-sm text-muted mt-2 flex-1">{p.blurb}</p>
                    {!current ? (
                      <form action={subscribe.bind(null, p.plan)} className="mt-5">
                        <button className="btn btn-primary w-full" disabled={!p.priceId}><CreditCard size={15} /> {shop.stripeSubscriptionId ? `Switch to ${p.name}` : `Subscribe to ${p.name}`}</button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {shop.stripeCustomerId ? (
              <form action={manageBilling} className="mt-6">
                <button className="btn btn-secondary"><ExternalLink size={15} /> Manage card, invoices &amp; cancellation</button>
              </form>
            ) : null}
            <p className="text-xs text-faint mt-6">Payments are handled by Stripe. Need Enterprise (multiple locations, custom integrations)? <Link href="/contact" className="text-accent hover:underline">Talk to us</Link>.</p>
          </>
        ) : (
          <div className="card p-6">
            <h2 className="font-semibold">Plans are set up by NexDrive</h2>
            <p className="text-sm text-muted mt-2">Self-service billing isn&apos;t switched on for this installation. To start or change a subscription, <Link href="/contact" className="text-accent hover:underline">contact NexDrive</Link>{blocked ? " — your data is kept while the account is suspended." : "."}</p>
            <ul className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
              {PAID_PLANS.map((p) => <li key={p.plan} className="rounded-lg border border-border p-3"><div className="font-medium">{p.name} · {p.price}</div><div className="text-muted text-xs mt-1">{p.blurb}</div></li>)}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
