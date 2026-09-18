"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rawDb } from "@/lib/db";
import { createSession, getSession, requireSuperadmin, userLocations } from "@/lib/auth";
import { provisionShop } from "@/lib/provision";
import type { Role } from "@/generated/prisma/enums";

/** Re-issue the session for another location this user belongs to. */
export async function switchShop(shopId: string) {
  const me = await getSession();
  if (!me) redirect("/login");
  const locations = await userLocations(me.id);
  const target = locations.find((l) => l.shopId === shopId);
  if (!target) redirect("/dashboard?denied=1");
  await createSession({ id: me.id, role: target.role, shopId: target.shopId });
  await rawDb.auditLog.create({ data: { shopId: target.shopId, userId: me.id, action: "switch_location", entity: "Shop", entityId: target.shopId } });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const back = (id: string, msg: string, err = false): never => redirect(`/admin/shops/${id}?${err ? "error" : "ok"}=${encodeURIComponent(msg)}`);

/** Admin console: a new shop that belongs to an existing owner (multi-location). */
export async function adminAddLocation(ownerShopId: string, formData: FormData) {
  await requireSuperadmin();
  const name = String(formData.get("name") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  if (!name || !ownerEmail) back(ownerShopId, "Location name and the owner's email are required", true);
  try {
    const { shop } = await provisionShop({ name, ownerName: "", ownerEmail, password: "", plan: "ENTERPRISE", asAdditionalLocation: true });
    revalidatePath("/admin");
    redirect(`/admin/shops/${shop.id}?ok=${encodeURIComponent(`${shop.name} created as an additional location for ${ownerEmail}`)}`);
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    back(ownerShopId, e instanceof Error ? e.message : "Could not create location", true);
  }
}

/** Admin console: let an existing login work in this shop with a role. */
export async function adminGrantAccess(shopId: string, formData: FormData) {
  await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "OWNER") as Role;
  if (!["OWNER", "ADMIN", "SERVICE_ADVISOR", "TECHNICIAN"].includes(role)) back(shopId, "Pick a staff role", true);
  const user = await rawDb.user.findUnique({ where: { email } });
  if (!user || user.role === "CUSTOMER" || user.role === "SUPERADMIN") return back(shopId, "No staff login with that email", true);
  if (user.shopId === shopId) back(shopId, "That user already belongs to this shop", true);
  await rawDb.shopMember.upsert({ where: { userId_shopId: { userId: user.id, shopId } }, create: { userId: user.id, shopId, role }, update: { role } });
  revalidatePath(`/admin/shops/${shopId}`);
  back(shopId, `${user.name} can now work in this location as ${role.replace("_", " ").toLowerCase()}`);
}

export async function adminRevokeAccess(shopId: string, userId: string) {
  await requireSuperadmin();
  await rawDb.shopMember.deleteMany({ where: { shopId, userId } });
  revalidatePath(`/admin/shops/${shopId}`);
  back(shopId, "Access removed");
}
