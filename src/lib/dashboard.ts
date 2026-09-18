import "server-only";
import { addDays, differenceInMinutes, eachDayOfInterval, endOfDay, format, startOfDay, subDays } from "date-fns";
import { db, currentShopId } from "./db";

export type Range = "daily" | "weekly" | "monthly";

const RANGE_DAYS: Record<Range, number> = { daily: 7, weekly: 28, monthly: 30 };

export async function getDashboard(range: Range = "monthly") {
  const shopId = await currentShopId();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yStart = subDays(todayStart, 1);
  const days = RANGE_DAYS[range];
  const rangeStart = subDays(todayStart, days - 1);

  const [
    appointmentsToday,
    inShop,
    openWorkOrders,
    awaitingApproval,
    completedToday,
    inProgress,
    waitingParts,
    scheduled,
    todayPayments,
    yesterdayPayments,
    rangePayments,
    recentWorkOrders,
    technicians,
    timeEntries,
    lowStock,
    todaysAppointments,
    bays,
    settings,
  ] = await Promise.all([
    db.appointment.count({ where: { scheduledStart: { gte: todayStart, lte: todayEnd }, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
    db.workOrder.count({ where: { status: { in: ["APPROVED", "IN_PROGRESS", "ON_HOLD", "AWAITING_APPROVAL"] } } }),
    db.workOrder.count({ where: { status: { notIn: ["INVOICED", "CANCELLED", "COMPLETED"] } } }),
    db.workOrder.count({ where: { status: "AWAITING_APPROVAL" } }),
    db.workOrder.count({ where: { completedAt: { gte: todayStart, lte: todayEnd } } }),
    db.workOrder.count({ where: { status: "IN_PROGRESS" } }),
    db.workOrder.count({ where: { status: "ON_HOLD" } }),
    db.appointment.count({ where: { scheduledStart: { gte: todayStart, lte: todayEnd }, status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: todayStart, lte: todayEnd } } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: yStart, lt: todayStart } } }),
    db.payment.findMany({ where: { paidAt: { gte: rangeStart } }, select: { amount: true, paidAt: true } }),
    db.workOrder.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { vehicle: true, customer: true, lines: true },
    }),
    db.technician.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.timeEntry.findMany({ where: { startedAt: { gte: todayStart } } }),
    // raw SQL bypasses the shop-scoped client — filter by shop explicitly
    db.$queryRaw<{ id: string; name: string; sku: string; quantityOnHand: number; reorderPoint: number; category: string | null }[]>`
      SELECT id, name, sku, "quantityOnHand", "reorderPoint", category FROM "Part"
      WHERE "shopId" = ${shopId} AND active AND "quantityOnHand" <= "reorderPoint" ORDER BY ("quantityOnHand"::float / NULLIF("reorderPoint",0)) ASC NULLS FIRST LIMIT 6`,
    db.appointment.findMany({
      where: { scheduledStart: { gte: todayStart, lte: todayEnd }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      include: { vehicle: true, customer: true, bay: true, technician: true },
      orderBy: { scheduledStart: "asc" },
    }),
    db.bay.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.shopSettings.findFirst(),
  ]);

  const todayRevenue = Number(todayPayments._sum.amount ?? 0);
  const yesterdayRevenue = Number(yesterdayPayments._sum.amount ?? 0);
  const rangeRevenue = rangePayments.reduce((s, p) => s + Number(p.amount), 0);

  // revenue series per day
  const series = eachDayOfInterval({ start: rangeStart, end: todayStart }).map((d) => ({
    date: d,
    label: format(d, range === "daily" ? "EEE" : "MMM d"),
    value: 0,
  }));
  for (const p of rangePayments) {
    const idx = Math.floor((startOfDay(p.paidAt).getTime() - rangeStart.getTime()) / 86_400_000);
    if (series[idx]) series[idx].value += Number(p.amount);
  }

  // technician hours today
  const openMinutes = shopMinutes(settings?.openTime ?? "08:00", settings?.closeTime ?? "18:00");
  const techStats = technicians
    .map((t) => {
      const mins = timeEntries
        .filter((e) => e.technicianId === t.id)
        .reduce((s, e) => s + differenceInMinutes(e.endedAt ?? now, e.startedAt), 0);
      return { ...t, hours: mins / 60, utilisation: Math.min(1, mins / Math.max(openMinutes * 0.8, 1)) };
    })
    .sort((a, b) => b.hours - a.hours);
  const teamUtilisation = techStats.length ? techStats.reduce((s, t) => s + t.utilisation, 0) / techStats.length : 0;

  return {
    kpis: { appointmentsToday, inShop, openWorkOrders, awaitingApproval, completedToday, inProgress, waitingParts, scheduled },
    revenue: {
      today: todayRevenue,
      deltaVsYesterday: yesterdayRevenue > 0 ? (todayRevenue - yesterdayRevenue) / yesterdayRevenue : todayRevenue > 0 ? 1 : 0,
      range: rangeRevenue,
      rangeLabel: range === "daily" ? "Last 7 days" : range === "weekly" ? "Last 4 weeks" : "Last 30 days",
      series,
    },
    recentWorkOrders,
    techStats,
    teamUtilisation,
    lowStock,
    todaysAppointments,
    bays,
    open: settings?.openTime ?? "08:00",
    close: settings?.closeTime ?? "18:00",
    tomorrow: addDays(todayStart, 1),
  };
}

export function shopMinutes(open: string, close: string) {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  return Math.max(60, ch * 60 + cm - (oh * 60 + om));
}
