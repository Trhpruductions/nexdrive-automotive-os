import "server-only";
import { db, currentShopId } from "./db";
import { sendEmail, sendSms } from "./mail";
import type { NotificationChannel } from "@/generated/prisma/enums";

/**
 * Customer notifications. PORTAL notifications are delivered instantly (they show
 * in the customer's portal inbox). EMAIL / SMS go out through the configured
 * provider (Resend or SMTP for email, Twilio for SMS — see src/lib/mail.ts) and
 * stay QUEUED in the outbox when none is configured so the shop can see what
 * would have gone out.
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
      data: { shopId: await currentShopId(),
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
  if (channel === "EMAIL" && customer?.email) return sendEmail({ to: customer.email, subject: opts.subject, text: opts.body });
  if (channel === "SMS" && customer?.phone) return sendSms(customer.phone, `${opts.subject}: ${opts.body}`);
  return false;
}
