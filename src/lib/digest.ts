import "server-only";
import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import { rawDb, withShop } from "./db";
import { queueNotification } from "./notify";
import { renderTemplate } from "./templates";
import { mailConfigured, sendEmail } from "./mail";
import { renderEmailHtml } from "./email-html";

/**
 * Day-before appointment reminders. Runs hourly; picks appointments starting
 * 20–28 hours from now that haven't been reminded, one message each.
 */
export async function sendAppointmentReminders(onlyShopId?: string) {
  const now = new Date();
  const from = new Date(now.getTime() + 20 * 3600_000);
  const to = new Date(now.getTime() + 28 * 3600_000);
  const rows = await rawDb.appointment.findMany({
    where: { reminderSentAt: null, status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledStart: { gte: from, lte: to }, ...(onlyShopId ? { shopId: onlyShopId } : {}), shop: { status: { in: ["ACTIVE", "TRIAL"] } } },
    include: { vehicle: { select: { year: true, make: true, model: true } }, customer: { select: { firstName: true } } },
    take: 500,
  });
  let n = 0;
  for (const a of rows) {
    await withShop(a.shopId, async () => {
      const t = await renderTemplate("appointment_reminder", { customer: a.customer.firstName, vehicle: `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}`, date: format(a.scheduledStart, "EEEE, MMM d"), time: format(a.scheduledStart, "h:mm a"), service: a.serviceRequested });
      await queueNotification({ customerId: a.customerId, ...t });
    });
    await rawDb.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
    n++;
  }
  return n;
}

/**
 * One gentle nudge for estimates the customer hasn't answered in 2 days
 * (sent once per estimate; a new "send for approval" resets it).
 */
export async function sendEstimateFollowUps(onlyShopId?: string) {
  const cutoff = subDays(new Date(), 2);
  const rows = await rawDb.workOrder.findMany({
    where: { status: "AWAITING_APPROVAL", approvalToken: { not: null }, sentForApprovalAt: { lt: cutoff }, followUpSentAt: null, ...(onlyShopId ? { shopId: onlyShopId } : {}), shop: { status: { in: ["ACTIVE", "TRIAL"] } } },
    include: { vehicle: { select: { year: true, make: true, model: true } }, customer: { select: { firstName: true, taxExempt: true } }, lines: true },
    take: 200,
  });
  if (!rows.length) return 0;
  const { computeTotals } = await import("./money");
  const { getSettings } = await import("./settings");
  const { publicBase } = await import("./templates");
  const base = await publicBase();
  let n = 0;
  for (const wo of rows) {
    await withShop(wo.shopId, async () => {
      const s = await getSettings();
      const total = computeTotals(wo.lines, s.taxRate, { taxExempt: wo.customer.taxExempt }).total;
      const t = await renderTemplate("estimate_followup", { customer: wo.customer.firstName, vehicle: `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}`, total: total.toLocaleString("en-US", { style: "currency", currency: "USD" }), link: `${base}/approve/${wo.approvalToken}` });
      await queueNotification({ customerId: wo.customerId, workOrderId: wo.id, ...t });
    });
    await rawDb.workOrder.update({ where: { id: wo.id }, data: { followUpSentAt: new Date() } });
    n++;
  }
  return n;
}

