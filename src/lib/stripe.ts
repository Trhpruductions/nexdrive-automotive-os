import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { rawDb } from "./db";

/**
 * Card payments through each shop's own Stripe account (keys entered under
 * Settings → Payments, stored server-side only). Uses Stripe's REST API directly
 * so there is no SDK to keep in step.
 */
export async function shopStripeKeys(shopId: string) {
  const s = await rawDb.shopSettings.findUnique({ where: { shopId }, select: { stripeSecretKey: true, stripeWebhookSecret: true, name: true, currency: true } });
  if (!s?.stripeSecretKey) return null;
  return s;
}

function encode(params: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) body.set(k, String(v));
  return body;
}

/** Creates a hosted Checkout session for the invoice balance; returns its URL. */
export async function createCheckoutSession(opts: { shopId: string; invoiceId: string; invoiceNumber: number; amount: number; customerEmail?: string | null; successUrl: string; cancelUrl: string }) {
  const keys = await shopStripeKeys(opts.shopId);
  if (!keys) throw new Error("Card payments are not set up for this shop");
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${keys.stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: encode({
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": (keys.currency || "USD").toLowerCase(),
      "line_items[0][price_data][unit_amount]": Math.round(opts.amount * 100),
      "line_items[0][price_data][product_data][name]": `Invoice INV-${String(opts.invoiceNumber).padStart(5, "0")} — ${keys.name}`,
      "metadata[invoiceId]": opts.invoiceId,
      "metadata[shopId]": opts.shopId,
      "payment_intent_data[metadata][invoiceId]": opts.invoiceId,
      "payment_intent_data[description]": `INV-${String(opts.invoiceNumber).padStart(5, "0")} at ${keys.name}`,
      customer_email: opts.customerEmail ?? undefined,
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
    }),
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) throw new Error(json.error?.message ?? "Stripe rejected the request");
  return json.url;
}

/** Verifies a Stripe-Signature header (t=…,v1=…) against the raw body. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Quick credentials check used by the settings page. */
export async function testStripeKey(secretKey: string) {
  const res = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${secretKey}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(j.error?.message ?? `Stripe returned ${res.status}`);
  }
  const j = (await res.json()) as { livemode?: boolean };
  return { livemode: Boolean(j.livemode) };
}
