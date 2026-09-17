"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { rawDb } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, password, next } = parsed.data;
  const user = await rawDb.user.findUnique({ where: { email }, include: { shop: { select: { status: true } } } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect" };
  }

  if (user.shop && (user.shop.status === "SUSPENDED" || user.shop.status === "CANCELLED") && user.role !== "SUPERADMIN") {
    return { error: "This shop's NexDrive account is suspended. Contact NexDrive support." };
  }
  await createSession(user);
  await rawDb.auditLog.create({ data: { userId: user.id, shopId: user.shopId, action: "login", entity: "User", entityId: user.id } });

  if (user.role === "SUPERADMIN") redirect("/admin");
  if (user.role === "CUSTOMER") redirect("/portal");
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
