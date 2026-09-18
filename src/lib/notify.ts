import "server-only";
import { subDays } from "date-fns";
import { db, rawDb, withShop, currentShopId } from "./db";
import { mailConfigured, sendEmail, sendSms, smsConfigured } from "./mail";
import { getSettings, shopAddress } from "./settings";
import { renderEmailHtml } from "./email-html";
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

/**
 * Re-sends queued email / SMS (e.g. after a provider was configured). Runs
 * hourly from the scheduler and from the "Retry queued" button. Returns sent count.
 */
export async function flushOutbox(onlyShopId?: string) {
  const channels: NotificationChannel[] = [...(mailConfigured() ? (["EMAIL"] as const) : []), ...(smsConfigured() ? (["SMS"] as const) : [])];
  if (!channels.length) return 0;
  const rows = await rawDb.notification.findMany({
    where: { status: "QUEUED", channel: { in: channels }, createdAt: { gte: subDays(new Date(), 7) }, ...(onlyShopId ? { shopId: onlyShopId } : {}) },
    include: { customer: { select: { email: true, phone: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const n of rows) {
    const ok = await withShop(n.shopId, () => deliver(n.channel, n.customer, n));
    await rawDb.notification.update({ where: { id: n.id }, data: ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED" } });
    if (ok) sent++;
  }
  return sent;
}

async function deliver(channel: NotificationChannel, customer: { email: string | null; phone: string | null } | null, opts: { subject: string; body: string }) {
  if (channel === "EMAIL" && customer?.email) {
    const s = await getSettings();
    const base = process.env.APP_URL?.replace(/\/$/, "");
    const logoUrl = s.logoUrl && base ? (s.logoUrl.startsWith("http") ? s.logoUrl : `${base}${s.logoUrl}`) : null;
    const html = renderEmailHtml({ shopName: s.name, logoUrl, accent: s.accentColor, address: shopAddress(s).join(", "), phone: s.phone, subject: opts.subject, body: opts.body, ctaLabel: /estimate/i.test(opts.subject) ? "Review estimate" : /invoice/i.test(opts.subject) ? "View invoice" : "Open" });
    return sendEmail({ to: customer.email, subject: opts.subject, text: opts.body, html, from: process.env.EMAIL_FROM ? `${s.name} <${process.env.EMAIL_FROM.replace(/^.*<|>.*$/g, "")}>` : undefined });
  }
  if (channel === "SMS" && customer?.phone) return sendSms(customer.phone, `${opts.subject}: ${opts.body}`);
  return false;
}
