import "server-only";
import { addDays } from "date-fns";
import { rawDb, withShop } from "./db";
import { queueNotification } from "./notify";
import { renderTemplate } from "./templates";

const LOOKAHEAD_DAYS = 14;
const LOOKAHEAD_MILES = 500;

/**
 * Sends each due (or nearly due) maintenance reminder to the customer once.
 * Runs hourly from instrumentation.ts and on demand from Settings.
 * Returns the number of reminders sent.
 */
export async function sendDueReminders(onlyShopId?: string) {
  const shops = await rawDb.shop.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] }, ...(onlyShopId ? { id: onlyShopId } : {}) }, select: { id: true } });
  let sent = 0;
  for (const shop of shops) {
    sent += await withShop(shop.id, async () => {
      const rows = await rawDb.maintenanceReminder.findMany({
        where: {
          completed: false,
          notifiedAt: null,
          vehicle: { shopId: shop.id },
          OR: [{ dueAtDate: { lte: addDays(new Date(), LOOKAHEAD_DAYS) } }, { dueAtMileage: { not: null } }],
        },
        include: { vehicle: { select: { id: true, year: true, make: true, model: true, mileage: true, customerId: true, customer: { select: { firstName: true } } } } },
      });
      let n = 0;
      for (const r of rows) {
        const byDate = r.dueAtDate ? r.dueAtDate <= addDays(new Date(), LOOKAHEAD_DAYS) : false;
        const byMiles = r.dueAtMileage != null ? r.vehicle.mileage >= r.dueAtMileage - LOOKAHEAD_MILES : false;
        if (!byDate && !byMiles) continue;
        const when = r.dueAtDate ? r.dueAtDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : r.dueAtMileage != null ? `${r.dueAtMileage.toLocaleString()} mi` : "soon";
        const t = await renderTemplate("reminder_due", { customer: r.vehicle.customer.firstName, vehicle: `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`, service: r.service, date: when });
        await queueNotification({ customerId: r.vehicle.customerId, ...t });
        await rawDb.maintenanceReminder.update({ where: { id: r.id }, data: { notifiedAt: new Date() } });
        n++;
      }
      return n;
    });
  }
  return sent;
}

let timer: NodeJS.Timeout | null = null;
/** Hourly scheduler; safe to call more than once. */
export function startReminderScheduler() {
  if (timer) return;
  const run = async () => {
    await sendDueReminders().catch((e) => console.error("[nexdrive] reminder run failed", e));
    const { sendAppointmentReminders, sendDailyDigests } = await import("./digest");
    await sendAppointmentReminders().then((n) => n && console.log(`[nexdrive] ${n} appointment reminder(s) sent`)).catch((e) => console.error("[nexdrive] appointment reminders failed", e));
    await sendDailyDigests().then((n) => n && console.log(`[nexdrive] ${n} daily digest(s) sent`)).catch((e) => console.error("[nexdrive] daily digest failed", e));
    const { flushOutbox } = await import("./notify");
    await flushOutbox().then((n) => n && console.log(`[nexdrive] outbox: ${n} queued notification(s) sent`)).catch((e) => console.error("[nexdrive] outbox flush failed", e));
    const { expireTrials } = await import("./billing");
    await expireTrials().then((n) => n && console.log(`[nexdrive] ${n} expired trial(s) suspended`)).catch((e) => console.error("[nexdrive] trial expiry failed", e));
  };
  timer = setInterval(run, 60 * 60 * 1000);
  timer.unref?.();
  setTimeout(run, 30 * 1000).unref?.();
}
