import { NextResponse, type NextRequest } from "next/server";
import { format } from "date-fns";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * CSV exports for staff: /api/export/{customers|vehicles|work-orders|invoices|payments|parts}
 * Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD on invoices / payments / work-orders.
 */
const ENTITIES = ["customers", "vehicles", "work-orders", "invoices", "payments", "parts"] as const;
type Entity = (typeof ENTITIES)[number];
const BILLING = new Set(["invoices", "payments"]);

function csv(rows: Record<string, unknown>[], columns: string[]) {
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\r\n") + "\r\n";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const user = await getSession();
  if (!user || user.role === "CUSTOMER" || !user.activeShopId) return NextResponse.json({ error: "Sign in as staff" }, { status: 401 });
  const { entity } = await ctx.params;
  if (!ENTITIES.includes(entity as Entity)) return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  if (BILLING.has(entity) && !["OWNER", "ADMIN", "SERVICE_ADVISOR", "SUPERADMIN"].includes(user.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") ? new Date(`${sp.get("to")}T23:59:59.999`) : undefined;
  const range = from || to ? { gte: from, lte: to } : undefined;

  let rows: Record<string, unknown>[] = [];
  let columns: string[] = [];
  switch (entity as Entity) {
    case "customers": {
      const data = await db.customer.findMany({ orderBy: { lastName: "asc" }, include: { _count: { select: { vehicles: true, workOrders: true } } } });
      columns = ["id", "firstName", "lastName", "company", "email", "phone", "address", "city", "state", "zip", "vehicles", "workOrders", "createdAt"];
      rows = data.map((c) => ({ ...c, vehicles: c._count.vehicles, workOrders: c._count.workOrders }));
      break;
    }
    case "vehicles": {
      const data = await db.vehicle.findMany({ orderBy: [{ make: "asc" }, { model: "asc" }], include: { customer: { select: { firstName: true, lastName: true, email: true } } } });
      columns = ["id", "year", "make", "model", "trim", "color", "vin", "licensePlate", "plateState", "mileage", "engine", "transmission", "owner", "ownerEmail", "createdAt"];
      rows = data.map((v) => ({ ...v, owner: `${v.customer.firstName} ${v.customer.lastName}`, ownerEmail: v.customer.email }));
      break;
    }
    case "work-orders": {
      const data = await db.workOrder.findMany({ where: range ? { createdAt: range } : undefined, orderBy: { number: "desc" }, include: { customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { year: true, make: true, model: true, licensePlate: true } }, technician: { select: { name: true } }, lines: { where: { approved: true } } } });
      columns = ["number", "status", "customer", "vehicle", "plate", "technician", "complaint", "subtotal", "createdAt", "completedAt"];
      rows = data.map((w) => ({
        number: `WO-${String(w.number).padStart(5, "0")}`, status: w.status, customer: `${w.customer.firstName} ${w.customer.lastName}`,
        vehicle: `${w.vehicle.year} ${w.vehicle.make} ${w.vehicle.model}`, plate: w.vehicle.licensePlate, technician: w.technician?.name,
        complaint: w.complaint, subtotal: w.lines.reduce((s, l) => s + Number(l.hours ?? l.quantity) * Number(l.unitPrice), 0).toFixed(2),
        createdAt: w.createdAt, completedAt: w.completedAt,
      }));
      break;
    }
    case "invoices": {
      const data = await db.invoice.findMany({ where: range ? { issuedAt: range } : undefined, orderBy: { number: "desc" }, include: { customer: { select: { firstName: true, lastName: true, email: true } }, workOrder: { select: { number: true } } } });
      columns = ["number", "status", "issuedAt", "dueAt", "customer", "email", "workOrder", "subtotal", "tax", "total", "amountPaid", "balance"];
      rows = data.map((i) => ({
        number: `INV-${String(i.number).padStart(5, "0")}`, status: i.status, issuedAt: i.issuedAt, dueAt: i.dueAt,
        customer: `${i.customer.firstName} ${i.customer.lastName}`, email: i.customer.email, workOrder: `WO-${String(i.workOrder.number).padStart(5, "0")}`,
        subtotal: Number(i.subtotal).toFixed(2), tax: Number(i.tax).toFixed(2), total: Number(i.total).toFixed(2), amountPaid: Number(i.amountPaid).toFixed(2), balance: (Number(i.total) - Number(i.amountPaid)).toFixed(2),
      }));
      break;
    }
    case "payments": {
      const data = await db.payment.findMany({ where: range ? { paidAt: range } : undefined, orderBy: { paidAt: "desc" }, include: { invoice: { select: { number: true, customer: { select: { firstName: true, lastName: true } } } } } });
      columns = ["paidAt", "amount", "method", "reference", "invoice", "customer"];
      rows = data.map((p) => ({ paidAt: p.paidAt, amount: Number(p.amount).toFixed(2), method: p.method, reference: p.reference, invoice: `INV-${String(p.invoice.number).padStart(5, "0")}`, customer: `${p.invoice.customer.firstName} ${p.invoice.customer.lastName}` }));
      break;
    }
    case "parts": {
      const data = await db.part.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }], include: { supplier: { select: { name: true } } } });
      columns = ["sku", "name", "brand", "category", "location", "supplier", "quantityOnHand", "reorderPoint", "cost", "price", "active"];
      rows = data.map((p) => ({ ...p, supplier: p.supplier?.name, cost: Number(p.cost).toFixed(2), price: Number(p.price).toFixed(2) }));
      break;
    }
  }

  const body = csv(rows, columns);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexdrive-${entity}-${format(new Date(), "yyyy-MM-dd")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
