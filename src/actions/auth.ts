"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
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
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is incorrect" };
  }

  await createSession(user.id);
  await db.auditLog.create({ data: { userId: user.id, action: "login", entity: "User", entityId: user.id } });

  if (user.role === "CUSTOMER") redirect("/portal");
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
