"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCustomer, requireStaff } from "@/lib/auth";
import { queueNotification } from "@/lib/notify";

export async function sendStaffMessage(customerId: string, formData: FormData) {
  const user = await requireStaff();
  const body = String(formData.get("body") ?? "").trim();
  const workOrderId = String(formData.get("workOrderId") ?? "") || null;
  if (!body) redirect(`/messages/${customerId}?error=Type+a+message`);
  await db.message.create({ data: { customerId, workOrderId, direction: "OUTBOUND", body, authorName: user.name } });
  await queueNotification({ customerId, workOrderId, subject: `New message from ${user.name}`, body, channels: ["EMAIL", "SMS"] });
  revalidatePath(`/messages/${customerId}`);
  revalidatePath("/messages");
  redirect(`/messages/${customerId}`);
}

export async function markThreadRead(customerId: string) {
  await requireStaff();
  await db.message.updateMany({ where: { customerId, direction: "INBOUND", readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/messages");
}

export async function sendPortalMessage(formData: FormData) {
  const user = await requireCustomer();
  const body = String(formData.get("body") ?? "").trim();
  const workOrderId = String(formData.get("workOrderId") ?? "") || null;
  if (!body) redirect(`/portal/messages?error=Type+a+message`);
  await db.message.create({ data: { customerId: user.customerId, workOrderId, direction: "INBOUND", body, authorName: user.name } });
  revalidatePath("/portal/messages");
  revalidatePath("/messages");
  redirect("/portal/messages?ok=Message+sent");
}

export async function sendNotification(formData: FormData) {
  await requireStaff();
  const customerId = String(formData.get("customerId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const channels = formData.getAll("channels").map(String) as ("EMAIL" | "SMS" | "PORTAL")[];
  if (!customerId || !subject || !body) redirect("/notifications?error=Customer%2C+subject+and+message+are+required");
  await queueNotification({ customerId, subject, body, channels: channels.length ? channels : undefined });
  revalidatePath("/notifications");
  redirect("/notifications?ok=Notification+sent");
}

export async function retryNotification(id: string) {
  await requireStaff();
  const n = await db.notification.findUniqueOrThrow({ where: { id } });
  await db.notification.delete({ where: { id } });
  await queueNotification({ customerId: n.customerId, workOrderId: n.workOrderId, subject: n.subject, body: n.body, channels: [n.channel] });
  revalidatePath("/notifications");
  redirect("/notifications?ok=Retried");
}
