import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { endOfDay, format, startOfDay, subDays, subMonths } from "date-fns";
import { db, currentShopId, nextNumber } from "./db";
import { getSettings } from "./settings";
import { getDashboard } from "./dashboard";
import { computeTotals } from "./money";
import { productionSnapshot } from "./integrations/snapshot";
import type { SessionUser } from "./auth";
import type { WorkOrderStatus } from "@/generated/prisma/enums";

export const AI_MODEL = "claude-opus-5";
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });
const woUrl = (id: string) => `/work-orders/${id}`;

/** Tools give the assistant controlled, read-mostly access to the shop's data. */
function buildTools(user: SessionUser, taxRate: number) {
  const shopOverview = betaZodTool({
    name: "shop_overview",
    description: "Today's shop KPIs: appointments, vehicles in shop, open/awaiting work orders, completed today, revenue today and last 30 days, technician hours, low-stock parts.",
    inputSchema: z.object({}),
    run: async () => {
      const d = await getDashboard("monthly");
      return JSON.stringify({ date: format(new Date(), "yyyy-MM-dd"), kpis: d.kpis, revenue: { today: d.revenue.today, last30Days: d.revenue.range }, technicians: d.techStats.map((t) => ({ name: t.name, hoursToday: Number(t.hours.toFixed(1)), utilisation: Math.round(t.utilisation * 100) })), lowStock: d.lowStock, appointmentsToday: d.todaysAppointments.map((a) => ({ time: format(a.scheduledStart, "h:mm a"), vehicle: `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}`, customer: `${a.customer.firstName} ${a.customer.lastName}`, service: a.serviceRequested, status: a.status, bay: a.bay?.name, technician: a.technician?.name })) });
    },
  });

  const listWorkOrders = betaZodTool({
    name: "list_work_orders",
    description: "List work orders, optionally filtered by status (ESTIMATE, AWAITING_APPROVAL, APPROVED, IN_PROGRESS, ON_HOLD, COMPLETED, INVOICED, CANCELLED), technician name, or customer/vehicle search text.",
    inputSchema: z.object({ status: z.enum(["ESTIMATE", "AWAITING_APPROVAL", "APPROVED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "INVOICED", "CANCELLED", "OPEN"]).optional(), technician: z.string().optional(), search: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) }),
    run: async ({ status, technician, search, limit }) => {
      const rows = await db.workOrder.findMany({
        where: {
          ...(status === "OPEN" ? { status: { notIn: ["INVOICED", "CANCELLED"] as WorkOrderStatus[] } } : status ? { status } : {}),
          ...(technician ? { technician: { name: ci(technician) } } : {}),
          ...(search ? { OR: [{ complaint: ci(search) }, { customer: { OR: [{ firstName: ci(search) }, { lastName: ci(search) }] } }, { vehicle: { OR: [{ make: ci(search) }, { model: ci(search) }, { licensePlate: ci(search) }] } }] } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: { customer: true, vehicle: true, technician: true, lines: true },
      });
      return JSON.stringify(rows.map((w) => ({ number: w.number, url: woUrl(w.id), status: w.status, customer: `${w.customer.firstName} ${w.customer.lastName}`, vehicle: `${w.vehicle.year} ${w.vehicle.make} ${w.vehicle.model}`, complaint: w.complaint, technician: w.technician?.name ?? null, total: computeTotals(w.lines, taxRate, { taxExempt: w.customer.taxExempt }).total, promisedAt: w.promisedAt, updatedAt: w.updatedAt })));
    },
  });

  const getWorkOrder = betaZodTool({
    name: "get_work_order",
    description: "Full detail for one work order by its number (e.g. 12 for WO-00012): lines, totals, diagnosis, approval state, inspection results.",
    inputSchema: z.object({ number: z.number().int() }),
    run: async ({ number }) => {
      const w = await db.workOrder.findFirst({ where: { number }, include: { customer: true, vehicle: true, technician: true, lines: true, inspection: { include: { items: true } }, invoice: true } });
      if (!w) return "Not found";
      return JSON.stringify({ ...w, url: woUrl(w.id), totals: computeTotals(w.lines, taxRate, { taxExempt: w.customer.taxExempt }), inspectionFindings: w.inspection?.items.filter((i) => i.result !== "GOOD" && i.result !== "NA").map((i) => `${i.name}: ${i.result}${i.notes ? ` (${i.notes})` : ""}`) });
    },
  });

  const findCustomers = betaZodTool({
    name: "find_customers",
    description: "Search customers by name, email, phone, plate or company. Returns their vehicles and last visit.",
    inputSchema: z.object({ query: z.string() }),
    run: async ({ query }) => {
      const rows = await db.customer.findMany({ where: { OR: [{ firstName: ci(query) }, { lastName: ci(query) }, { company: ci(query) }, { email: ci(query) }, { phone: { contains: query } }, { vehicles: { some: { licensePlate: ci(query) } } }] }, take: 10, include: { vehicles: true, workOrders: { orderBy: { createdAt: "desc" }, take: 1 } } });
      return JSON.stringify(rows.map((c) => ({ id: c.id, url: `/customers/${c.id}`, name: `${c.firstName} ${c.lastName}`, phone: c.phone, email: c.email, vehicles: c.vehicles.map((v) => ({ id: v.id, name: `${v.year} ${v.make} ${v.model}`, plate: v.licensePlate, mileage: v.mileage })), lastVisit: c.workOrders[0]?.createdAt ?? null })));
    },
  });

  const overdueService = betaZodTool({
    name: "vehicles_due_for_service",
    description: "Vehicles with overdue maintenance reminders (by date or mileage) or no visit in the last N months.",
    inputSchema: z.object({ monthsSinceVisit: z.number().int().min(1).max(60).default(6) }),
    run: async ({ monthsSinceVisit }) => {
      const cutoff = subMonths(new Date(), monthsSinceVisit);
      const [reminders, stale] = await Promise.all([
        db.maintenanceReminder.findMany({ where: { completed: false, OR: [{ dueAtDate: { lt: new Date() } }] }, include: { vehicle: { include: { customer: true } } } }),
        db.vehicle.findMany({ where: { workOrders: { none: { createdAt: { gte: cutoff } } } }, include: { customer: true, workOrders: { orderBy: { createdAt: "desc" }, take: 1 } }, take: 50 }),
      ]);
      const mileageDue = await db.maintenanceReminder.findMany({ where: { completed: false, dueAtMileage: { not: null } }, include: { vehicle: { include: { customer: true } } } });
      return JSON.stringify({
        overdueReminders: [...reminders, ...mileageDue.filter((r) => r.dueAtMileage! <= r.vehicle.mileage)].map((r) => ({ vehicleId: r.vehicleId, vehicle: `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`, customer: `${r.vehicle.customer.firstName} ${r.vehicle.customer.lastName}`, phone: r.vehicle.customer.phone, service: r.service, dueAtDate: r.dueAtDate, dueAtMileage: r.dueAtMileage, currentMileage: r.vehicle.mileage })),
        noVisitSince: stale.map((v) => ({ vehicleId: v.id, vehicle: `${v.year} ${v.make} ${v.model}`, customer: `${v.customer.firstName} ${v.customer.lastName}`, phone: v.customer.phone, lastVisit: v.workOrders[0]?.createdAt ?? null })),
      });
    },
  });

  const lapsedCustomers = betaZodTool({
    name: "lapsed_customers",
    description: "Customers who have not had a work order in the last N months (default 12).",
    inputSchema: z.object({ months: z.number().int().min(1).max(60).default(12) }),
    run: async ({ months }) => {
      const cutoff = subMonths(new Date(), months);
      const rows = await db.customer.findMany({ where: { workOrders: { none: { createdAt: { gte: cutoff } } } }, include: { workOrders: { orderBy: { createdAt: "desc" }, take: 1 }, vehicles: true }, take: 50 });
      return JSON.stringify(rows.map((c) => ({ url: `/customers/${c.id}`, name: `${c.firstName} ${c.lastName}`, phone: c.phone, email: c.email, lastVisit: c.workOrders[0]?.createdAt ?? "never", vehicles: c.vehicles.map((v) => `${v.year} ${v.make} ${v.model}`) })));
    },
  });

  const inventory = betaZodTool({
    name: "inventory",
    description: "Parts inventory. With lowOnly=true returns only parts at or below their reorder point. Optional search text.",
    inputSchema: z.object({ lowOnly: z.boolean().default(false), search: z.string().optional() }),
    run: async ({ lowOnly, search }) => {
      const rows = await db.part.findMany({ where: { active: true, ...(search ? { OR: [{ name: ci(search) }, { sku: ci(search) }, { category: ci(search) }] } : {}) }, include: { supplier: true }, orderBy: { name: "asc" }, take: 100 });
      return JSON.stringify(rows.filter((p) => !lowOnly || p.quantityOnHand <= p.reorderPoint).map((p) => ({ url: `/parts/${p.id}`, sku: p.sku, name: p.name, onHand: p.quantityOnHand, reorderPoint: p.reorderPoint, cost: Number(p.cost), price: Number(p.price), supplier: p.supplier?.name, location: p.location })));
    },
  });

  const revenue = betaZodTool({
    name: "revenue_summary",
    description: "Payments collected and invoices issued over the last N days, with per-day totals and per-technician breakdown.",
    inputSchema: z.object({ days: z.number().int().min(1).max(365).default(30) }),
    run: async ({ days }) => {
      const since = subDays(startOfDay(new Date()), days - 1);
      const [payments, invoices] = await Promise.all([
        db.payment.findMany({ where: { paidAt: { gte: since } }, select: { amount: true, paidAt: true, method: true } }),
        db.invoice.findMany({ where: { issuedAt: { gte: since }, status: { not: "VOID" } }, include: { workOrder: { include: { technician: true } } } }),
      ]);
      const byDay: Record<string, number> = {};
      for (const p of payments) byDay[format(p.paidAt, "yyyy-MM-dd")] = (byDay[format(p.paidAt, "yyyy-MM-dd")] ?? 0) + Number(p.amount);
      const byTech: Record<string, number> = {};
      for (const i of invoices) byTech[i.workOrder.technician?.name ?? "Unassigned"] = (byTech[i.workOrder.technician?.name ?? "Unassigned"] ?? 0) + Number(i.total);
      return JSON.stringify({ days, collected: payments.reduce((s, p) => s + Number(p.amount), 0), invoiced: invoices.reduce((s, i) => s + Number(i.total), 0), invoiceCount: invoices.length, byDay, byTechnician: byTech });
    },
  });

  const schedule = betaZodTool({
    name: "schedule",
    description: "Appointments for a given date (YYYY-MM-DD, default today).",
    inputSchema: z.object({ date: z.string().optional() }),
    run: async ({ date }) => {
      const d = date ? new Date(date) : new Date();
      const rows = await db.appointment.findMany({ where: { scheduledStart: { gte: startOfDay(d), lte: endOfDay(d) } }, include: { customer: true, vehicle: true, technician: true, bay: true }, orderBy: { scheduledStart: "asc" } });
      return JSON.stringify(rows.map((a) => ({ url: `/schedule/${a.id}`, time: format(a.scheduledStart, "h:mm a"), end: format(a.scheduledEnd, "h:mm a"), customer: `${a.customer.firstName} ${a.customer.lastName}`, vehicle: `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}`, service: a.serviceRequested, status: a.status, technician: a.technician?.name, bay: a.bay?.name })));
    },
  });

  const production = betaZodTool({
    name: "production_status",
    description: "Live production floor: machine statuses, counts today, alarms, connected feeds.",
    inputSchema: z.object({}),
    run: async () => {
      const s = await productionSnapshot();
      return JSON.stringify({ totals: s.totals, lines: s.lines, machines: s.machines.map((m) => ({ code: m.code, name: m.name, line: m.line, status: m.status, today: m.today, lastHour: m.lastHour, metrics: m.metrics })), alarms: s.alarms, feeds: s.integrations });
    },
  });

  const createEstimate = betaZodTool({
    name: "create_estimate",
    description: "Create a new ESTIMATE work order for a vehicle (by vehicleId from find_customers) with a complaint, optionally applying a canned service by name (e.g. 'Front Brake Job'). Returns the new work order number and URL. Only use when the user explicitly asks to create an estimate.",
    inputSchema: z.object({ vehicleId: z.string(), complaint: z.string(), cannedService: z.string().optional() }),
    run: async ({ vehicleId, complaint, cannedService }) => {
      if (user.role === "TECHNICIAN") return "Technicians can't create estimates through the assistant.";
      const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
      if (!vehicle) return "Vehicle not found";
      const settings = await getSettings();
      const wo = await db.workOrder.create({ data: { shopId: await currentShopId(), number: await nextNumber("wo"), customerId: vehicle.customerId, vehicleId, complaint, mileageIn: vehicle.mileage } });
      let applied: string | null = null;
      if (cannedService) {
        const svc = await db.cannedService.findFirst({ where: { name: ci(cannedService), active: true }, include: { parts: { include: { part: true } } } });
        if (svc) {
          await db.workOrderLine.create({ data: { workOrderId: wo.id, kind: "LABOR", description: svc.name, hours: svc.laborHours, quantity: svc.laborHours, unitPrice: svc.laborRate ?? settings.laborRate, taxable: false, sortOrder: 0 } });
          let i = 1;
          for (const p of svc.parts) await db.workOrderLine.create({ data: { workOrderId: wo.id, kind: "PART", description: p.part.name, quantity: p.quantity, unitPrice: p.part.price, partId: p.partId, sortOrder: i++ } });
          applied = svc.name;
        }
      }
      await db.auditLog.create({ data: { shopId: await currentShopId(), userId: user.id, action: "create", entity: "WorkOrder", entityId: wo.id, detail: `#${wo.number} via NexDrive AI` } });
      return JSON.stringify({ number: wo.number, url: woUrl(wo.id), appliedService: applied });
    },
  });

  return [shopOverview, listWorkOrders, getWorkOrder, findCustomers, overdueService, lapsedCustomers, inventory, revenue, schedule, production, createEstimate];
}

export async function runAssistant(user: SessionUser, history: { role: "user" | "assistant"; content: string }[], question: string) {
  const settings = await getSettings();
  const client = new Anthropic();
  const system = [
    `You are NexDrive AI, the built-in assistant of NexDrive Automotive OS for the shop "${settings.name}" (${settings.tagline}).`,
    `You are talking to ${user.name} (${user.role.replace("_", " ").toLowerCase()}). Today is ${format(new Date(), "EEEE, MMMM d, yyyy")}.`,
    "Answer questions about the shop using the tools — never guess numbers. Be concise and practical, like a sharp service manager. Use short markdown (bullets, bold) and money with two decimals.",
    "When you reference a record the tools returned with a url, link it in markdown, e.g. [WO-00012](/work-orders/abc). Work order numbers display as WO-00012.",
    "Only create estimates when explicitly asked, and confirm what you created with its link. Never invent customers, parts or prices.",
  ].join("\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = [...history.slice(-16).map((m) => ({ role: m.role, content: m.content })), { role: "user", content: question }];
  const runner = client.beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 8000,
    system,
    tools: buildTools(user, settings.taxRate),
    messages,
    max_iterations: 8,
  });
  const final = await runner;
  const text = final.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  if (final.stop_reason === "refusal") return "I can't help with that request.";
  return text || "I wasn't able to produce an answer — try rephrasing.";
}
