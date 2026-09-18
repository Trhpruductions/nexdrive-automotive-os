"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { rawDb, withShop } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** Public pay link → Stripe Checkout for the remaining balance. */
export async function payByToken(token: string) {
  const wait = rateLimit(`pay:${await clientIp()}`, 20, 60 * 60);
  if (wait) redirect(`/pay/${token}?error=Too+many+attempts%2C+try+again+later`);
  const inv = await rawDb.invoice.findUnique({ where: { payToken: token }, include: { customer: { select: { email: true } } } });
  if (!inv) redirect("/");
  const balance = Math.round((Number(inv.total) - Number(inv.amountPaid)) * 100) / 100;
  if (inv.status === "VOID" || balance <= 0) redirect(`/pay/${token}`);
  const h = await headers();
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  let url: string;
  try {
    url = await withShop(inv.shopId, () => createCheckoutSession({ shopId: inv.shopId, invoiceId: inv.id, invoiceNumber: inv.number, amount: balance, customerEmail: inv.customer.email, successUrl: `${base}/pay/${token}?paid=1`, cancelUrl: `${base}/pay/${token}?cancelled=1` }));
  } catch (e) {
    redirect(`/pay/${token}?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not start payment")}`);
  }
  redirect(url);
}
