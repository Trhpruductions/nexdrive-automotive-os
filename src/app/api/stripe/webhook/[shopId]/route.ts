import { NextResponse, type NextRequest } from "next/server";
import { rawDb, withShop } from "@/lib/db";
import { applyPayment } from "@/lib/payments";
import { shopStripeKeys, verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe → NexDrive. Point the shop's Stripe webhook at /api/stripe/webhook/{shopId}
 * with the `checkout.session.completed` event. Signature is checked against the
 * shop's own webhook secret; payments are recorded once per payment intent.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await ctx.params;
  const keys = await shopStripeKeys(shopId);
  if (!keys?.stripeWebhookSecret) return NextResponse.json({ error: "Stripe is not configured for this shop" }, { status: 404 });
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), keys.stripeWebhookSecret)) return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  const event = JSON.parse(raw) as { id: string; type: string; data: { object: { id: string; amount_total?: number; payment_status?: string; payment_intent?: string | null; metadata?: Record<string, string> } } };
  if (event.type !== "checkout.session.completed") return NextResponse.json({ received: true, ignored: event.type });
  const session = event.data.object;
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId || session.metadata?.shopId !== shopId) return NextResponse.json({ received: true, ignored: "no invoice" });
  if (session.payment_status && session.payment_status !== "paid") return NextResponse.json({ received: true, ignored: session.payment_status });
  const reference = session.payment_intent ?? session.id;
  const amount = (session.amount_total ?? 0) / 100;

  const result = await withShop(shopId, async () => {
    const dup = await rawDb.payment.findFirst({ where: { reference, invoice: { shopId } } });
    if (dup) return { duplicate: true };
    const inv = await rawDb.invoice.findFirst({ where: { id: invoiceId, shopId } });
    if (!inv) return { missing: true };
    const balance = Number(inv.total) - Number(inv.amountPaid);
    await applyPayment({ invoiceId, amount: Math.min(amount, balance), method: "CARD", reference, by: "Stripe" });
    return { recorded: true };
  });
  return NextResponse.json({ received: true, ...result });
}
