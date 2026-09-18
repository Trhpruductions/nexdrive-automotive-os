import "server-only";
import { addDays } from "date-fns";
import { rawDb } from "./db";
import { hashPassword } from "./auth";
import { ALL_MODULE_KEYS } from "./constants";
import type { ShopPlan } from "@/generated/prisma/enums";

import { DEFAULT_CANNED_SERVICES, DEFAULT_INSPECTION_TEMPLATE, slugify } from "./defaults";
import { getVertical } from "./verticals";
export { DEFAULT_CANNED_SERVICES, DEFAULT_INSPECTION_TEMPLATE, slugify };

async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 2; await rawDb.shop.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

/**
 * Create a fully working shop: settings, owner login, bays, inspection checklist,
 * canned services. Used by public sign-up, the admin console and the seed.
 */
export async function provisionShop(opts: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  phone?: string | null;
  plan?: ShopPlan;
  trialDays?: number;
  slug?: string;
  /** add this shop as another location of the user who already has this email (no new login) */
  asAdditionalLocation?: boolean;
  /** business type key from src/lib/verticals.ts (default automotive) */
  vertical?: string;
}) {
  const vertical = getVertical(opts.vertical);
  const email = opts.ownerEmail.trim().toLowerCase();
  const existing = await rawDb.user.findUnique({ where: { email } });
  if (existing && !opts.asAdditionalLocation) throw new Error("That email already has a NexDrive login.");
  if (!existing && opts.asAdditionalLocation) throw new Error("No NexDrive login exists for that email yet.");
  const slug = await uniqueSlug(opts.slug ?? slugify(opts.name));
  const plan = opts.plan ?? "TRIAL";
  const shop = await rawDb.shop.create({
    data: {
      name: opts.name.trim(),
      slug,
      plan,
      status: plan === "TRIAL" ? "TRIAL" : "ACTIVE",
      trialEndsAt: plan === "TRIAL" ? addDays(new Date(), opts.trialDays ?? 14) : null,
      ownerEmail: email,
      settings: { create: { name: opts.name.trim(), tagline: vertical.key === "automotive" ? "Automotive Service Center" : vertical.label, phone: opts.phone ?? null, email, vertical: vertical.key, modules: ALL_MODULE_KEYS.filter((m) => !vertical.modulesOff.includes(m)) } },
      bays: { create: [{ name: "Bay 1" }, { name: "Bay 2" }] },
      templateItems: { create: vertical.inspection.flatMap(([category, items], ci) => items.map((name, i) => ({ category, name, sortOrder: ci * 100 + i }))) },
      cannedServices: { create: vertical.cannedServices },
    },
  });
  const user = existing
    ? (await rawDb.shopMember.create({ data: { userId: existing.id, shopId: shop.id, role: "OWNER" } }), existing)
    : await rawDb.user.create({ data: { shopId: shop.id, email, name: opts.ownerName.trim(), role: "OWNER", passwordHash: await hashPassword(opts.password) } });
  await rawDb.auditLog.create({ data: { shopId: shop.id, userId: user.id, action: "provision", entity: "Shop", entityId: shop.id, detail: `${shop.name} (${plan})` } });
  return { shop, user };
}
