"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, rawDb, currentShopId } from "@/lib/db";
import { hashPassword, requireStaff, MANAGER_ROLES } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { ALL_MODULE_KEYS } from "@/lib/constants";
import type { Role } from "@/generated/prisma/enums";

const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const back = (tab: string, msg: string, err = false): never => redirect(`/settings?tab=${tab}&${err ? "error" : "ok"}=${encodeURIComponent(msg)}`);

function revalidateAll() {
  revalidatePath("/", "layout");
}

// ───────── Branding ─────────
export async function saveBranding(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("branding", "Shop name is required", true);
  const accent = String(formData.get("accentColor") ?? "#2f7cf6");
  const data: Record<string, unknown> = {
    name,
    tagline: String(formData.get("tagline") ?? "").trim() || "Automotive Service Center",
    accentColor: /^#[0-9a-f]{6}$/i.test(accent) ? accent : "#2f7cf6",
    portalWelcome: opt(formData.get("portalWelcome")),
    approvalMessage: opt(formData.get("approvalMessage")),
    invoiceFooter: opt(formData.get("invoiceFooter")),
  };
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const url = await saveUpload(logo, "brand");
    if (!url) back("branding", "Logo must be PNG, JPG, WEBP or SVG under 15MB", true);
    data.logoUrl = url;
  }
  if (formData.get("removeLogo") === "true") data.logoUrl = null;
  await db.shopSettings.update({ where: { shopId: await currentShopId() }, data });
  revalidateAll();
  back("branding", "Branding saved");
}

// ───────── Business ─────────
export async function saveBusiness(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  await db.shopSettings.update({
    where: { shopId: await currentShopId() },
    data: {
      phone: opt(formData.get("phone")),
      email: opt(formData.get("email")),
      website: opt(formData.get("website")),
      address: opt(formData.get("address")),
      city: opt(formData.get("city")),
      state: opt(formData.get("state")),
      zip: opt(formData.get("zip")),
      timezone: String(formData.get("timezone") ?? "America/New_York"),
      currency: String(formData.get("currency") ?? "USD"),
      onlineBooking: formData.has("onlineBooking"),
      bookingNotes: opt(formData.get("bookingNotes")),
      dailyDigest: formData.has("dailyDigest"),
      digestHour: Math.min(23, Math.max(0, Number(formData.get("digestHour")) || 18)),
      smsNumber: opt(formData.get("smsNumber")),
    },
  });
  revalidateAll();
  back("business", "Business details saved");
}

// ───────── Rates & hours ─────────
export async function saveRates(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const taxRate = Number(formData.get("taxRate")) / 100;
  const laborRate = Number(formData.get("laborRate"));
  const shopFeeRate = Number(formData.get("shopFeeRate")) / 100;
  if (!(taxRate >= 0 && taxRate < 1) || !(laborRate >= 0) || !(shopFeeRate >= 0 && shopFeeRate < 1)) back("rates", "Check the rate values", true);
  await db.shopSettings.update({ where: { shopId: await currentShopId() }, data: { taxRate, laborRate, shopFeeRate, openTime: String(formData.get("openTime") ?? "08:00"), closeTime: String(formData.get("closeTime") ?? "18:00") } });
  revalidateAll();
  back("rates", "Rates & hours saved");
}

// ───────── Bays ─────────
export async function addBay(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) back("bays", "Bay name is required", true);
  await db.bay.upsert({ where: { shopId_name: { shopId: await currentShopId(), name } }, update: { active: true }, create: { shopId: await currentShopId(), name } });
  revalidateAll();
  back("bays", `${name} added`);
}

export async function toggleBay(id: string) {
  await requireStaff(MANAGER_ROLES);
  const b = await db.bay.findUniqueOrThrow({ where: { id } });
  await db.bay.update({ where: { id }, data: { active: !b.active } });
  revalidateAll();
  back("bays", `${b.name} ${b.active ? "disabled" : "enabled"}`);
}

export async function deleteBay(id: string) {
  await requireStaff(MANAGER_ROLES);
  await db.bay.delete({ where: { id } });
  revalidateAll();
  back("bays", "Bay removed");
}

// ───────── Modules ─────────
export async function saveModules(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const modules = formData.getAll("modules").map(String).filter((m) => (ALL_MODULE_KEYS as string[]).includes(m));
  await db.shopSettings.update({ where: { shopId: await currentShopId() }, data: { modules } });
  revalidateAll();
  back("modules", "Modules updated");
}

// ───────── Inspection template ─────────
export async function addTemplateItem(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const category = String(formData.get("category") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!category || !name) back("inspection", "Category and item are required", true);
  const count = await db.inspectionTemplateItem.count();
  await db.inspectionTemplateItem.create({ data: { shopId: await currentShopId(), category, name, sortOrder: count } });
  back("inspection", "Item added");
}

export async function deleteTemplateItem(id: string) {
  await requireStaff(MANAGER_ROLES);
  await db.inspectionTemplateItem.delete({ where: { id } });
  back("inspection", "Item removed");
}