/** Numbers for one shop's day: collected, invoiced, completed, tomorrow's schedule, open estimates. */
export async function dayDigest(shopId: string, day = new Date()) {
  const start = startOfDay(day);
  const end = endOfDay(day);
  const [payments, invoices, completed, tomorrow, awaiting, waitingParts, lowStock] = await Promise.all([
    rawDb.payment.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { paidAt: { gte: start, lte: end }, invoice: { shopId } } }),
    rawDb.invoice.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { shopId, issuedAt: { gte: start, lte: end }, status: { not: "VOID" } } }),
    rawDb.workOrder.count({ where: { shopId, completedAt: { gte: start, lte: end } } }),
    rawDb.appointment.findMany({ where: { shopId, scheduledStart: { gte: startOfDay(addDays(day, 1)), lte: endOfDay(addDays(day, 1)) }, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, include: { vehicle: { select: { year: true, make: true, model: true } }, customer: { select: { firstName: true, lastName: true } } }, orderBy: { scheduledStart: "asc" } }),
    rawDb.workOrder.count({ where: { shopId, status: "AWAITING_APPROVAL", sentForApprovalAt: { lt: subDays(day, 2) } } }),
    rawDb.workOrder.count({ where: { shopId, status: "ON_HOLD" } }),
    rawDb.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Part" WHERE "shopId" = ${shopId} AND active AND "quantityOnHand" <= "reorderPoint"`,
  ]);
  return {
    collected: Number(payments._sum.amount ?? 0), paymentCount: payments._count._all,
    invoiced: Number(invoices._sum.total ?? 0), invoiceCount: invoices._count._all,
    completed, tomorrow, staleEstimates: awaiting, waitingParts, lowStock: Number(lowStock[0]?.n ?? 0),
  };
}

/**
 * Owner's end-of-day email. Runs hourly; sends once per day after the shop's
 * digest hour (local server time) to every OWNER of the shop with an email provider.
 */
export async function sendDailyDigests() {
  if (!mailConfigured()) return 0;
  const now = new Date();
  const shops = await rawDb.shop.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] }, settings: { dailyDigest: true } }, include: { settings: true, users: { where: { role: "OWNER", active: true }, select: { email: true, name: true } } } });
  let sent = 0;
  for (const shop of shops) {
    const s = shop.settings!;
    if (now.getHours() < s.digestHour) continue;
    if (s.lastDigestAt && startOfDay(s.lastDigestAt).getTime() === startOfDay(now).getTime()) continue;
    if (!shop.users.length) continue;
    const d = await dayDigest(shop.id, now);
    const money = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: s.currency || "USD" });
    const lines = [
      `Collected today: ${money(d.collected)} (${d.paymentCount} payment${d.paymentCount === 1 ? "" : "s"})`,
      `Invoiced today: ${money(d.invoiced)} (${d.invoiceCount})`,
      `Jobs completed: ${d.completed}`,
      d.staleEstimates ? `Estimates waiting on customers for 2+ days: ${d.staleEstimates}` : null,
      d.waitingParts ? `Jobs waiting on parts: ${d.waitingParts}` : null,
      d.lowStock ? `Parts at or below reorder point: ${d.lowStock}` : null,
      "",
      `Tomorrow: ${d.tomorrow.length} appointment${d.tomorrow.length === 1 ? "" : "s"}`,
      ...d.tomorrow.slice(0, 12).map((a) => `  ${format(a.scheduledStart, "h:mm a")} — ${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model} · ${a.customer.firstName} ${a.customer.lastName} · ${a.serviceRequested}`),
      d.tomorrow.length > 12 ? `  …and ${d.tomorrow.length - 12} more` : null,
    ].filter((l): l is string => l !== null);
    const body = lines.join("\n");
    const subject = `${s.name} — ${format(now, "EEE, MMM d")}: ${money(d.collected)} collected, ${d.completed} completed`;
    const base = process.env.APP_URL?.replace(/\/$/, "");
    const html = renderEmailHtml({ shopName: s.name, logoUrl: s.logoUrl && base ? (s.logoUrl.startsWith("http") ? s.logoUrl : `${base}${s.logoUrl}`) : null, accent: s.accentColor, subject: "Today at a glance", body: `${body}${base ? `\n\nOpen the dashboard: ${base}/dashboard` : ""}`, ctaLabel: "Open dashboard" });
    for (const u of shop.users) if (await sendEmail({ to: u.email, subject, text: body, html })) sent++;
    await rawDb.shopSettings.update({ where: { shopId: shop.id }, data: { lastDigestAt: now } });
  }
  return sent;
}
