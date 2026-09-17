"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { rawDb } from "@/lib/db";
import { createSession, destroySession, getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { mailConfigured, sendEmail } from "@/lib/mail";
import { clientIp, rateLimit, rateReset } from "@/lib/ratelimit";

export type LoginState = { error?: string } | undefined;
export type MessageState = { error?: string; ok?: string } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

function minutes(sec: number) {
  const m = Math.max(1, Math.ceil(sec / 60));
  return `${m} minute${m === 1 ? "" : "s"}`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, password, next } = parsed.data;
  const key = `login:${await clientIp()}:${email}`;
  const wait = rateLimit(key, 10, 15 * 60);
  if (wait) return { error: `Too many sign-in attempts. Try again in ${minutes(wait)}.` };

  const user = await rawDb.user.findUnique({ where: { email }, include: { shop: { select: { status: true } } } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect" };
  }

  const blocked = Boolean(user.shop && (user.shop.status === "SUSPENDED" || user.shop.status === "CANCELLED") && user.role !== "SUPERADMIN");
  // the owner may still sign in to fix billing; everyone else waits
  if (blocked && user.role !== "OWNER") {
    return { error: "This shop's NexDrive account is suspended. Ask the shop owner to choose a plan, or contact NexDrive support." };
  }
  rateReset(key);
  await createSession(user);
  await rawDb.auditLog.create({ data: { userId: user.id, shopId: user.shopId, action: "login", entity: "User", entityId: user.id } });
  if (blocked) redirect("/suspended");

  if (user.role === "SUPERADMIN") redirect("/admin");
  if (user.role === "CUSTOMER") redirect("/portal");
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ───────── Password reset ─────────

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("host") ?? "localhost:4500"}`;
}

/** Always answers the same way so the form can't be used to discover accounts. */
export async function requestPasswordReset(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email" };
  const wait = rateLimit(`reset:${await clientIp()}`, 5, 15 * 60);
  if (wait) return { error: `Too many requests. Try again in ${minutes(wait)}.` };

  const user = await rawDb.user.findUnique({ where: { email }, include: { shop: { select: { settings: { select: { name: true } } } } } });
  if (user && user.active) {
    const token = randomBytes(32).toString("base64url");
    await rawDb.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    const link = `${await baseUrl()}/reset-password?token=${token}`;
    const shopName = user.shop?.settings?.name ?? "NexDrive";
    const text = `Hi ${user.name},\n\nSomeone asked to reset the password for your ${shopName} account. Use this link within the next hour:\n\n${link}\n\nIf that wasn't you, ignore this email — your password stays the same.`;
    const sent = mailConfigured() ? await sendEmail({ to: email, subject: `Reset your ${shopName} password`, text }) : false;
    if (!sent) console.warn(`[nexdrive] no email provider configured — password reset link for ${email}: ${link}`);
  }
  return { ok: "If an account exists for that email, a reset link is on its way. It expires in one hour." };
}

export async function resetPassword(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) return { error: "This reset link is invalid." };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password !== confirm) return { error: "Passwords don't match" };
  const row = await rawDb.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "This reset link has expired or was already used. Request a new one." };
  await rawDb.$transaction([
    rawDb.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    rawDb.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    rawDb.passwordResetToken.deleteMany({ where: { userId: row.userId, id: { not: row.id } } }),
    rawDb.auditLog.create({ data: { userId: row.userId, shopId: row.user.shopId, action: "password_reset", entity: "User", entityId: row.userId } }),
  ]);
  redirect(`/login?ok=1${row.user.role === "CUSTOMER" ? "&portal=1" : ""}`);
}

/** Signed-in users change their own password. */
export async function changePassword(_prev: MessageState, formData: FormData): Promise<MessageState> {
  const me = await getSession();
  if (!me) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "New password must be at least 8 characters" };
  if (password !== confirm) return { error: "Passwords don't match" };
  const user = await rawDb.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Current password is incorrect" };
  await rawDb.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(password) } });
  await rawDb.auditLog.create({ data: { userId: me.id, shopId: user.shopId, action: "password_change", entity: "User", entityId: me.id } });
  return { ok: "Password updated" };
}
