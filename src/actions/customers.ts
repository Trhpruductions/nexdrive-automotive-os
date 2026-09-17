"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireStaff } from "@/lib/auth";

const CustomerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  company: z.string().trim().optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().optional().transform((v) => v || null),
  phone: z.string().trim().optional().transform((v) => v || null),
  address: z.string().trim().optional().transform((v) => v || null),
  city: z.string().trim().optional().transform((v) => v || null),
  state: z.string().trim().optional().transform((v) => v || null),
  zip: z.string().trim().optional().transform((v) => v || null),
  notes: z.string().trim().optional().transform((v) => v || null),
  taxExempt: z.coerce.boolean().default(false),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

function parse<T extends z.ZodTypeAny>(schema: T, formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v;
  if (!formData.has("taxExempt")) raw.taxExempt = false;
  return schema.safeParse(raw);
}

export async function createCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const parsed = parse(CustomerSchema, formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const customer = await db.customer.create({ data: parsed.data });
  await db.auditLog.create({ data: { userId: user.id, action: "create", entity: "Customer", entityId: customer.id, detail: `${customer.firstName} ${customer.lastName}` } });
  revalidatePath("/customers");
  const returnTo = formData.get("returnTo");
  redirect(typeof returnTo === "string" && returnTo.startsWith("/") ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}customerId=${customer.id}` : `/customers/${customer.id}`);
}

export async function updateCustomer(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = parse(CustomerSchema, formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.customer.update({ where: { id }, data: parsed.data });
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?ok=Customer+updated`);
}

export async function deleteCustomer(id: string) {
  await requireStaff(["OWNER", "ADMIN"]);
  const open = await db.workOrder.count({ where: { customerId: id, status: { notIn: ["INVOICED", "CANCELLED"] } } });
  if (open > 0) redirect(`/customers/${id}?error=Close+or+cancel+open+work+orders+first`);
  const invoices = await db.invoice.count({ where: { customerId: id } });
  if (invoices > 0) redirect(`/customers/${id}?error=Customers+with+invoices+cannot+be+deleted`);
  await db.user.deleteMany({ where: { customerId: id } });
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers?ok=Customer+deleted");
}

/** Create (or reset) the customer's portal login. */
export async function setPortalAccess(customerId: string, formData: FormData) {
  await requireStaff(["OWNER", "ADMIN", "SERVICE_ADVISOR"]);
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId }, include: { portalUser: true } });
  const password = String(formData.get("password") ?? "").trim();
  const email = (customer.email ?? "").toLowerCase();
  if (!email) redirect(`/customers/${customerId}?error=Add+an+email+address+first`);
  if (password.length < 8) redirect(`/customers/${customerId}?error=Password+must+be+at+least+8+characters`);
  const passwordHash = await hashPassword(password);
  if (customer.portalUser) {
    await db.user.update({ where: { id: customer.portalUser.id }, data: { passwordHash, email, active: true } });
  } else {
    const taken = await db.user.findUnique({ where: { email } });
    if (taken) redirect(`/customers/${customerId}?error=That+email+already+has+a+login`);
    await db.user.create({ data: { email, passwordHash, name: `${customer.firstName} ${customer.lastName}`, role: "CUSTOMER", customerId } });
  }
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?ok=Portal+access+ready`);
}

export async function revokePortalAccess(customerId: string) {
  await requireStaff(["OWNER", "ADMIN", "SERVICE_ADVISOR"]);
  await db.user.deleteMany({ where: { customerId } });
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}?ok=Portal+access+removed`);
}
