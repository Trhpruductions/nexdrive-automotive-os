"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addMinutes, format } from "date-fns";
import { db, currentShopId } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { headers } from "next/headers";
import { queueNotification } from "@/lib/notify";
import { createCheckoutSession } from "@/lib/stripe";

/** Customer pays an invoice balance by card through the shop's Stripe account. */
export async function startCardPayment(invoiceId: string) {
  const user = await requireCustomer();
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { customer: { select: { email: true } } } });
  if (!inv || inv.customerId !== user.customerId) redirect("/portal");
  const balance = Math.round((Number(inv.total) - Number(inv.amountPaid)) * 100) / 100;
  if (inv.status === "VOID" || balance <= 0) redirect(`/portal/invoices/${invoiceId}`);
  const h = await headers();
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  let url: string;
  try {
    url = await createCheckoutSession({ shopId: user.activeShopId, invoiceId, invoiceNumber: inv.number, amount: balance, customerEmail: inv.customer.email, successUrl: `${base}/portal/invoices/${invoiceId}?paid=1`, cancelUrl: `${base}/portal/invoices/${invoiceId}?cancelled=1` });
  } catch (e) {
    redirect(`/portal/invoices/${invoiceId}?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not start payment")}`);
  }
  redirect(url);
}

/** Customer requests an appointment from the portal; the shop confirms it in Schedule. */
export async function requestAppointment(formData: FormData) {
  const user = await requireCustomer();
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const serviceRequested = String(formData.get("serviceRequested") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.customerId !== user.customerId) redirect("/portal/book?error=Choose+one+of+your+vehicles");
  if (!serviceRequested || !date || !time) redirect("/portal/book?error=Fill+in+the+service%2C+date+and+time");
  const start = new Date(`${date}T${time}`);
  if (Number.isNaN(start.getTime()) || start < new Date()) redirect("/portal/book?error=Pick+a+future+date+and+time");
  await db.appointment.create({ data: { shopId: await currentShopId(), customerId: user.customerId, vehicleId, scheduledStart: start, scheduledEnd: addMinutes(start, 60), serviceRequested, notes: notes ? `Customer request: ${notes}` : "Requested via customer portal", dropOff: formData.has("dropOff"), status: "SCHEDULED" } });
  await queueNotification({ customerId: user.customerId, subject: "Appointment request received", body: `We received your request for ${format(start, "EEEE, MMM d 'at' h:mm a")} — ${serviceRequested}. We'll confirm shortly.`, channels: ["PORTAL"] });
  revalidatePath("/portal");
  revalidatePath("/schedule");
  redirect("/portal?ok=Appointment+requested+%E2%80%94+we%27ll+confirm+it+shortly");
}

/** Customer keeps their own contact details current from the portal. */
export async function updateMyContact(_prev: { error?: string; ok?: string } | undefined, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const user = await requireCustomer();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email" };
  if (!email && !phone) return { error: "Keep at least an email or a phone number so the shop can reach you" };
  await db.customer.update({
    where: { id: user.customerId },
    data: { email, phone, address: String(formData.get("address") ?? "").trim() || null, city: String(formData.get("city") ?? "").trim() || null, state: String(formData.get("state") ?? "").trim() || null, zip: String(formData.get("zip") ?? "").trim() || null },
  });
  revalidatePath("/portal");
  return { ok: "Contact details updated" };
}
