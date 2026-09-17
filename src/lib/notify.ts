import "server-only";
import { db } from "./db";
import type { NotificationChannel } from "@/generated/prisma/enums";

/**
 * Customer notifications. PORTAL notifications are delivered instantly (they show
 * in the customer's portal inbox). EMAIL / SMS are recorded as SENT when a provider
 * is configured, otherwise they stay QUEUED in the outbox so the shop can see what
 * would have gone out. Plug a provider in here (Resend, Twilio, …) when ready.
 */
export async function queueNotification(opts: {
  customerId: string;
  workOrderId?: string | null;
  subject: string;
  body: string;
  channels?: NotificationChannel[];
}) {
  const customer = await db.customer.findUnique({ where: { id: opts.customerId }, select: { email: true, phone: true } });
  const channels = opts.channels ?? ["PORTAL", ...(customer?.email ? (["EMAIL"] as const) : []), ...(customer?.phone ? (["SMS"] as const) : [])];
  const now = new Date();
  for (const channel of channels) {
    if (channel === "EMAIL" && !customer?.email) continue;
    if (channel === "SMS" && !customer?.phone) continue;
    const delivered = channel === "PORTAL" ? true : await deliver(channel, customer, opts);
    await db.notification.create({
      data: {
        customerId: opts.customerId,
        workOrderId: opts.workOrderId ?? null,
        channel,
        subject: opts.subject,
        body: opts.body,
        status: delivered ? "SENT" : "QUEUED",
        sentAt: delivered ? now : null,
      },
    });
  }
}

async function deliver(channel: NotificationChannel, customer: { email: string | null; phone: string | null } | null, opts: { subject: string; body: string }) {
  if (channel === "EMAIL" && process.env.RESEND_API_KEY && customer?.email) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "shop@example.com", to: customer.email, subject: opts.subject, text: opts.body }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  if (channel === "SMS" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM && customer?.phone) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: process.env.TWILIO_FROM, To: customer.phone, Body: `${opts.subject}: ${opts.body}` }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
  return false;
}
