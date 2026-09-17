import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { rawDb, SESSION_COOKIE, SHOP_COOKIE } from "./db";
import type { Role, ShopStatus } from "@/generated/prisma/enums";

export { SESSION_COOKIE, SHOP_COOKIE };
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
  /** the shop this user belongs to — null for NexDrive super-admins */
  shopId: string | null;
  /** the shop currently being viewed (a super-admin can open any shop) */
  activeShopId: string | null;
  shopStatus: ShopStatus | null;
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

export async function createSession(user: { id: string; role: Role; shopId: string | null }) {
  const token = await new SignJWT({ sub: user.id, role: user.role, shop: user.shopId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(SHOP_COOKIE);
}

/** Super-admin: open a shop (all shop-scoped queries then run as that shop). */
export async function setActiveShop(shopId: string | null) {
  const jar = await cookies();
  if (shopId) jar.set(SHOP_COOKIE, shopId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 60 * 60 });
  else jar.delete(SHOP_COOKIE);
}

/** Verifies the cookie only — cheap enough for proxy.ts. */
export async function readSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? { userId: payload.sub, role: payload.role as Role, shopId: (payload.shop as string | null) ?? null } : null;
  } catch {
    return null;
  }
}

/** Current user, memoised per request. Uses the unscoped client because it *determines* the shop. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const claims = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await rawDb.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, email: true, name: true, role: true, active: true, shopId: true, customerId: true, technician: { select: { id: true } }, shop: { select: { status: true } } },
  });
  if (!user || !user.active) return null;
  let activeShopId = user.shopId;
  let shopStatus: ShopStatus | null = user.shop?.status ?? null;
  if (user.role === "SUPERADMIN") {
    activeShopId = jar.get(SHOP_COOKIE)?.value ?? null;
    if (activeShopId) shopStatus = (await rawDb.shop.findUnique({ where: { id: activeShopId }, select: { status: true } }))?.status ?? null;
    if (activeShopId && !shopStatus) activeShopId = null;
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role, shopId: user.shopId, activeShopId, shopStatus, customerId: user.customerId, technicianId: user.technician?.id ?? null };
});

/** Staff of the active shop. Super-admins pass when they have a shop open. */
export async function requireStaff(roles: Role[] = STAFF_ROLES): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "CUSTOMER") redirect("/portal");
  if (user.role === "SUPERADMIN") {
    if (!user.activeShopId) redirect("/admin");
    return user;
  }
  if (!roles.includes(user.role)) redirect("/dashboard?denied=1");
  if (user.shopStatus === "SUSPENDED" || user.shopStatus === "CANCELLED") redirect("/suspended");
  return user;
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/dashboard?denied=1");
  return user;
}

export async function requireCustomer(): Promise<SessionUser & { customerId: string; activeShopId: string }> {
  const user = await getSession();
  if (!user) redirect("/login?portal=1");
  if (user.role !== "CUSTOMER" || !user.customerId || !user.activeShopId) redirect("/dashboard");
  return user as SessionUser & { customerId: string; activeShopId: string };
}

/** Role check that treats a super-admin viewing a shop as an owner. */
export function can(user: SessionUser, roles: Role[]) {
  return user.role === "SUPERADMIN" || roles.includes(user.role);
}
