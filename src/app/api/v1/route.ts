import { NextResponse } from "next/server";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

/** GET /api/v1 — machine-readable index of the developer API (no auth needed). */
export function GET() {
  return NextResponse.json({
    name: "NexDrive Automotive OS API",
    version: 1,
    auth: "Authorization: Bearer <key>  (keys are issued under Settings → API & Webhooks; scopes: read, write, ingest)",
    pagination: "?page=1&limit=50 (max 200). Responses: { data, page, limit, total, pages }",
    endpoints: {
      "GET  /api/v1/me": "the key's name and scopes",
      "GET  /api/v1/customers?q=": "list / search customers (read)",
      "POST /api/v1/customers": "create customer { firstName, lastName, email?, phone?, address?, city?, state?, zip?, company?, notes? } (write)",
      "GET  /api/v1/customers/{id}": "customer with vehicles and recent work orders (read)",
      "PATCH /api/v1/customers/{id}": "update any customer field (write)",
      "GET  /api/v1/vehicles?q=&customerId=": "list / search vehicles (read)",
      "POST /api/v1/vehicles": "create vehicle { customerId, year, make, model, vin?, licensePlate?, mileage? … } (write)",
      "GET  /api/v1/vehicles/{id}": "vehicle with service history (read)",
      "PATCH /api/v1/vehicles/{id}": "update vehicle, e.g. { mileage } (write)",
      "GET  /api/v1/work-orders?status=&customerId=&vehicleId=&since=": "list work orders with totals (read)",
      "POST /api/v1/work-orders": "create estimate { vehicleId, complaint, technicianId?, lines?: [{ kind, description, quantity?, hours?, unitPrice? }] } (write)",
      "GET  /api/v1/work-orders/{id}": "full work order: lines, totals, inspection, invoice (read)",
      "PATCH /api/v1/work-orders/{id}": "update { status?, diagnosis?, technicianNotes?, technicianId?, promisedAt? } (write)",
      "GET  /api/v1/appointments?from=&to=": "appointments in a window (read)",
      "POST /api/v1/appointments": "book { vehicleId, scheduledStart, durationMinutes?, serviceRequested, technicianId?, bayId?, notes? } (write)",
      "GET  /api/v1/invoices?status=&since=": "invoices with balances and payments (read)",
      "GET  /api/v1/invoices/{id}": "invoice detail (read)",
      "GET  /api/v1/parts?q=&low=1": "inventory (read)",
      "POST /api/v1/parts": "create part { sku, name, price?, cost?, quantityOnHand?, reorderPoint? … } (write)",
      "PATCH /api/v1/parts/{id}": "update fields, or { adjust: -2, reason } to move stock (write)",
      "GET  /api/v1/machines": "machines with live status (read)",
      "GET  /api/v1/production": "production floor snapshot: lines, machines, alarms, feeds (read)",
      "POST /api/v1/events": "push machine / inventory events — same format as /api/ingest (ingest)",
    },
    webhooks: { events: WEBHOOK_EVENTS, signature: "X-NexDrive-Signature: sha256=HMAC_SHA256(secret, raw body)" },
    docs: "/settings?tab=api",
  });
}