export async function moveTemplateItem(id: string, dir: -1 | 1) {
  await requireStaff(MANAGER_ROLES);
  const items = await db.inspectionTemplateItem.findMany({ orderBy: { sortOrder: "asc" } });
  const idx = items.findIndex((i) => i.id === id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= items.length) back("inspection", "");
  await db.$transaction([
    db.inspectionTemplateItem.update({ where: { id: items[idx].id }, data: { sortOrder: swap } }),
    db.inspectionTemplateItem.update({ where: { id: items[swap].id }, data: { sortOrder: idx } }),
  ]);
  // normalise
  const ordered = await db.inspectionTemplateItem.findMany({ orderBy: { sortOrder: "asc" } });
  await db.$transaction(ordered.map((it, i) => db.inspectionTemplateItem.update({ where: { id: it.id }, data: { sortOrder: i } })));
  redirect("/settings?tab=inspection");
}

// ───────── Canned services ─────────
export async function saveCannedService(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const laborHours = Number(formData.get("laborHours"));
  if (!name || !(laborHours >= 0)) back("services", "Name and labor hours are required", true);
  const laborRateRaw = String(formData.get("laborRate") ?? "").trim();
  const intervalMiles = Number(formData.get("intervalMiles")) || null;
  const intervalMonths = Number(formData.get("intervalMonths")) || null;
  const data = { name, description: opt(formData.get("description")), laborHours, laborRate: laborRateRaw ? Number(laborRateRaw) : null, intervalMiles, intervalMonths };
  const svc = id ? await db.cannedService.update({ where: { id }, data }) : await db.cannedService.create({ data: { ...data, shopId: await currentShopId() } });
  // parts: rows of partId + qty
  const partIds = formData.getAll("partId").map(String);
  const qtys = formData.getAll("partQty").map(Number);
  await db.cannedServicePart.deleteMany({ where: { cannedServiceId: svc.id } });
  for (let i = 0; i < partIds.length; i++) {
    if (partIds[i] && qtys[i] > 0) await db.cannedServicePart.create({ data: { cannedServiceId: svc.id, partId: partIds[i], quantity: qtys[i] } });
  }
  back("services", `${name} saved`);
}

export async function deleteCannedService(id: string) {
  await requireStaff(MANAGER_ROLES);
  await db.cannedService.delete({ where: { id } });
  back("services", "Service removed");
}

// ───────── Notification templates ─────────
export async function saveTemplates(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const { TEMPLATE_EVENTS } = await import("@/lib/templates");
  const templates: Record<string, { subject?: string; body?: string }> = {};
  for (const ev of TEMPLATE_EVENTS) {
    const subject = String(formData.get(`${ev.key}_subject`) ?? "").trim();
    const body = String(formData.get(`${ev.key}_body`) ?? "").trim();
    if (subject || body) templates[ev.key] = { ...(subject ? { subject } : {}), ...(body ? { body } : {}) };
  }
  await db.shopSettings.update({ where: { shopId: await currentShopId() }, data: { templates: Object.keys(templates).length ? templates : undefined } });
  if (!Object.keys(templates).length) await db.shopSettings.update({ where: { shopId: await currentShopId() }, data: { templates: {} } });
  revalidateAll();
  back("templates", "Templates saved");
}

export async function runRemindersNow() {
  await requireStaff(MANAGER_ROLES);
  const { sendDueReminders } = await import("@/lib/reminders");
  const n = await sendDueReminders(await currentShopId());
  revalidateAll();
  back("templates", n ? `${n} reminder${n === 1 ? "" : "s"} sent` : "No reminders are due right now");
}

// ───────── Payments (Stripe) ─────────
export async function savePayments(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const shopId = await currentShopId();
  if (formData.get("remove") === "1") {
    await db.shopSettings.update({ where: { shopId }, data: { stripeSecretKey: null, stripeWebhookSecret: null } });
    revalidateAll();
    back("payments", "Card payments turned off");
  }
  const secret = String(formData.get("stripeSecretKey") ?? "").trim();
  const whsec = String(formData.get("stripeWebhookSecret") ?? "").trim();
  if (secret && !/^(sk|rk)_(live|test)_/.test(secret)) back("payments", "That doesn't look like a Stripe secret key (sk_live_… / sk_test_…)", true);
  if (whsec && !whsec.startsWith("whsec_")) back("payments", "The webhook signing secret starts with whsec_", true);
  const data: { stripeSecretKey?: string; stripeWebhookSecret?: string } = {};
  if (secret) {
    const { testStripeKey } = await import("@/lib/stripe");
    try {
      await testStripeKey(secret);
    } catch (e) {
      back("payments", `Stripe rejected the key: ${e instanceof Error ? e.message : "unknown error"}`, true);
    }
    data.stripeSecretKey = secret;
  }
  if (whsec) data.stripeWebhookSecret = whsec;
  if (!Object.keys(data).length) back("payments", "Nothing to save", true);
  await db.shopSettings.update({ where: { shopId }, data });
  const row = await db.shopSettings.findUnique({ where: { shopId }, select: { stripeSecretKey: true, stripeWebhookSecret: true } });
  revalidateAll();
  back("payments", row?.stripeSecretKey && row?.stripeWebhookSecret ? "Stripe connected — card payments are on in the portal" : "Saved. Add the other key to turn card payments on.");
}

