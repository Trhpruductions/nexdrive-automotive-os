import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { db } from "./db";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "nd_session";
const SESSION_DAYS = 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set in .env");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
  technicianId: string | null;
};

export const STAFF_ROLES: Role[] = ["OWNER", "ADMIN", "SERVICE_ADVISOR", "TECHNICIAN"];
export const MANAGER_ROLES: Role[] = ["OWNER", "ADMIN"];
export const BILLING_ROLES: Role[] = ["OWNER", "ADMIN", "SERVICE_ADVISOR"];

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Verifies the cookie only — cheap enough for proxy.ts. */
export async function readSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Current user, memoised per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const userId = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      customerId: true,
      technician: { select: { id: true } },
    },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    customerId: user.customerId,
    technicianId: user.technician?.id ?? null,
  };
});

export async function requireStaff(roles: Role[] = STAFF_ROLES): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "CUSTOMER") redirect("/portal");
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  return user;
}

export async function requireCustomer(): Promise<SessionUser & { customerId: string }> {
  const user = await getSession();
  if (!user) redirect("/login?portal=1");
  if (user.role !== "CUSTOMER" || !user.customerId) redirect("/dashboard");
  return user as SessionUser & { customerId: string };
}

export function can(user: SessionUser, roles: Role[]) {
  return roles.includes(user.role);
}
