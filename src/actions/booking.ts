"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addMinutes, format } from "date-fns";
import { rawDb, withShop } from "@/lib/db";
import { queueNotification } from "@/lib/notify";
import { renderTemplate } from "@/lib/templates";
import { emitWebhook } from "@/lib/webhooks";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export type BookingState = { error?: string } | undefined;

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

/**
 * Public booking form (/book/{slug}): no account needed. Finds or creates the
 * customer + vehicle, books a SCHEDULED appointment for the shop to confirm and
 * drops an inbound message so staff see it in Messages.
 */
export async function bookOnline(slug: string, _prev: BookingState, formData: FormData): Promise<BookingState> {
  const wait = rateLimit(`book:${await clientIp()}`, 5, 60 * 60);
  if (wait) return { error: "Too many booking requests from this connection. Please call the shop or try again later." };
  if (clean(formData.get("website"))) return {}; // honeypot

  const shop = await rawDb.shop.findUnique({ where: { slug }, include: { settings: true } });
  if (!shop || !shop.settings || !shop.settings.onlineBooking || !["ACTIVE", "TRIAL"].includes(shop.status)) return { error: "Online booking is not available for this shop." };

  const firstName = clean(formData.get("firstName"), 60);
  const lastName = clean(formData.get("lastName"), 60);
  const email = clean(formData.get("email"), 120).toLowerCase();
  const phone = clean(formData.get("phone"), 40);
  const year = Number(clean(formData.get("year"), 4));
  const make = clean(formData.get("make"), 60);
  const model = clean(formData.get("model"), 60);
  const licensePlate = clean(formData.get("licensePlate"), 16).toUpperCase() || null;
  const service = clean(formData.get("service"), 120) === "__other" ? clean(formData.get("serviceOther"), 200) : clean(formData.get("service"), 120);
  const date = clean(formData.get("date"), 10);
  const time = clean(formData.get("time"), 5);
  const notes = clean(formData.get("notes"), 1000) || null;
  const dropOff = formData.has("dropOff");

  if (!firstName || !lastName) return { error: "Enter your first and last name" };
  if (!email && !phone) return { error: "Enter an email or a phone number so we can confirm" };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email" };
  if (!year || year < 1900 || year > new Date().getFullYear() + 1 || !make || !model) return { error: "Tell us the vehicle's year, make and model" };
  if (!service) return { error: "Choose the service you need" };
  const start = new Date(`${date}T${time}`);
  if (!date || !time || Number.isNaN(start.getTime()) || start < new Date()) return { error: "Pick a future date and time" };

  await withShop(shop.id, async () => {
    // customer: match email first, then phone
    let customer = email ? await rawDb.customer.findFirst({ where: { shopId: shop.id, email: { equals: email, mode: "insensitive" } } }) : null;
    if (!customer && phone) customer = await rawDb.customer.findFirst({ where: { shopId: shop.id, phone } });
    if (!customer) customer = await rawDb.customer.create({ data: { shopId: shop.id, firstName, lastName, email: email || null, phone: phone || null, notes: "Created from online booking" } });

    // vehicle: same plate (or same year/make/model) already on this customer, else create
    let vehicle = await rawDb.vehicle.findFirst({ where: { shopId: shop.id, customerId: customer.id, ...(licensePlate ? { licensePlate } : { year, make: { equals: make, mode: "insensitive" }, model: { equals: model, mode: "insensitive" } }) } });
    if (!vehicle) vehicle = await rawDb.vehicle.create({ data: { shopId: shop.id, customerId: customer.id, year, make, model, licensePlate } });

    const appt = await rawDb.appointment.create({
      data: { shopId: shop.id, customerId: customer.id, vehicleId: vehicle.id, scheduledStart: start, scheduledEnd: addMinutes(start, 60), serviceRequested: service, notes: `Booked online${notes ? `: ${notes}` : ""}`, dropOff, status: "SCHEDULED" },
    });
    await rawDb.message.create({ data: { shopId: shop.id, customerId: customer.id, direction: "INBOUND", authorName: `${firstName} ${lastName}`, body: `Online booking request: ${service} for the ${year} ${make} ${model} on ${format(start, "EEE, MMM d 'at' h:mm a")}${notes ? ` — "${notes}"` : ""}. Please confirm.` } });
    const t = await renderTemplate("appointment_booked", { customer: firstName, vehicle: `${year} ${make} ${model}`, date: format(start, "EEEE, MMM d"), time: format(start, "h:mm a"), service });
    await queueNotification({ customerId: customer.id, ...t, channels: [...(email ? (["EMAIL"] as const) : []), ...(phone ? (["SMS"] as const) : [])] });
    emitWebhook("appointment.created", appt);
  });
  revalidatePath("/schedule");
  revalidatePath("/messages");
  redirect(`/book/${slug}?booked=${encodeURIComponent(format(start, "EEEE, MMMM d 'at' h:mm a"))}`);
}