// ───────── Business type ─────────
export async function saveBusinessType(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const { getVertical } = await import("@/lib/verticals");
  const vertical = getVertical(String(formData.get("vertical") ?? ""));
  const base = vertical.terms;
  const overrides: Record<string, string | null> = {};
  const text = (k: "asset" | "assets" | "serial" | "odometerUnit" | "make" | "model") => {
    const v = String(formData.get(k) ?? "").trim();
    if (v && v !== base[k]) overrides[k] = v;
  };
  text("asset"); text("assets"); text("serial"); text("odometerUnit"); text("make"); text("model");
  for (const k of ["plate", "odometer"] as const) {
    const v = String(formData.get(k) ?? "").trim();
    if (v.toLowerCase() === "none") { if (base[k] !== null) overrides[k] = null; }
    else if (v && v !== base[k]) overrides[k] = v;
  }
  const shopId = await currentShopId();
  await db.shopSettings.update({ where: { shopId }, data: { vertical: vertical.key, terms: Object.keys(overrides).length ? overrides : {} } });
  if (formData.has("resetDefaults")) {
    await db.inspectionTemplateItem.deleteMany({});
    await db.inspectionTemplateItem.createMany({ data: vertical.inspection.flatMap(([category, items], ci) => items.map((name, i) => ({ shopId, category, name, sortOrder: ci * 100 + i }))) });
    // keep packages that are referenced by work-order lines; retire the rest, then add the type's set
    const used = await db.workOrderLine.findMany({ where: { cannedServiceId: { not: null } }, select: { cannedServiceId: true }, distinct: ["cannedServiceId"] });
    const keep = new Set(used.map((u) => u.cannedServiceId!));
    const existing = await db.cannedService.findMany({ select: { id: true, name: true } });
    for (const c of existing) if (!keep.has(c.id)) await db.cannedService.delete({ where: { id: c.id } });
    else await db.cannedService.update({ where: { id: c.id }, data: { active: false } });
    await db.cannedService.createMany({ data: vertical.cannedServices.map((c) => ({ ...c, shopId })) });
  }
  revalidateAll();
  back("type", `Business type set to ${vertical.label}`);
}

// ───────── Users ─────────
const UserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  role: z.enum(["OWNER", "ADMIN", "SERVICE_ADVISOR", "TECHNICIAN"]),
  password: z.string().optional(),
});

export async function createUser(formData: FormData) {
  await requireStaff(MANAGER_ROLES);
  const parsed = UserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return back("users", parsed.error.issues[0]?.message ?? "Invalid", true);
  const d = parsed.data;
  const password = d.password ?? "";
  if (password.length < 8) return back("users", "Password must be at least 8 characters", true);
  if (await rawDb.user.findUnique({ where: { email: d.email } })) return back("users", "That email already exists", true);
  const u = await db.user.create({ data: { shopId: await currentShopId(), name: d.name, email: d.email, role: d.role as Role, passwordHash: await hashPassword(password) } });
  if (d.role === "TECHNICIAN") {
    const existing = await db.technician.findFirst({ where: { OR: [{ email: d.email }, { name: d.name }], userId: null } });
    if (existing) await db.technician.update({ where: { id: existing.id }, data: { userId: u.id } });
    else await db.technician.create({ data: { shopId: await currentShopId(), name: d.name, email: d.email, userId: u.id } });
  }
  back("users", `${d.name} added`);
}

export async function updateUser(id: string, formData: FormData) {
  const me = await requireStaff(MANAGER_ROLES);
  const role = String(formData.get("role") ?? "") as Role;
  const active = formData.get("active") !== "false";
  const password = String(formData.get("password") ?? "");
  const target = await db.user.findUniqueOrThrow({ where: { id } });
  if (target.role === "CUSTOMER") back("users", "Customer logins are managed on the customer page", true);
  if (id === me.id && (!active || role !== me.role)) back("users", "You can't deactivate or demote yourself", true);
  if (target.role === "OWNER" && me.role !== "OWNER") back("users", "Only the owner can change the owner account", true);
  const data: Record<string, unknown> = { active };
  if (["OWNER", "ADMIN", "SERVICE_ADVISOR", "TECHNICIAN"].includes(role)) data.role = role;
  if (password) {
    if (password.length < 8) back("users", "Password must be at least 8 characters", true);
    data.passwordHash = await hashPassword(password);
    data.sessionVersion = { increment: 1 }; // a new password signs that person out everywhere
  }
  await db.user.update({ where: { id }, data });
  back("users", "User updated");
}
