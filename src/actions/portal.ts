"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addMinutes, format } from "date-fns";
import { db, currentShopId } from "@/lib/db";
import { requireCustomer } from "@/lib/auth";
import { queueNotification } from "@/lib/notify";

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
