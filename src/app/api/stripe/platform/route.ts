import { NextResponse, type NextRequest } from "next/server";
import { rawDb } from "@/lib/db";
import { verifyStripeSignature } from "@/lib/stripe";
import type { ShopPlan } from "@/generated/prisma/enums";

export const runtime = "nodejs";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      mode?: string;
      customer?: string | null;
      subscription?: string | null;
      client_reference_id?: string | null;
      metadata?: Record<string, string>;
      // invoice
      period_end?: number;
      lines?: { data?: { period?: { end?: number } }[] };
      // subscription
      status?: string;
      current_period_end?: number;
      items?: { data?: { price?: { id?: string } }[] };
    };
  };
};

const PLANS = new Set<ShopPlan>(["STARTER", "PRO", "ENTERPRISE"]);

/**
 * NexDrive's own Stripe webhook (subscriptions). Events:
 *   checkout.session.completed → activate the shop on the chosen plan
 *   invoice.paid               → ACTIVE, extend currentPeriodEnd
 *   invoice.payment_failed     → PAST_DUE (banner in the app, Stripe retries)
 *   customer.subscription.deleted → SUSPENDED (owner can re-subscribe)
 *   customer.subscription.updated → keep plan/period in step
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_PLATFORM_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Platform billing is not configured" }, { status: 404 });
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as StripeEvent;
  const o = event.data.object;
  const planFromMeta = (m?: Record<string, string>) => (m?.plan && PLANS.has(m.plan as ShopPlan) ? (m.plan as ShopPlan) : undefined);
  const planFromPrice = (priceId?: string) => (priceId && priceId === process.env.STRIPE_PRICE_PRO ? "PRO" : priceId && priceId === process.env.STRIPE_PRICE_STARTER ? "STARTER" : undefined);

  switch (event.type) {
    case "checkout.session.completed": {
      if (o.mode !== "subscription") break;
      const shopId = o.metadata?.shopId ?? o.client_reference_id;
      if (!shopId) break;
      const plan = planFromMeta(o.metadata) ?? "STARTER";
      const r = await rawDb.shop.updateMany({ where: { id: shopId }, data: { plan, status: "ACTIVE", trialEndsAt: null, stripeCustomerId: o.customer ?? undefined, stripeSubscriptionId: o.subscription ?? undefined } });
      if (!r.count) return NextResponse.json({ received: true, ignored: "unknown shop" });
      await rawDb.auditLog.create({ data: { shopId, action: "subscribed", entity: "Shop", entityId: shopId, detail: plan } });
      break;
    }
    case "invoice.paid": {
      if (!o.customer) break;
      const end = o.lines?.data?.[0]?.period?.end ?? o.period_end;
      await rawDb.shop.updateMany({ where: { stripeCustomerId: o.customer }, data: { status: "ACTIVE", ...(end ? { currentPeriodEnd: new Date(end * 1000) } : {}) } });
      break;
    }
    case "invoice.payment_failed": {
      if (!o.customer) break;
      await rawDb.shop.updateMany({ where: { stripeCustomerId: o.customer, status: { in: ["ACTIVE", "TRIAL"] } }, data: { status: "PAST_DUE" } });
      break;
    }
    case "customer.subscription.updated": {
      if (!o.customer) break;
      const plan = planFromMeta(o.metadata) ?? planFromPrice(o.items?.data?.[0]?.price?.id);
      const active = o.status === "active" || o.status === "trialing";
      await rawDb.shop.updateMany({ where: { stripeCustomerId: o.customer }, data: { stripeSubscriptionId: o.id, ...(plan ? { plan } : {}), ...(o.current_period_end ? { currentPeriodEnd: new Date(o.current_period_end * 1000) } : {}), ...(active ? { status: "ACTIVE" } : o.status === "past_due" || o.status === "unpaid" ? { status: "PAST_DUE" } : {}) } });
      break;
    }
    case "customer.subscription.deleted": {
      if (!o.customer) break;
      const shops = await rawDb.shop.findMany({ where: { stripeCustomerId: o.customer }, select: { id: true } });
      await rawDb.shop.updateMany({ where: { stripeCustomerId: o.customer }, data: { status: "SUSPENDED", stripeSubscriptionId: null } });
      for (const s of shops) await rawDb.auditLog.create({ data: { shopId: s.id, action: "subscription_ended", entity: "Shop", entityId: s.id } });
      break;
    }
  }
  return NextResponse.json({ received: true });
}
