"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays } from "date-fns";
import { rawDb } from "@/lib/db";
import { createSession, requireSuperadmin, setActiveShop } from "@/lib/auth";
import { provisionShop } from "@/lib/provision";
import type { ShopPlan, ShopStatus } from "@/generated/prisma/enums";

export type SignupState = { error?: string } | undefined;

const SignupSchema = z.object({
  shopName: z.string().trim().min(2, "Enter your shop name").max(80),
  ownerName: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Public sign-up: creates the shop + owner login and signs them in (14-day trial). */
export async function signup(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  let user;
  try {
    ({ user } = await provisionShop({ name: d.shopName, ownerName: d.ownerName, ownerEmail: d.email, password: d.password, phone: d.phone || null }));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the shop" };
  }
  await createSession(user);
  redirect("/dashboard?welcome=1");
}

/** Public website: demo / contact request. */
export async function requestDemo(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter your name and a valid email" };
  await rawDb.lead.create({ data: { name, email, shopName: String(formData.get("shopName") ?? "").trim() || null, phone: String(formData.get("phone") ?? "").trim() || null, message: String(formData.get("message") ?? "").trim() || null, source: String(formData.get("source") ?? "website") } });
  redirect("/contact?sent=1");
}

// ───────── Super-admin console ─────────

const back = (msg: string, err = false): never => redirect(`/admin?${err ? "error" : "ok"}=${encodeURIComponent(msg)}`);

export async function adminCreateShop(formData: FormData) {
  await requireSuperadmin();
  const name = String(formData.get("name") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const plan = String(formData.get("plan") ?? "TRIAL") as ShopPlan;
  if (!name || !ownerName || !ownerEmail || password.length < 8) back("Name, owner, email and an 8+ character password are required", true);
  try {
    const { shop } = await provisionShop({ name, ownerName, ownerEmail, password, plan });
    revalidatePath("/admin");
    back(`${shop.name} created (${shop.slug})`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    back(e instanceof Error ? e.message : "Could not create shop", true);
  }
}

export async function adminUpdateShop(id: string, formData: FormData) {
  await requireSuperadmin();
  const plan = String(formData.get("plan") ?? "") as ShopPlan;
  const status = String(formData.get("status") ?? "") as ShopStatus;
  const trialRaw = String(formData.get("trialEndsAt") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  await rawDb.shop.update({ where: { id }, data: { ...(name ? { name } : {}), plan, status, trialEndsAt: trialRaw ? new Date(trialRaw) : null, notes } });
  revalidatePath("/admin");
  back("Shop updated");
}

export async function adminExtendTrial(id: string, days: number) {
  await requireSuperadmin();
  const shop = await rawDb.shop.findUniqueOrThrow({ where: { id } });
  const base = shop.trialEndsAt && shop.trialEndsAt > new Date() ? shop.trialEndsAt : new Date();
  await rawDb.shop.update({ where: { id }, data: { trialEndsAt: addDays(base, days), status: shop.status === "SUSPENDED" ? "TRIAL" : shop.status } });
  revalidatePath("/admin");
  back(`Trial extended by ${days} days`);
}

export async function adminOpenShop(id: string) {
  await requireSuperadmin();
  const shop = await rawDb.shop.findUnique({ where: { id } });
  if (!shop) back("Shop not found", true);
  await setActiveShop(id);
  redirect("/dashboard");
}

export async function adminCloseShop() {
  await requireSuperadmin();
  await setActiveShop(null);
  redirect("/admin");
}

export async function adminDeleteShop(id: string, formData: FormData) {
  await requireSuperadmin();
  const shop = await rawDb.shop.findUniqueOrThrow({ where: { id } });
  if (String(formData.get("confirm") ?? "") !== shop.slug) back(`Type the slug "${shop.slug}" to confirm deletion`, true);
  await rawDb.shop.delete({ where: { id } });
  revalidatePath("/admin");
  back(`${shop.name} and all of its data were deleted`);
}

export async function adminResetOwnerPassword(id: string, formData: FormData) {
  await requireSuperadmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) back("Password must be at least 8 characters", true);
  const owner = await rawDb.user.findFirst({ where: { shopId: id, role: "OWNER" }, orderBy: { createdAt: "asc" } });
  if (!owner) return back("This shop has no owner login", true);
  const { hashPassword } = await import("@/lib/auth");
  await rawDb.user.update({ where: { id: owner.id }, data: { passwordHash: await hashPassword(password), active: true } });
  back(`Password reset for ${owner.email}`);
}

export async function markLeadHandled(id: string) {
  await requireSuperadmin();
  const lead = await rawDb.lead.findUniqueOrThrow({ where: { id } });
  await rawDb.lead.update({ where: { id }, data: { handled: !lead.handled } });
  revalidatePath("/admin/leads");
  redirect("/admin/leads");
}
