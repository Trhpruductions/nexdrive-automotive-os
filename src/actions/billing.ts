"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { createBillingPortal, createSubscriptionCheckout, platformBillingConfigured } from "@/lib/billing";
import type { ShopPlan } from "@/generated/prisma/enums";

/** Owner of the shop (suspended shops allowed — that's the point of the billing page). */
async function requireOwner() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "OWNER" && user.role !== "SUPERADMIN") redirect("/dashboard?denied=1");
  if (!user.activeShopId) redirect("/admin");
  return user;
}

async function base() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function subscribe(plan: ShopPlan) {
  const user = await requireOwner();
  if (!platformBillingConfigured()) redirect("/billing?error=Self-service+billing+is+not+enabled");
  const b = await base();
  let url: string;
  try {
    url = await createSubscriptionCheckout({ shopId: user.activeShopId!, plan, email: user.email, successUrl: `${b}/billing?subscribed=1`, cancelUrl: `${b}/billing?cancelled=1` });
  } catch (e) {
    redirect(`/billing?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not start checkout")}`);
  }
  redirect(url);
}

export async function manageBilling() {
  const user = await requireOwner();
  const b = await base();
  let url: string;
  try {
    url = await createBillingPortal(user.activeShopId!, `${b}/billing`);
  } catch (e) {
    redirect(`/billing?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not open billing portal")}`);
  }
  redirect(url);
}
