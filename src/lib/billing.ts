import "server-only";
import { rawDb } from "./db";
import type { ShopPlan } from "@/generated/prisma/enums";

/**
 * NexDrive's own subscription billing (the platform's Stripe account, set by
 * environment variables). Shops subscribe from /billing; Stripe tells us about
 * renewals and failures on /api/stripe/platform. When the env is not set, plans
 * are managed by hand in the admin console.
 */
export const PAID_PLANS: { plan: ShopPlan; name: string; price: string; priceId: string | undefined; blurb: string }[] = [
  { plan: "STARTER", name: "Starter", price: "$99/mo", priceId: process.env.STRIPE_PRICE_STARTER, blurb: "Up to 3 staff logins, the full shop workflow and customer portal." },
  { plan: "PRO", name: "Pro", price: "$249/mo", priceId: process.env.STRIPE_PRICE_PRO, blurb: "Unlimited staff, NexDrive AI, reports, production feeds, API & webhooks." },
];

export function platformBillingConfigured() {
  return Boolean(process.env.STRIPE_PLATFORM_SECRET_KEY && process.env.STRIPE_PLATFORM_WEBHOOK_SECRET && PAID_PLANS.some((p) => p.priceId));
}

function key() {
  const k = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!k) throw new Error("Platform billing is not configured");
  return k;
}

async function stripe<T>(path: string, params: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: "POST", headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe returned ${res.status}`);
  return json;
}

/** Hosted Checkout for a subscription; the webhook activates the shop afterwards. */
export async function createSubscriptionCheckout(opts: { shopId: string; plan: ShopPlan; email: string; successUrl: string; cancelUrl: string }) {
  const p = PAID_PLANS.find((x) => x.plan === opts.plan);
  if (!p?.priceId) throw new Error("That plan is not available for self-service");
  const shop = await rawDb.shop.findUniqueOrThrow({ where: { id: opts.shopId }, select: { stripeCustomerId: true, name: true } });
  const session = await stripe<{ url: string }>("checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": p.priceId,
    "line_items[0][quantity]": 1,
    client_reference_id: opts.shopId,
    "metadata[shopId]": opts.shopId,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][shopId]": opts.shopId,
    "subscription_data[metadata][plan]": opts.plan,
    ...(shop.stripeCustomerId ? { customer: shop.stripeCustomerId } : { customer_email: opts.email }),
    allow_promotion_codes: "true",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
  return session.url;
}

/** Stripe's customer portal: update card, change plan, cancel. */
export async function createBillingPortal(shopId: string, returnUrl: string) {
  const shop = await rawDb.shop.findUniqueOrThrow({ where: { id: shopId }, select: { stripeCustomerId: true } });
  if (!shop.stripeCustomerId) throw new Error("No subscription on file yet");
  const s = await stripe<{ url: string }>("billing_portal/sessions", { customer: shop.stripeCustomerId, return_url: returnUrl });
  return s.url;
}

/** Trials past their end date are suspended (data kept; owner can subscribe from /billing). Returns count. */
export async function expireTrials() {
  const r = await rawDb.shop.updateMany({ where: { status: "TRIAL", trialEndsAt: { lt: new Date() } }, data: { status: "SUSPENDED" } });
  return r.count;
}
