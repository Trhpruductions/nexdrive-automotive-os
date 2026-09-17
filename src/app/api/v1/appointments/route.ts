import { addMinutes, endOfDay, startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { ApiError, date, handler, json, num, pageResponse, paging, readBody, str } from "@/lib/api";
import { queueNotification } from "@/lib/notify";
import { emitWebhook } from "@/lib/webhooks";

export const GET = handler("read", async (req) => {
  const p = paging(req);
  const from = p.sp.get("from") ? new Date(p.sp.get("from")!) : startOfDay(new Date());
  const to = p.sp.get("to") ? new Date(p.sp.get("to")!) : endOfDay(addMinutes(from, 7 * 24 * 60));
  const where = { scheduledStart: { gte: from, lte: to }, ...(p.sp.get("customerId") ? { customerId: p.sp.get("customerId")! } : {}) };
  const [total, rows] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({ where, orderBy: { scheduledStart: "asc" }, skip: p.skip, take: p.limit, include: { customer: { select: { id: true, firstName: true, lastName: true, phone: true } }, vehicle: { select: { id: true, year: true, make: true, model: true, licensePlate: true } }, technician: { select: { id: true, name: true } }, bay: { select: { id: true, name: true } } } }),
  ]);
  return pageResponse(rows, total, p);
});

export const POST = handler("write", async (req) => {
  const b = await readBody(req);
  const vehicleId = str(b.vehicleId, "vehicleId", { required: true })!;
  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new ApiError(422, "vehicleId does not exist.", "validation");
  const start = date(b.scheduledStart, "scheduledStart", { required: true })!;
  const duration = num(b.durationMinutes, "durationMinutes", { int: true, min: 15 }) ?? 60;
  const a = await db.appointment.create({
    data: {
      customerId: vehicle.customerId,
      vehicleId,
      scheduledStart: start,
      scheduledEnd: addMinutes(start, duration),
      serviceRequested: str(b.serviceRequested, "serviceRequested", { required: true, max: 300 })!,
      technicianId: str(b.technicianId, "technicianId") ?? null,
      bayId: str(b.bayId, "bayId") ?? null,
      notes: str(b.notes, "notes", { max: 2000 }) ?? null,
      dropOff: b.dropOff == null ? true : Boolean(b.dropOff),
      status: b.confirmed ? "CONFIRMED" : "SCHEDULED",
    },
    include: { vehicle: true, customer: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (b.notify !== false) {
    await queueNotification({ customerId: a.customerId, subject: "Appointment booked", body: `Your ${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model} is booked for ${start.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} — ${a.serviceRequested}.` });
  }
  emitWebhook("appointment.created", a);
  return json(a, { status: 201 });
});
