import "server-only";
import { createHmac } from "node:crypto";
import { db, currentShopIdOrNull, withShop } from "./db";
import { serialize } from "./api";

/**
 * Outbound webhooks. Other software subscribes to events under Settings -> API & Webhooks;
 * NexDrive POSTs a signed JSON envelope to each matching endpoint.
 *
 *   X-NexDrive-Event:      work_order.status_changed
 *   X-NexDrive-Signature:  sha256=<hex HMAC of the raw body using the endpoint secret>
 *   X-NexDrive-Delivery:   <delivery id>
 */
export const WEBHOOK_EVENTS = [
  "customer.created",
  "vehicle.created",
  "work_order.created",
  "work_order.status_changed",
  "work_order.sent_for_approval",
  "work_order.approved",
  "work_order.declined",
  "invoice.created",
  "invoice.paid",
  "payment.recorded",
  "appointment.created",
  "appointment.status_changed",
  "inspection.completed",
  "part.low_stock",
  "machine.status_changed",
  "machine.alarm",
  "ping",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Fire-and-forget: never blocks or throws into the calling action. */
export function emitWebhook(event: WebhookEvent, data: unknown) {
  void (async () => {
    const shopId = await currentShopIdOrNull();
    if (!shopId) return;
    await withShop(shopId, () => deliverAll(event, data));
  })().catch((e) => console.error("[webhooks]", e));
}

async function deliverAll(event: WebhookEvent, data: unknown) {
  const endpoints = await db.webhookEndpoint.findMany({ where: { enabled: true } });
  const targets = endpoints.filter((e) => e.events.length === 0 || e.events.includes(event) || e.events.includes("*"));
  if (!targets.length) return;
  const payload = { event, at: new Date().toISOString(), data: serialize(data) };
  await Promise.all(targets.map((t) => deliverOne(t, event, payload)));
}

export async function deliverOne(endpoint: { id: string; url: string; secret: string; failures: number }, event: string, payload: object, attempt = 1): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const delivery = await db.webhookDelivery.create({ data: { endpointId: endpoint.id, event, ok: false, payload: payload as object } });
  const body = JSON.stringify({ ...payload, id: delivery.id });
  const signature = `sha256=${createHmac("sha256", endpoint.secret).update(body).digest("hex")}`;
  const started = Date.now();
  let status: number | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "NexDrive-Webhooks/1.0", "X-NexDrive-Event": event, "X-NexDrive-Signature": signature, "X-NexDrive-Delivery": delivery.id },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    status = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const ok = !error;
  await db.webhookDelivery.update({ where: { id: delivery.id }, data: { ok, status, error, durationMs: Date.now() - started } });
  await db.webhookEndpoint.update({ where: { id: endpoint.id }, data: { lastStatus: status, lastDeliveredAt: new Date(), failures: ok ? 0 : { increment: 1 } } });
  if (!ok && attempt < 3) {
    await new Promise((r) => setTimeout(r, attempt * 5_000));
    return deliverOne(endpoint, event, payload, attempt + 1);
  }
  return { ok, status, error };
}
